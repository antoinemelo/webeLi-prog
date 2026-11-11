// Optional end-to-end regression suite. Start ServeurHTTP_Web.py first.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const options = {headless: true};
  if (process.env.PYTHON_LAB_HTTP_LAN === '1') {
    options.args = ['--host-resolver-rules=MAP atelier.test 127.0.0.1', '--no-proxy-server'];
  }
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage({viewport: {width: 1365, height: 960}, locale: 'fr-CH'});
    const lan = process.env.PYTHON_LAB_HTTP_LAN === '1';
    const url = process.env.PYTHON_LAB_URL || (lan
      ? 'http://atelier.test:8000/labs/python/' : 'http://127.0.0.1:8000/labs/python/');
    const origin = new URL(url).origin;
    await page.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
    // Native save dialogs cannot be driven headlessly. Record their writable handles.
    await page.addInitScript(() => {
      const saves = window.pythonSaveTest = {pickers: 0, writes: [], cancel: false};
      window.showOpenFilePicker = async () => [];
      window.showSaveFilePicker = async options => {
        const handle = ++saves.pickers;
        if (saves.cancel) {
          saves.cancel = false;
          throw new DOMException('Cancelled', 'AbortError');
        }
        return {name: options.suggestedName, createWritable: async () => {
          let content;
          return {write: async text => { content = text; }, close: async () => {
            saves.writes.push({handle, name: options.suggestedName, content});
          }};
        }};
      };
    });
    let promptAnswer = 'essai.txt';
    const dialogs = [];
    page.on('dialog', dialog => {
      dialogs.push(dialog.message());
      if (dialog.message() === 'Attente réseau') {
        // Exceed one server long-poll to exercise a pupil thinking before typing.
        return new Promise(resolve => setTimeout(resolve, 26000)).then(() => dialog.accept('réponse différée'));
      }
      if (dialog.type() === 'prompt' && promptAnswer === null) return dialog.dismiss();
      return dialog.accept(dialog.type() === 'prompt' ? promptAnswer : undefined);
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const ready = (timeout = 20000) => page.waitForFunction(() => !document.getElementById('run').disabled, null, {timeout});
    await ready(60000); // Loading both interpreters can be slower on a busy test machine.
    assert.equal(await page.evaluate(() => crossOriginIsolated), !lan);
    if (lan) assert.equal(await page.evaluate(() => isSecureContext), false,
      'The LAN regression must run without localhost or HTTPS privileges.');
    const start = async code => {
      await page.locator('#code').fill(code);
      await page.locator('#run').click();
    };
    const run = async (code, timeout) => {
      await start(code);
      await ready(timeout);
      return page.locator('#output').innerText();
    };
    const stop = async () => {
      await page.locator('#stopPython').waitFor({state: 'visible', timeout: 8000});
      await page.locator('#stopPython').click();
      await ready();
      assert((await page.locator('#output').innerText()).includes('Programme interrompu.'));
    };

    const savedCode = '# Alice / Raccourcis\nprint("sauvegarde")';
    await page.locator('#code').fill(savedCode);
    for (const [shortcut, count] of [['Control+s', 1], ['Control+s', 2], ['F12', 3], ['Control+s', 4]]) {
      await page.keyboard.press(shortcut);
      await page.waitForFunction(count => window.pythonSaveTest.writes.length === count, count);
    }
    assert.deepEqual(await page.evaluate(() => window.pythonSaveTest.writes.map(write => write.handle)), [1, 1, 2, 2]);
    assert(await page.evaluate(code => window.pythonSaveTest.writes.every(write => write.content === code), savedCode));
    await page.evaluate(() => { window.pythonSaveTest.cancel = true; });
    await page.keyboard.press('F12');
    await page.waitForFunction(() => window.pythonSaveTest.pickers === 3);
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => window.pythonSaveTest.writes.length === 5);
    assert.equal(await page.evaluate(() => window.pythonSaveTest.writes[4].handle), 2);
    assert.deepEqual(dialogs, [], 'Cancelling Save As must keep the current file without an error alert.');
    assert.equal(new URL(page.url()).hash, '', 'Saving must not navigate to an anchor.');
    console.log('OK: Ctrl+S saves the current script; F12 chooses a new handle; cancellation preserves it.');

    assert(await page.locator('#addTextFileTab').isHidden(), 'Plus stays hidden until a first file is opened.');
    promptAnswer = null;
    await page.locator('#projectMenu').click();
    await page.locator('#newTextFile').click();
    assert(await page.locator('#addTextFileTab').isHidden(), 'Cancelling New keeps plus hidden.');
    promptAnswer = 'essai.txt';
    await page.locator('#projectMenu').click();
    await page.locator('#newTextFile').click();
    assert(await page.locator('#addTextFileTab').isVisible(), 'Creating the first file reveals plus.');
    const text = page.locator('textarea[aria-label="essai.txt"]');
    await text.click();
    await text.pressSequentially('Première ligne\nDeuxième ligne\n');
    assert.equal(await text.inputValue(), 'Première ligne\nDeuxième ligne\n');
    assert(await text.evaluate(el => {
      const box = el.getBoundingClientRect();
      return document.elementFromPoint(box.x + 40, box.y + 30) === el;
    }), 'The file editor must receive clicks, without an overlapping output pane.');
    assert.equal(await run('with open("essai.txt") as fd:\n    print(fd.readlines())'), "['Première ligne\\n', 'Deuxième ligne\\n']\n");
    const timings = [];
    for (let i = 0; i < 5; i++) {
      timings.push(await page.evaluate(() => new Promise(resolve => {
        const button = document.getElementById('run');
        document.getElementById('code').value = 'print(6 * 7)';
        const begin = performance.now();
        const observer = new MutationObserver(() => {
          if (button.disabled) return;
          observer.disconnect();
          resolve(performance.now() - begin);
        });
        observer.observe(button, {attributes: true, attributeFilter: ['disabled']});
        button.click();
      })));
      assert.equal(await page.locator('#output').innerText(), '42\n');
    }
    const median = timings.sort((a, b) => a - b)[2];
    assert(median < 1000, `Repeated simple runs should not reload Python (${Math.round(median)} ms).`);
    assert.equal(await run('previous_run_value = 123'), '');
    assert.equal(await run('print("previous_run_value" in globals())'), 'False\n');
    assert((await run('if True print("erreur")')).includes('Erreur de syntaxe'));
    assert.equal(await run('print("repris")'), 'repris\n');
    console.log(`OK: warm executions (median ${Math.round(median)} ms), fresh globals and recovery after syntax errors.`);
    await start('print("BOUCLE")\nwhile True:\n    pass');
    await page.waitForFunction(() => document.getElementById('output').textContent.includes('BOUCLE'));
    assert.equal(await page.locator('#stopPython').isVisible(), false);
    await page.locator('#code').focus();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText('\npri');
    await page.locator('#ac:not(.hidden)').waitFor();
    await page.keyboard.press('Escape');
    await ready();
    assert((await page.locator('#output').innerText()).includes('Programme interrompu.'));
    assert.equal(await page.locator('#stopPython').isVisible(), false);
    assert.equal(await run('print("repris après Échap")'), 'repris après Échap\n');
    await start('while True:\n    pass');
    await text.focus();
    await page.keyboard.press('Escape');
    await ready();
    assert((await page.locator('#output').innerText()).includes('Programme interrompu.'));
    console.log('OK: Escape interrupts from either editor, before Stop appears and with autocomplete open.');
    assert.equal(await text.evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
    await text.fill(Array.from({length: 80}, (_, i) => `ligne ${i}`).join('\n'));
    await text.hover();
    await page.mouse.wheel(0, 400);
    await page.waitForFunction(() => document.querySelector('.python-text-file').scrollTop > 0);
    await text.fill('INITIAL\n');

    const began = Date.now();
    await start('print("DÉBUT")\nwhile True:\n    pass');
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#stopPython').isVisible(), false, 'Stop is not shown immediately.');
    await page.locator('#stopPython').waitFor({state: 'visible', timeout: 7000});
    assert(Date.now() - began >= 3300, 'Stop appears after approximately 3.5 seconds.');
    await page.waitForTimeout(1200);
    assert(await page.locator('#run').isDisabled(), 'No automatic interruption.');
    await text.click();
    await text.press('ControlOrMeta+A');
    await text.pressSequentially('MODIFIÉ PENDANT LA BOUCLE');
    assert.equal(await text.inputValue(), 'MODIFIÉ PENDANT LA BOUCLE');
    await stop();
    assert.equal(await run('print(6 * 7)'), '42\n', 'A stopped program can be followed by another run.');
    console.log('OK: infinite loop stays off the UI thread; delayed manual stop and restart.');

    await text.fill('INITIAL\n');
    await start('with open("essai.txt") as fd:\n    while True:\n        fd.seek(0)\n        print(fd.read().strip())');
    await page.waitForFunction(() => document.getElementById('output').textContent.includes('INITIAL'));
    await text.fill('NOUVEAU TEXTE\n');
    await page.waitForFunction(() => document.getElementById('output').textContent.includes('NOUVEAU TEXTE'));
    await stop();
    assert.equal(await text.inputValue(), 'NOUVEAU TEXTE\n');
    console.log('OK: an already-open Python file sees edits made during execution.');

    await start('with open("conserve.txt", "w") as fd:\n    fd.write("conservé après arrêt")\nwhile True:\n    print("x" * 1000)');
    // A cold Worker may still be loading when Stop appears on the published site.
    // Wait for the write and output before testing their retention and size limit.
    await page.waitForFunction(() =>
      document.querySelector('textarea[aria-label="conserve.txt"]')?.value === 'conservé après arrêt'
      && document.getElementById('output').textContent.includes('x'.repeat(1000)), null, {timeout: 60000});
    await page.locator('#stopPython').waitFor({state: 'visible', timeout: 8000});
    assert((await page.locator('#output').innerText()).length <= 100000);
    await stop();
    assert.equal(await page.locator('textarea[aria-label="conserve.txt"]').inputValue(), 'conservé après arrêt');
    promptAnswer = 'Alice';
    assert.equal(await run('print(input("Prénom"))'), 'Alice\n');
    promptAnswer = '';
    assert.equal(await run('print(repr(input("Vide")))'), "''\n");
    promptAnswer = 'Élève 🐢';
    assert.equal(await run('a = input("Premier")\nb = input("Second")\nprint(a, b)'), 'Élève 🐢 Élève 🐢\n');
    promptAnswer = null;
    assert((await run('input("Annuler")')).includes('EOFError'));
    promptAnswer = 'Alice';
    assert.equal(await run('print(input("Reprise"))'), 'Alice\n');
    if (lan) {
      assert.equal(await run('print(input("Attente réseau"))', 40000), 'réponse différée\n');
      console.log('OK: input stays usable after the HTTP wait is renewed.');
    }
    assert.equal(await run('import sys\nprint("avant")\nsys.exit("Abandon")'), 'avant\nAbandon\n');
    const error = await run('print("avant")\nopen("absent.txt")');
    assert(error.includes('avant\nErreur :: à la ligne 2') && error.includes('FileNotFoundError'), error);
    assert.equal(await page.locator('#gutter .err').getAttribute('data-line'), '2');
    assert.equal(await run('with open("essai.txt", "a") as fd:\n    print("FIN", file=fd)\nwith open("essai.txt") as fd:\n    print(fd.readlines())'), "['NOUVEAU TEXTE\\n', 'FIN\\n']\n");
    console.log('OK: bounded console, retained writes, input, exceptions, append and readlines.');

    assert.equal(await run('from turtle import *\nt = Turtle()\nt.speed(0)\nt.forward(100)\nprint(t.position())\ndone()'), '(100, 0)\n');
    assert.equal(await run('from turtle import *\nt = Turtle()\nt.speed(0)\nt.forward(50)\nprint(t.position())\ndone()'), '(50, 0)\n', 'Turtle starts afresh in a reused interpreter.');
    await page.locator('#turtlediv svg').waitFor();
    await page.locator('#expandTurtle').click();
    assert(await page.locator('#turtleDialog').evaluate(el => el.open));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#turtleDialog').evaluate(el => el.open), false);
    await page.locator('#clear').click();
    assert.equal(await text.inputValue(), 'NOUVEAU TEXTE\nFIN\n');
    await page.reload({waitUntil: 'domcontentloaded'});
    await ready();
    assert.equal(await text.inputValue(), 'NOUVEAU TEXTE\nFIN\n');
    assert.equal(await page.locator('textarea[aria-label="conserve.txt"]').inputValue(), 'conservé après arrêt');
    await page.screenshot({path: '/tmp/tec-python-interrupt-desktop.png', fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    await start('while True:\n    pass');
    await page.locator('#stopPython').waitFor({state: 'visible', timeout: 8000});
    await page.locator('#stopPython').scrollIntoViewIfNeeded();
    await page.screenshot({path: '/tmp/tec-python-interrupt-mobile.png', fullPage: true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await stop();
    assert.deepEqual(errors, []);
    console.log('OK: Turtle, reload persistence, purple Project menu and red Stop on mobile.');

    const fallback = await browser.newPage();
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    await fallback.addInitScript(() => {
      delete window.showOpenFilePicker;
      delete window.showSaveFilePicker;
    });
    await fallback.goto(url, {waitUntil: 'domcontentloaded'});
    await fallback.waitForFunction(() => !document.getElementById('run').disabled);
    await fallback.locator('#code').fill(savedCode);
    for (const shortcut of ['Control+s', 'F12']) {
      const downloaded = fallback.waitForEvent('download');
      await fallback.keyboard.press(shortcut);
      const download = await downloaded;
      assert(download.suggestedFilename().endsWith('.py'));
      const chunks = [];
      for await (const chunk of await download.createReadStream()) chunks.push(chunk);
      assert.equal(Buffer.concat(chunks).toString('utf8'), savedCode);
    }
    await fallback.close();
    if (lan) {
      const pupil = await browser.newPage();
      pupil.on('pageerror', error => errors.push(error.message));
      await pupil.route('**/*', route => new URL(route.request().url()).origin === origin
        ? route.continue() : route.fulfill({status: 200, body: '{}'}));
      await pupil.goto(url, {waitUntil: 'domcontentloaded'});
      await pupil.waitForFunction(() => !document.getElementById('run').disabled);
      await pupil.locator('#code').fill('with open("conserve.txt", "w") as f:\n    f.write("autre élève")\nwhile True:\n    pass');
      await pupil.locator('#run').click();
      await pupil.waitForFunction(() => document.querySelector('textarea[aria-label="conserve.txt"]')?.value === 'autre élève');
      assert.equal(await run('print(open("conserve.txt").read())'), 'conservé après arrêt\n');
      await pupil.keyboard.press('Escape');
      await pupil.waitForFunction(() => !document.getElementById('run').disabled);
      await pupil.close();
      console.log('OK: HTTP LAN without a secure context; two pupils retain separate files.');
    }
    assert.deepEqual(errors, []);
    console.log('OK: Ctrl+S and F12 download the script when direct saving is unavailable.');

    await page.setViewportSize({width: 1365, height: 960});
    const addFile = page.locator('#addTextFileTab');
    const closeFile = name => page.getByRole('button', {name: `Fermer l’onglet ${name}`, exact: true}).click();
    promptAnswer = 'notes.txt';
    await addFile.click();
    await page.getByRole('textbox', {name: 'notes.txt', exact: true}).fill('Été conservé');
    promptAnswer = 'autre.txt';
    await addFile.click();
    await page.getByRole('textbox', {name: 'autre.txt', exact: true}).fill('Autre contenu');
    await closeFile('notes.txt');
    assert.equal(await page.getByRole('tab', {name: 'autre.txt', exact: true}).getAttribute('aria-selected'), 'true',
      'Closing an inactive tab preserves the selected tab.');
    await closeFile('autre.txt');
    while (await page.locator('#fileTabs .python-file-close').count()) {
      await page.locator('#fileTabs .python-file-close').last().click();
    }
    assert(await addFile.isHidden(), 'Closing the last file hides plus.');
    assert(await page.locator('#fileTabContent').isHidden());
    assert(await page.locator('#exportTextFile').isDisabled());
    assert.equal(await run('with open("notes.txt", "a") as f:\n    f.write(" + Python")\nprint(open("notes.txt").read())'),
      'Été conservé + Python\n');
    assert.equal(await page.locator('#fileTabs [role="tab"]').count(), 0, 'Writing to a closed file keeps its tab closed.');
    await page.reload({waitUntil: 'domcontentloaded'});
    await ready();
    assert.equal(await page.locator('#fileTabs [role="tab"]').count(), 0, 'Closed tabs stay closed after reload.');
    assert(await addFile.isHidden(), 'Plus also stays hidden after reload when all tabs are closed.');
    assert.equal(await run('print(open("notes.txt").read())'), 'Été conservé + Python\n');

    await page.locator('#projectMenu').click();
    const zipDownload = page.waitForEvent('download');
    await page.locator('#exportPythonProject').click();
    const zipChunks = [];
    for await (const chunk of await (await zipDownload).createReadStream()) zipChunks.push(chunk);
    const archivedNotes = await page.evaluate(async base64 => {
      const zip = await JSZip.loadAsync(base64, {base64: true});
      return zip.file('notes.txt').async('string');
    }, Buffer.concat(zipChunks).toString('base64'));
    assert.equal(archivedNotes, 'Été conservé + Python', 'Closed files remain in exported projects.');

    await page.locator('#projectMenu').click();
    await page.locator('#closedTextFileList').getByRole('button', {name: 'notes.txt', exact: true}).click();
    assert.equal(await page.getByRole('textbox', {name: 'notes.txt', exact: true}).inputValue(), 'Été conservé + Python');
    promptAnswer = 'notes.txt';
    await addFile.click();
    assert.equal(await page.getByRole('tab', {name: 'notes.txt', exact: true}).count(), 1, 'Plus never duplicates an existing file.');
    promptAnswer = 'autre.txt';
    await addFile.click();
    assert.equal(await page.getByRole('textbox', {name: 'autre.txt', exact: true}).inputValue(), 'Autre contenu');
    await closeFile('autre.txt');
    assert.equal(await page.getByRole('tab', {name: 'notes.txt', exact: true}).getAttribute('aria-selected'), 'true');
    await page.locator('#projectMenu').click();
    await page.locator('#deleteTextFile').click();
    assert((await run('open("notes.txt")')).includes('FileNotFoundError'), 'Deleting remains distinct from closing.');
    assert.equal(await page.locator('#closedTextFileList').getByRole('button', {name: 'notes.txt', exact: true}).count(), 0);

    promptAnswer = 'donnees.txt';
    assert(await addFile.isHidden(), 'Deleting the last open file hides plus.');
    await page.locator('#projectMenu').click();
    await page.locator('#newTextFile').click();
    assert(await addFile.isVisible(), 'New reveals plus again.');
    await page.getByRole('textbox', {name: 'donnees.txt', exact: true}).fill('Première ligne\nDeuxième ligne\n');
    promptAnswer = 'resultats.txt';
    await addFile.click();
    await page.getByRole('textbox', {name: 'resultats.txt', exact: true}).fill('Résultats du programme');
    await page.screenshot({path: '/tmp/tec-python-tabs-desktop.png', fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    await addFile.scrollIntoViewIfNeeded();
    await page.screenshot({path: '/tmp/tec-python-tabs-mobile.png', fullPage: true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert(await addFile.isVisible());
    await closeFile('resultats.txt');
    promptAnswer = null;
    await addFile.click();
    assert.equal(await page.locator('#fileTabs [role="tab"]').count(), 1, 'Cancelling plus does not create a file.');
    assert.deepEqual(errors, []);
    console.log('OK: plus, tab closing/reopening, retained contents and ZIP, reload, deletion and mobile controls.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
