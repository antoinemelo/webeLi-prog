// Run against ServeurHTTP_Complet.py; all profiles and file handles are test-only.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');

(async () => {
  const options = {headless: true};
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const lan = process.env.PYTHON_LAB_HTTP_LAN === '1';
  if (lan) options.args = ['--host-resolver-rules=MAP atelier.test 127.0.0.1', '--no-proxy-server'];
  const url = process.env.PYTHON_LAB_URL || (lan
    ? 'http://atelier.test:8000/labs/python/' : 'http://127.0.0.1:8000/labs/python/');
  const origin = new URL(url).origin;
  const browser = await chromium.launch(options);
  try {
    const page = await browser.newPage({viewport: {width: 1365, height: 960}, locale: 'fr-CH'});
    const errors = [];
    const alerts = [];
    let acceptDiscard = true;
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', dialog => {
      if (dialog.type() === 'alert') alerts.push(dialog.message());
      return dialog.type() === 'confirm' && !acceptDiscard ? dialog.dismiss() : dialog.accept();
    });
    await page.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    await page.addInitScript(() => {
      const state = window.scriptFileTest = {pickers: 0, writes: [], cancel: false, fail: false, hold: false, shared: ''};
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {
        writeText: async text => { state.shared = text; }
      }});
      window.showOpenFilePicker = async () => [{getFile: async () =>
        new File([state.openText || 'print("chargé")'], 'charge.py', {type: 'text/x-python'})}];
      window.showSaveFilePicker = async options => {
        ++state.pickers;
        if (state.cancel) { state.cancel = false; throw new DOMException('Cancelled', 'AbortError'); }
        const id = state.pickers;
        return {name: options.suggestedName, createWritable: async () => {
          if (state.fail) { state.fail = false; throw new Error('Échec simulé'); }
          let content;
          return {
            write: async text => {
              content = text;
              if (state.hold) await new Promise(resolve => { state.release = resolve; });
            },
            close: async () => { state.writes.push({id, name: options.suggestedName, content}); }
          };
        }};
      };
    });
    await page.goto(url, {waitUntil: 'domcontentloaded'});
    const code = page.locator('#code');
    const add = page.locator('#addPythonScript');
    const tabs = page.locator('#scriptBadges [role="tab"]');
    const ready = () => page.waitForFunction(() => !document.getElementById('run').disabled, null, {timeout: 60000});
    const run = async text => {
      await code.fill(text);
      await page.locator('#run').click();
      await ready();
      return page.locator('#output').innerText();
    };
    const saved = count => page.waitForFunction(count => window.scriptFileTest.writes.length === count, count);
    await ready();
    assert.equal(await tabs.count(), 1);
    assert(await add.isVisible());
    assert(await page.locator('#addTextFileTab').isHidden());
    const first = page.locator('#' + await tabs.first().getAttribute('id'));
    const firstCode = '# Alice / Premier\nwith open("commun.txt", "w") as f:\n    f.write("donnée partagée")\nprint("premier")';
    await code.fill(firstCode);
    await page.keyboard.press('Control+s');
    await saved(1);
    const firstName = await first.getAttribute('aria-label');
    await code.evaluate(el => { el.setSelectionRange(10, 15); el.dispatchEvent(new Event('select')); });
    await add.click();
    const second = page.locator('#' + await tabs.last().getAttribute('id'));
    const secondCode = '# Bob / Deuxieme\nprint(open("commun.txt").read())';
    await code.fill(secondCode);
    await page.keyboard.press('Control+s');
    await saved(2);
    const secondName = await second.getAttribute('aria-label');
    assert.notEqual(firstName, secondName);
    assert.equal(await second.getAttribute('aria-selected'), 'true');
    assert(await second.evaluate(el => el.parentElement.classList.contains('text-bg-success')));
    assert(await first.evaluate(el => el.parentElement.classList.contains('text-bg-info')));
    await first.click();
    assert.equal(await code.inputValue(), firstCode);
    assert.deepEqual(await code.evaluate(el => [el.selectionStart, el.selectionEnd]), [10, 15]);
    await page.keyboard.press('Control+s');
    await saved(3);
    await second.click();
    await page.keyboard.press('Control+s');
    await saved(4);
    assert.deepEqual(await page.evaluate(() => window.scriptFileTest.writes.map(write => write.id)), [1, 2, 1, 2]);
    assert.deepEqual(await page.evaluate(() => window.scriptFileTest.writes.map(write => write.content)),
      [firstCode, secondCode, firstCode, secondCode]);
    console.log('OK: separate names, active color, code, caret and writable file handles.');

    await first.click();
    await code.fill(firstCode + '\n# Modification');
    await second.click();
    await first.click();
    await code.press('Control+z');
    assert.equal(await code.inputValue(), firstCode, 'Undo stays inside the selected script.');
    assert.equal(await first.innerText(), firstName, 'Undo restores this script’s own saved state.');
    assert.equal(await run(firstCode), 'premier\n');
    await second.click();
    assert.equal(await page.locator('#output').innerText(), 'premier\n', 'Selecting a script keeps the shared result.');
    assert.equal(await run(secondCode), 'donnée partagée\n');
    await page.locator('#share').click();
    await page.locator('#copyLink').click();
    const shared = new URL(await page.evaluate(() => window.scriptFileTest.shared));
    assert.equal(Buffer.from(shared.searchParams.get('c'), 'base64url').toString('utf8'), secondCode);
    console.log('OK: scoped undo and sharing; sequential execution with common files and results.');

    await code.fill('while True:\n    pass');
    await page.locator('#run').click();
    assert(await first.isDisabled());
    assert(await second.isDisabled());
    assert(await add.isDisabled());
    assert(await page.locator('#reset').isDisabled());
    await first.dispatchEvent('click');
    await add.dispatchEvent('click');
    assert.equal(await tabs.count(), 2);
    assert.equal(await second.getAttribute('aria-selected'), 'true');
    await page.keyboard.press('Escape');
    await ready();
    assert.equal(await first.isDisabled(), false);
    assert.equal(await add.isDisabled(), false);
    assert((await run('1 / 0')).includes('ZeroDivisionError'));
    assert.equal(await first.isDisabled(), false, 'Errors also release the selection lock.');
    await code.fill(secondCode);

    await add.click();
    const third = page.locator('#' + await tabs.last().getAttribute('id'));
    assert.equal(await tabs.count(), 3);
    assert(await add.isHidden());
    await add.dispatchEvent('click');
    assert.equal(await tabs.count(), 3, 'The limit also holds if an event bypasses the hidden button.');
    await code.fill('# Chloé / Troisieme\nprint("troisième")');
    await page.locator('#reset').click();
    assert((await code.inputValue()).includes('Hello world'));
    await first.click();
    assert.equal(await code.inputValue(), firstCode, 'Reset leaves other scripts intact.');
    await third.click();
    await code.fill('print("à conserver")');
    const closeThird = third.locator('..').locator('.python-script-close');
    acceptDiscard = false;
    await closeThird.click();
    assert.equal(await tabs.count(), 3);
    assert.equal(await code.inputValue(), 'print("à conserver")');
    acceptDiscard = true;
    await closeThird.click();
    assert.equal(await tabs.count(), 2);
    assert(await add.isVisible());
    console.log('OK: selection locked during execution, three-script limit, scoped reset and safe closing.');

    await first.click();
    await page.evaluate(() => { window.scriptFileTest.cancel = true; });
    await page.keyboard.press('F12');
    await ready();
    await page.keyboard.press('Control+s');
    await saved(5);
    assert.equal(await page.evaluate(() => window.scriptFileTest.writes.at(-1).id), 1);
    await page.evaluate(() => { window.scriptFileTest.fail = true; });
    await page.keyboard.press('F12');
    await ready();
    assert(alerts.some(text => text.includes('Échec simulé')));
    await page.keyboard.press('Control+s');
    await saved(6);
    assert.equal(await page.evaluate(() => window.scriptFileTest.writes.at(-1).id), 1, 'A failed save does not replace the prior handle.');

    await page.evaluate(() => { window.scriptFileTest.hold = true; });
    await page.keyboard.press('Control+s');
    await page.waitForFunction(() => typeof window.scriptFileTest.release === 'function');
    assert(await second.isDisabled(), 'Switching during an asynchronous save cannot change its target.');
    await code.fill(firstCode + '\n# Après le début de la sauvegarde');
    await page.evaluate(() => { window.scriptFileTest.hold = false; window.scriptFileTest.release(); });
    await saved(7);
    assert.equal(await page.evaluate(() => window.scriptFileTest.writes.at(-1).content), firstCode);
    assert((await first.innerText()).includes('●'), 'New edits remain dirty after a delayed save.');
    const editedFirst = await code.inputValue();
    await second.click();
    await page.reload({waitUntil: 'domcontentloaded'});
    await ready();
    assert.equal(await tabs.count(), 2);
    assert.equal(await second.getAttribute('aria-selected'), 'true');
    assert.equal(await code.inputValue(), secondCode);
    await first.click();
    assert.equal(await code.inputValue(), editedFirst);
    assert((await first.innerText()).includes('●'));
    await page.keyboard.press('Control+s');
    await saved(1);
    assert.equal(await page.evaluate(() => window.scriptFileTest.pickers), 1, 'A reload requests a new disk handle.');
    console.log('OK: cancelled, failed and delayed saves; all scripts, names and dirty states survive reload.');

    await second.click();
    await page.locator('#dropdownFiles').click();
    await page.locator('#openLocal').click();
    await ready();
    assert.equal(await code.inputValue(), 'print("chargé")');
    assert.equal(await second.getAttribute('aria-label'), 'charge.py');
    await first.click();
    assert.equal(await code.inputValue(), editedFirst, 'Opening a file replaces only the active script.');
    await add.click();
    await code.fill('# Chloé / Troisieme\nprint("troisième")');
    await page.keyboard.press('Control+s');
    await saved(2);
    await run('# Chloé / Troisieme\nprint("troisième")');
    await page.screenshot({path: '/tmp/tec-python-scripts-desktop.png', fullPage: true});
    await page.setViewportSize({width: 390, height: 844});
    await page.screenshot({path: '/tmp/tec-python-scripts-mobile.png', fullPage: true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.deepEqual(errors, []);
    console.log('OK: file opening affects only the active script; desktop and mobile layout.');

    const fallback = await browser.newPage({locale: 'fr-CH'});
    let fallbackLink = null;
    fallback.on('dialog', dialog => {
      if (dialog.type() === 'prompt') fallbackLink = dialog.defaultValue();
      return dialog.accept();
    });
    fallback.on('pageerror', error => errors.push(error.message));
    await fallback.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    await fallback.addInitScript(() => {
      delete window.showOpenFilePicker;
      delete window.showSaveFilePicker;
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value: undefined});
    });
    await fallback.goto(url, {waitUntil: 'domcontentloaded'});
    await fallback.waitForFunction(() => !document.getElementById('run').disabled);
    await fallback.locator('#code').fill('# Élève / Réseau\nprint(42)');
    const downloaded = fallback.waitForEvent('download');
    await fallback.keyboard.press('Control+s');
    const download = await downloaded;
    assert.equal(await fallback.locator('#scriptBadges [role="tab"]').getAttribute('aria-label'), download.suggestedFilename());
    await fallback.locator('#addPythonScript').click();
    await fallback.locator('#code').fill('print("second")');
    await fallback.locator('#scriptBadges [role="tab"]').first().click();
    assert.equal(await fallback.locator('#code').inputValue(), '# Élève / Réseau\nprint(42)');
    await fallback.locator('#share').click();
    await fallback.locator('#copyLink').click();
    assert.equal(Buffer.from(new URL(fallbackLink).searchParams.get('c'), 'base64url').toString('utf8'), '# Élève / Réseau\nprint(42)');
    await fallback.close();
    assert.deepEqual(errors, []);
    console.log('OK: HTTP download fallback updates the saved name and keeps scripts separate.');

    const legacy = await browser.newPage({locale: 'fr-CH'});
    legacy.on('pageerror', error => errors.push(error.message));
    await legacy.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    await legacy.addInitScript(() => {
      localStorage.setItem('py_editor_code_v1', '# Ancien projet\nprint("restauré")');
      localStorage.setItem('py_editor_caret_v1', JSON.stringify({s: 3, e: 7}));
    });
    await legacy.goto(url, {waitUntil: 'domcontentloaded'});
    await legacy.waitForFunction(() => !document.getElementById('run').disabled);
    assert.equal(await legacy.locator('#scriptBadges [role="tab"]').count(), 1);
    assert.equal(await legacy.locator('#code').inputValue(), '# Ancien projet\nprint("restauré")');
    assert.deepEqual(await legacy.locator('#code').evaluate(el => [el.selectionStart, el.selectionEnd]), [3, 7]);
    await legacy.close();

    const linked = await browser.newPage({locale: 'fr-CH'});
    linked.on('pageerror', error => errors.push(error.message));
    await linked.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    const linkedCode = 'print("partagé")';
    await linked.goto(url + '?c=' + Buffer.from(linkedCode).toString('base64url'), {waitUntil: 'domcontentloaded'});
    await linked.waitForFunction(() => !document.getElementById('run').disabled);
    assert.equal(await linked.locator('#scriptBadges [role="tab"]').count(), 1);
    assert.equal(await linked.locator('#code').inputValue(), linkedCode);
    await linked.reload({waitUntil: 'domcontentloaded'});
    await linked.waitForFunction(() => !document.getElementById('run').disabled);
    assert.equal(await linked.locator('#scriptBadges [role="tab"]').count(), 1, 'Reloading a shared link does not duplicate its script.');
    await linked.close();
    assert.deepEqual(errors, []);
    console.log('OK: migration from the single-script editor and shared-link loading.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });
