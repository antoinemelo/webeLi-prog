// Multi-document editing and CSS projects, including the school's insecure HTTP mode.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const options = {headless: true, args: ['--host-resolver-rules=MAP atelier.test 127.0.0.1', '--no-proxy-server']};
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  try {
    for (const lab of ['html', 'markdown']) {
      const extension = lab === 'html' ? 'html' : 'md';
      const context = await browser.newContext({viewport: {width: 1365, height: 960}, locale: 'fr-CH'});
      const page = await context.newPage();
      const errors = [], alerts = [];
      let acceptDiscard = true, promptValue = 'style.css';
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => {
        if (dialog.type() === 'alert') alerts.push(dialog.message());
        return dialog.type() === 'prompt' ? dialog.accept(promptValue)
          : dialog.type() === 'confirm' && !acceptDiscard ? dialog.dismiss() : dialog.accept();
      });
      await page.route('**/*', route => new URL(route.request().url()).hostname === 'atelier.test'
        ? route.continue() : route.fulfill({status: 200, body: '{}'}));
      await page.addInitScript(() => {
        const state = window.fileTest = {pickers: 0, writes: [], name: '', cancel: false, fail: false, hold: false, shared: ''};
        Object.defineProperty(navigator, 'clipboard', {configurable: true, value: {writeText: async text => { state.shared = text; }}});
        window.showSaveFilePicker = async options => {
          ++state.pickers;
          if (state.cancel) { state.cancel = false; throw new DOMException('Cancelled', 'AbortError'); }
          const id = state.pickers, name = options.suggestedName.endsWith('.css') ? options.suggestedName : state.name;
          return {name, createWritable: async () => {
            if (state.fail) { state.fail = false; throw new Error('Simulated write failure'); }
            let content;
            return {write: async text => { content = text; if (state.hold) await new Promise(resolve => { state.release = resolve; }); },
              close: async () => state.writes.push({id, name, content})};
          }};
        };
        window.showOpenFilePicker = async () => [{name: 'imported', getFile: async () => new File([state.openText], state.openName)}];
      });
      await page.goto(`http://atelier.test:8000/labs/${lab}/`, {waitUntil: 'load'});
      await page.waitForFunction(() => window.workshopDocuments);
      assert.equal(await page.evaluate(() => isSecureContext), false);
      const code = page.locator('#code'), tabs = page.locator('#documentBadges [role="tab"]'), add = page.locator('#addDocument');
      const idle = () => page.waitForFunction(() => !workshopDocuments.busy());
      const click = id => page.locator('#' + id).evaluate(element => element.click());
      const save = async name => { await page.evaluate(name => { fileTest.name = name; }, name); await page.keyboard.press('Control+s'); await idle(); };
      assert.equal(await tabs.count(), 1);
      const firstCode = lab === 'html' ? '<!DOCTYPE html><html><head><link href="style.css" rel="stylesheet"></head><body><h1>Premier</h1></body></html>' : '# Premier\n\n**un**';
      const secondCode = lab === 'html' ? '<html><head><link rel="stylesheet" href="style.css"></head><body><h1>Deuxième</h1></body></html>' : '# Deuxième\n\n**deux**';
      await code.fill(firstCode);
      const firstId = await tabs.first().getAttribute('id');
      if (lab === 'html') {
        assert(await page.locator('#addCssFile').isHidden());
        await click('run'); await idle();
        assert(await page.locator('#addCssFile').isHidden(), 'preview must not reveal the CSS +');
        await page.locator('#projectMenu').click(); await page.locator('#newCssFile').click();
        await page.locator('.css-text-file').fill('h1 { color: rgb(1, 2, 3); }');
        await click('run'); await idle();
        await page.frameLocator('#preview').locator('h1').waitFor();
        assert.equal(await page.frameLocator('#preview').locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(1, 2, 3)');
        await page.locator('.css-file-close').click();
        assert(await page.locator('#addCssFile').isHidden());
        await click('run'); await idle();
        assert.equal(await page.frameLocator('#preview').locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(1, 2, 3)');
        assert(await page.locator('#addCssFile').isHidden(), 'running does not reopen closed CSS');
      }
      await save(`first.${extension}`);
      await code.evaluate(el => { el.setSelectionRange(2, 8); el.dispatchEvent(new Event('select')); });
      await add.click();
      await code.fill(secondCode);
      const secondId = await tabs.last().getAttribute('id');
      if (lab === 'html') {
        assert(await page.locator('#addCssFile').isHidden());
        await click('newCssFile');
        assert.equal(await page.locator('.css-text-file').inputValue(), 'h1 { color: rgb(1, 2, 3); }');
        await page.locator('.css-text-file').fill('h1 { color: rgb(4, 5, 6); }');
        await click('run'); await idle();
        assert.equal(await page.frameLocator('#preview').locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(4, 5, 6)');
      } else await page.locator('#preview h1').filter({hasText: 'Deuxième'}).waitFor();
      await save(`second.${extension}`);
      await page.locator('#' + firstId).click();
      assert.equal(await code.inputValue(), firstCode);
      assert.deepEqual(await code.evaluate(el => [el.selectionStart, el.selectionEnd]), [2, 8]);
      assert(await page.locator('#' + firstId).evaluate(el => el.parentElement.classList.contains('text-bg-success')));
      assert(await page.locator('#' + secondId).evaluate(el => el.parentElement.classList.contains('text-bg-info')));
      if (lab === 'html') {
        assert(await page.locator('#addCssFile').isVisible());
        assert.equal(await page.locator('.css-text-file').inputValue(), 'h1 { color: rgb(4, 5, 6); }');
      } else await page.locator('#preview h1').filter({hasText: 'Premier'}).waitFor();
      await code.fill(firstCode + '\n<!-- one -->');
      await save('ignored');
      const writes = await page.evaluate(() => fileTest.writes);
      assert.equal(writes.at(lab === 'html' ? -2 : -1).name, `first.${extension}`, 'save uses the active document handle');
      assert.equal(writes.at(lab === 'html' ? -2 : -1).id, writes[0].id);
      await page.locator('#' + secondId).click();
      await code.fill(secondCode + '\n<!-- second edit -->');
      await code.press('Control+z');
      assert.equal(await code.inputValue(), secondCode, 'undo is local to this document');
      await add.click();
      assert.equal(await tabs.count(), 3); assert(await add.isHidden());
      await code.fill('third unsaved');
      acceptDiscard = false;
      await page.locator('.document-close').last().click(); assert.equal(await tabs.count(), 3);
      acceptDiscard = true;
      await page.locator('.document-close').last().click(); assert.equal(await tabs.count(), 2); assert(await add.isVisible());
      await page.locator('#' + firstId).click();
      // Changes made while an asynchronous write is pending remain unsaved.
      await page.evaluate(() => { fileTest.hold = true; });
      await page.keyboard.press('Control+s');
      await page.waitForFunction(() => fileTest.release);
      assert(await add.isDisabled()); assert(await tabs.first().isDisabled());
      await code.fill(firstCode + '\n<!-- edited during save -->');
      await page.evaluate(() => { fileTest.hold = false; fileTest.release(); }); await idle();
      assert((await tabs.first().textContent()).includes('●'));
      await page.evaluate(() => { fileTest.cancel = true; });
      await click(lab === 'html' ? 'saveAsLocal' : 'saveAs'); await idle();
      assert((await tabs.first().textContent()).startsWith('first.'));
      await page.evaluate(() => { fileTest.fail = true; });
      await click(lab === 'html' ? 'saveAsLocal' : 'saveAs'); await idle();
      assert((await tabs.first().textContent()).startsWith('first.')); assert.equal(alerts.length, 1);
      const shareId = lab === 'html' ? 'copyLink' : 'share-both';
      await click(shareId); await page.waitForFunction(() => fileTest.shared);
      const shared = await page.evaluate(() => fileTest.shared);
      const beforeReload = await code.inputValue();
      if (lab === 'html') await page.locator('.css-file-close').click();
      await page.reload({waitUntil: 'load'});
      assert.equal(await tabs.count(), 2); assert.equal(await code.inputValue(), beforeReload);
      assert((await tabs.first().textContent()).startsWith('first.'));
      if (lab === 'html') {
        assert(await page.locator('#addCssFile').isHidden());
        await page.locator('#projectMenu').click(); await page.locator('#closedCssFileList button').click();
        assert.equal(await page.locator('.css-text-file').inputValue(), 'h1 { color: rgb(4, 5, 6); }');
        await page.locator('#run').click(); await idle();
        await page.screenshot({path: '/tmp/tec-html-css-project-desktop.png', fullPage: true});
        await page.setViewportSize({width: 390, height: 844});
        await page.screenshot({path: '/tmp/tec-html-css-project-mobile.png', fullPage: true});
        await page.setViewportSize({width: 1365, height: 960});
      }
      await page.locator('#' + secondId).click();
      await click('reset');
      await page.locator('#' + firstId).click(); assert.equal(await code.inputValue(), beforeReload);
      await page.evaluate(({extension}) => { fileTest.openText = 'import replaces only active'; fileTest.openName = `import.${extension}`; }, {extension});
      await click('openLocal'); await idle(); assert.equal(await code.inputValue(), 'import replaces only active');
      await page.locator('#' + secondId).click(); assert.notEqual(await code.inputValue(), 'import replaces only active');
      await page.screenshot({path: `/tmp/tec-${lab}-documents-desktop.png`, fullPage: true});
      await page.setViewportSize({width: 390, height: 844});
      await page.screenshot({path: `/tmp/tec-${lab}-documents-mobile.png`, fullPage: true});
      assert(await add.isVisible());
      assert.deepEqual(errors, []);
      console.log(`OK ${lab}: three documents, active commands, independent undo/caret, shared CSS, save lock/cancel/failure, reload, reset, open, mobile.`);
      // Real HTTP fallback: no File System Access API and no clipboard API.
      const fallback = await browser.newContext({viewport: {width: 1365, height: 960}});
      const fp = await fallback.newPage();
      const fallbackErrors = [];
      fp.on('pageerror', error => fallbackErrors.push(error.message));
      fp.on('dialog', dialog => dialog.type() === 'prompt' ? dialog.accept('style.css') : dialog.accept());
      await fp.route('**/*', route => new URL(route.request().url()).hostname === 'atelier.test' ? route.continue() : route.fulfill({status: 200, body: '{}'}));
      await fp.goto(shared, {waitUntil: 'load'});
      assert((await fp.locator('#code').inputValue()).includes('edited during save'));
      if (lab === 'html') assert((await fp.locator('#code').inputValue()).includes('rgb(4, 5, 6)'));
      await fp.reload({waitUntil: 'load'}); assert.equal(await fp.locator('#documentBadges [role="tab"]').count(), 1);
      assert.equal(await fp.evaluate(() => typeof showSaveFilePicker), 'undefined');
      await fp.locator('#code').fill(firstCode);
      if (lab === 'html') {
        const chooser = fp.waitForEvent('filechooser');
        await fp.locator('#importCssFiles').evaluate(el => el.click());
        await (await chooser).setFiles({name: 'style.css', mimeType: 'text/css', buffer: Buffer.from('h1 { color: purple; }')});
        await fp.waitForFunction(() => !workshopDocuments.busy());
        assert.equal(await fp.locator('.css-text-file').inputValue(), 'h1 { color: purple; }');
        await fp.locator('.css-file-close').click();
      }
      const downloading = fp.waitForEvent('download'); await fp.keyboard.press('Control+s');
      const download = await downloading;
      const buffer = await fs.readFile(await download.path());
      if (lab === 'html') {
        assert(download.suggestedFilename().endsWith('.zip'));
        const entries = await fp.evaluate(async bytes => {
          const zip = await JSZip.loadAsync(new Uint8Array(bytes));
          return Promise.all(Object.keys(zip.files).map(async name => [name, await zip.files[name].async('string')]));
        }, [...buffer]);
        assert(entries.some(([name, text]) => name === 'style.css' && text === 'h1 { color: purple; }'));
        const chooser = fp.waitForEvent('filechooser'); await fp.locator('#openLocal').evaluate(el => el.click());
        await (await chooser).setFiles({name: download.suggestedFilename(), mimeType: 'application/zip', buffer});
        await fp.waitForFunction(() => !workshopDocuments.busy());
        assert.equal(await fp.locator('.css-text-file').inputValue(), 'h1 { color: purple; }');
      } else assert.equal(buffer.toString(), firstCode);
      assert((await fp.locator('#documentBadges [role="tab"]').first().textContent()).includes('.' + extension));
      await fp.locator('#' + shareId).evaluate(el => el.click());
      if (lab === 'html') {
        const imageCode = '<h1>Image locale</h1><img src="photo.svg">';
        const chooseImage = async color => {
          await fp.locator('#code').fill(imageCode);
          const chooser = fp.waitForEvent('filechooser');
          await fp.locator('#run').click();
          await (await chooser).setFiles({name: 'photo.svg', mimeType: 'image/svg+xml',
            buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="${color}"/></svg>`)});
          await fp.waitForFunction(() => !workshopDocuments.busy());
          await fp.frameLocator('#preview').locator('img').waitFor();
          const img = fp.frameLocator('#preview').locator('img');
          await img.evaluate(el => el.decode());
          return img.getAttribute('src');
        };
        const firstImage = await chooseImage('red');
        await fp.locator('#addDocument').click();
        const secondImage = await chooseImage('blue');
        assert.notEqual(firstImage, secondImage);
        await fp.locator('#documentBadges [role="tab"]').first().click();
        await fp.locator('#run').click(); await fp.waitForFunction(() => !workshopDocuments.busy());
        assert.equal(await fp.frameLocator('#preview').locator('img').getAttribute('src'), firstImage);
        await fp.locator('#documentBadges [role="tab"]').last().click();
        assert.equal(await fp.frameLocator('#preview').locator('img').getAttribute('src'), secondImage);
        console.log('OK html: image files with the same name remain independent across documents.');
      }
      assert.deepEqual(fallbackErrors, []);
      console.log(`OK ${lab}: HTTP import/download, shared links, clipboard fallback${lab === 'html' ? ', CSS ZIP round trip' : ''}.`);
      await fallback.close(); await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
