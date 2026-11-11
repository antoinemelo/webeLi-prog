// Set WORKSHOP_BASE_URL to verify a deployment; profiles contain test data only.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const options = {headless: true, args: ['--host-resolver-rules=MAP atelier.test 127.0.0.1', '--no-proxy-server']};
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  const base = process.env.WORKSHOP_BASE_URL || 'http://atelier.test:8000/';
  const origin = new URL(base).origin;
  const errors = [];
  async function newPage(lab, init) {
    const context = await browser.newContext({viewport: {width: 1365, height: 960}, locale: 'fr-CH'});
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`${lab}: ${error.message}`));
    page.on('dialog', dialog => dialog.accept(dialog.type() === 'prompt' ? 'style.css' : undefined));
    await page.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    // Exercise the portable import/download flow on HTTP and HTTPS alike.
    await page.addInitScript(() => {
      delete window.showOpenFilePicker;
      delete window.showSaveFilePicker;
      delete window.showDirectoryPicker;
    });
    if (init) await page.addInitScript(init);
    await page.goto(new URL(`labs/${lab}/`, base).href, {waitUntil: 'load'});
    if (lab === 'python') await page.waitForFunction(() => window.pythonScripts?.current());
    else await page.waitForFunction(() => window.workshopDocuments && !workshopDocuments.busy());
    return page;
  }
  async function archive(page, button) {
    const pending = page.waitForEvent('download');
    await page.locator('#' + button).evaluate(el => el.click());
    const download = await pending;
    assert(download.suggestedFilename().endsWith('.zip'));
    const buffer = await fs.readFile(await download.path());
    return page.evaluate(async bytes => {
      const zip = await JSZip.loadAsync(new Uint8Array(bytes)), result = {};
      for (const file of Object.values(zip.files)) {
        if (file.dir) continue;
        result[file.name] = /\.(sqlite|db)$/i.test(file.name) ? [...await file.async('uint8array')] : await file.async('string');
      }
      return result;
    }, [...buffer]);
  }
  const idle = page => page.waitForFunction(() => !workshopDocuments.busy());
  const click = (page, id) => page.locator('#' + id).evaluate(el => el.click());
  try {
    // Existing per-document CSS is migrated into one shared collection without loss.
    const html = await newPage('html', () => {
      if (window.top !== window) return;
      if (sessionStorage.getItem('migrationFixture')) return;
      sessionStorage.setItem('migrationFixture', '1');
      localStorage.setItem('html_editor_documents_v1', JSON.stringify({activeId: 1, documents: [
        {id: 1, name: 'same.html', code: '<link rel="stylesheet" href="style.css"><h1>Rouge</h1>',
          extras: {files: [{name: 'style.css', value: 'h1 {color:red}', closed: false}], activeName: 'style.css'}},
        {id: 2, name: 'same.html', code: '<link rel="stylesheet" href="style.css"><h1>Bleu</h1>',
          extras: {files: [{name: 'style.css', value: 'h1 {color:blue}', closed: false}], activeName: 'style.css'}}
      ]}));
    });
    const ht = html.locator('#documentBadges [role="tab"]');
    assert.equal(await html.locator('#fileTabsCss [role="tab"]').count(), 2);
    const cssNames = await html.locator('#fileTabsCss [role="tab"]').allTextContents();
    assert.deepEqual(cssNames, ['style.css', 'style-2.css']);
    await ht.last().click();
    assert((await html.locator('#code').inputValue()).includes('style-2.css'));
    assert.equal(await html.locator('#fileTabsCss [role="tab"]').count(), 2);
    await click(html, 'run'); await idle(html);
    assert.equal(await html.frameLocator('#preview').locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(0, 0, 255)');
    await html.locator('#addDocument').click();
    assert.equal(await html.locator('#fileTabsCss [role="tab"]').count(), 2);
    assert(await html.locator('#addDocument').isHidden());
    await html.locator('#code').fill('<link rel="stylesheet" href="style.css"><h1>Troisième</h1>');
    await click(html, 'run'); await idle(html);
    assert.equal(await html.frameLocator('#preview').locator('h1').evaluate(el => getComputedStyle(el).color), 'rgb(255, 0, 0)');
    // Last active CSS and its editor node persist when selecting/resetting documents.
    await html.locator('#fileTabsCss [role="tab"]').last().click();
    await html.locator('.css-text-file').last().fill('h1 {color:purple}');
    await ht.first().click();
    assert.equal(await html.locator('#fileTabsCss [aria-selected="true"]').textContent(), 'style-2.css');
    assert.equal(await html.locator('.css-text-file').last().inputValue(), 'h1 {color:purple}');
    await click(html, 'reset');
    assert.equal(await html.locator('#fileTabsCss [role="tab"]').count(), 2);
    // Restore two equal script filenames to exercise ZIP collisions.
    await html.evaluate(() => workshopDocuments.loaded('<h1>Premier actuel</h1>', 'same.html'));
    await html.locator('.css-file-close').last().click();
    await html.reload({waitUntil: 'load'});
    assert.equal(await html.locator('#fileTabsCss [role="tab"]:visible').count(), 1);
    await ht.last().click();
    assert.equal(await html.locator('#fileTabsCss [role="tab"]:visible').count(), 1);
    const htmlZip = await archive(html, 'exportHtmlProject');
    assert.equal(Object.keys(htmlZip).filter(name => name.endsWith('.html')).length, 3);
    assert.equal(htmlZip['same.html'], '<h1>Premier actuel</h1>');
    assert(htmlZip['same-2.html'].includes('Bleu'));
    assert.equal(htmlZip['style.css'], 'h1 {color:red}');
    assert.equal(htmlZip['style-2.css'], 'h1 {color:purple}', 'closed CSS is included');
    await html.screenshot({path: '/tmp/tec-html-shared-css.png', fullPage: true});
    console.log('OK HTML: shared CSS tabs, old storage migration with conflicting names, reset/reload, three HTML files and all CSS in ZIP.');

    const md = await newPage('markdown');
    await md.evaluate(() => workshopDocuments.loaded('# Premier', 'same.md'));
    await md.locator('#addDocument').click();
    await md.evaluate(() => workshopDocuments.loaded('# Deuxième', 'same.md'));
    await md.locator('#addDocument').click();
    await md.locator('#code').fill('# Troisième non enregistré');
    const mdZip = await archive(md, 'exportProject');
    assert.equal(Object.keys(mdZip).length, 3);
    assert.equal(mdZip['same.md'], '# Premier');
    assert.equal(mdZip['same-2.md'], '# Deuxième');
    assert(Object.values(mdZip).includes('# Troisième non enregistré'));
    // Snapshot at click time; editing during ZIP compression stays unsaved.
    await md.evaluate(() => {
      const original = JSZip.prototype.generateAsync;
      JSZip.prototype.generateAsync = async function(options) {
        await new Promise(resolve => { window.releaseZip = resolve; });
        JSZip.prototype.generateAsync = original;
        return original.call(this, options);
      };
    });
    const mdPending = archive(md, 'exportProject');
    await md.waitForFunction(() => window.releaseZip);
    assert(await md.locator('#documentBadges [role="tab"]').first().isDisabled());
    await md.locator('#code').fill('# Modifié pendant ZIP');
    await md.evaluate(() => releaseZip());
    const snapshotZip = await mdPending;
    assert(Object.values(snapshotZip).includes('# Troisième non enregistré'));
    assert((await md.locator('#documentBadges [aria-selected="true"]').textContent()).includes('●'));
    console.log('OK Markdown: all three documents, duplicate names, unsaved edits, consistent ZIP snapshot.');

    const py = await newPage('python');
    await py.evaluate(() => pythonScripts.loaded('print("un")', 'same.py'));
    await py.locator('#addPythonScript').click();
    await py.evaluate(() => pythonScripts.loaded('print("deux")', 'same.py'));
    await py.locator('#addPythonScript').click();
    await py.locator('#code').fill('print("trois non enregistré")');
    const chooser = py.waitForEvent('filechooser');
    await click(py, 'importTextFiles');
    await (await chooser).setFiles([
      {name: 'same.py', mimeType: 'text/plain', buffer: Buffer.from('fichier de données')},
      {name: 'noms.txt', mimeType: 'text/plain', buffer: Buffer.from('Alice\nBob')}
    ]);
    await py.locator('#fileTabs [role="tab"]').filter({hasText: 'noms.txt'}).waitFor();
    await py.locator('.python-file-close').last().click();
    const pyZip = await archive(py, 'exportPythonProject');
    assert.equal(Object.keys(pyZip).length, 5);
    assert.equal(pyZip['same.py'], 'fichier de données');
    assert.equal(pyZip['same-2.py'], 'print("un")');
    assert.equal(pyZip['same-3.py'], 'print("deux")');
    assert(Object.values(pyZip).includes('print("trois non enregistré")'));
    assert.equal(pyZip['noms.txt'], 'Alice\nBob');
    console.log('OK Python: three scripts, all data files including closed tabs, no collisions with script names.');

    const sql = await newPage('sql', () => {
      if (window.top !== window) return;
      if (sessionStorage.getItem('sqlFixture')) return;
      sessionStorage.setItem('sqlFixture', '1');
      localStorage.setItem('sql_editor_code_v3', '-- Ancienne session\nSELECT 42;');
    });
    assert.equal(await sql.locator('#code').inputValue(), '-- Ancienne session\nSELECT 42;');
    const st = sql.locator('#documentBadges [role="tab"]');
    await sql.evaluate(() => workshopDocuments.loaded('CREATE TABLE test(val TEXT); INSERT INTO test VALUES ("premier"); SELECT * FROM test;', 'same.sql'));
    await click(sql, 'run'); await idle(sql);
    assert((await sql.locator('#output').innerText()).includes('premier'));
    await sql.locator('#code').evaluate(el => { el.setSelectionRange(5, 10); el.dispatchEvent(new Event('select')); });
    const firstResult = await sql.locator('#output').innerHTML();
    await sql.locator('#addDocument').click();
    assert.equal(await sql.locator('#output').innerHTML(), firstResult);
    await sql.evaluate(() => workshopDocuments.loaded('INSERT INTO test VALUES ("deuxième"); SELECT * FROM test;', 'same.sql'));
    // Execution uses the lock, and both statements operate on the same database.
    await sql.evaluate(() => {
      const original = db.exec.bind(db);
      db.exec = (...args) => {
        window.wasLocked = workshopDocuments.busy() && document.querySelector('#documentBadges [role="tab"]').disabled;
        return original(...args);
      };
    });
    await click(sql, 'run'); await idle(sql);
    assert(await sql.evaluate(() => window.wasLocked));
    assert((await sql.locator('#output').innerText()).includes('premier'));
    assert((await sql.locator('#output').innerText()).includes('deuxième'));
    await st.first().click();
    assert.deepEqual(await sql.locator('#code').evaluate(el => [el.selectionStart, el.selectionEnd]), [5, 10]);
    await st.last().click();
    await sql.locator('#code').fill('SELECT 123;'); await sql.locator('#code').press('Control+z');
    assert((await sql.locator('#code').inputValue()).includes('deuxième'));
    await sql.locator('#addDocument').click();
    assert.equal(await st.count(), 3); assert(await sql.locator('#addDocument').isHidden());
    await sql.locator('#code').fill('SELECT COUNT(*) AS total FROM test;');
    await click(sql, 'run'); await idle(sql);
    assert.equal(await sql.locator('#output tbody td').textContent(), '2');
    await click(sql, 'reset');
    assert.equal(await sql.evaluate(() => db.exec('SELECT COUNT(*) FROM test')[0].values[0][0]), 2);
    await sql.locator('#code').fill('SELECT * FROM test;');
    await sql.reload({waitUntil: 'load'}); await idle(sql);
    assert.equal(await st.count(), 3); assert.equal(await sql.locator('#code').inputValue(), 'SELECT * FROM test;');
    await click(sql, 'run'); await idle(sql);
    assert((await sql.locator('#output').innerText()).includes('deuxième'));
    const scriptDownload = sql.waitForEvent('download');
    await sql.keyboard.press('Control+s');
    const sqlFile = await scriptDownload;
    assert(sqlFile.suggestedFilename().endsWith('.sql'));
    assert.equal(await fs.readFile(await sqlFile.path(), 'utf8'), 'SELECT * FROM test;');
    await idle(sql);
    const sqlZip = await archive(sql, 'exportProject');
    assert.equal(Object.keys(sqlZip).filter(name => name.endsWith('.sql')).length, 3);
    assert(sqlZip['same.sql'].includes('CREATE TABLE'));
    assert(sqlZip['same-2.sql'].includes('INSERT INTO'));
    const dbName = Object.keys(sqlZip).find(name => name.endsWith('.sqlite'));
    assert(dbName);
    assert.equal(Buffer.from(sqlZip[dbName]).subarray(0, 15).toString(), 'SQLite format 3');
    assert.deepEqual(await sql.evaluate(bytes => {
      const copy = new SQL.Database(new Uint8Array(bytes));
      const values = copy.exec('SELECT val FROM test ORDER BY rowid')[0].values; copy.close(); return values;
    }, sqlZip[dbName]), [['premier'], ['deuxième']]);
    // A failed statement preserves completed statements in the shared stored database.
    await sql.locator('#code').fill('INSERT INTO test VALUES ("avant erreur"); SELECT * FROM absent;');
    await click(sql, 'run'); await idle(sql);
    await sql.reload({waitUntil: 'load'}); await idle(sql);
    assert.equal(await sql.evaluate(() => db.exec('SELECT COUNT(*) FROM test')[0].values[0][0]), 3);
    await sql.locator('#code').fill('SELECT * FROM test;');
    await click(sql, 'run'); await idle(sql);
    await sql.screenshot({path: '/tmp/tec-sql-project-desktop.png', fullPage: true});
    await sql.setViewportSize({width: 390, height: 844});
    await sql.screenshot({path: '/tmp/tec-sql-project-mobile.png', fullPage: true});
    await click(sql, 'resetDB'); await idle(sql);
    assert.equal(await st.count(), 3);
    assert.equal(await sql.evaluate(() => db.exec("SELECT name FROM sqlite_master WHERE name='test'").length), 0);
    const dbChooser = sql.waitForEvent('filechooser');
    await click(sql, 'importDB');
    await (await dbChooser).setFiles({name: 'projet.sqlite', mimeType: 'application/octet-stream', buffer: Buffer.from(sqlZip[dbName])});
    await idle(sql);
    assert.equal(await sql.evaluate(() => db.exec('SELECT COUNT(*) FROM test')[0].values[0][0]), 2);
    const sqlChooser = sql.waitForEvent('filechooser');
    await click(sql, 'openSQL');
    await (await sqlChooser).setFiles({name: 'lecture.sql', mimeType: 'text/sql', buffer: Buffer.from('SELECT val FROM test;')});
    await idle(sql);
    assert.equal(await sql.locator('#code').inputValue(), 'SELECT val FROM test;');
    assert.equal(await st.count(), 3);
    await click(sql, 'run'); await idle(sql);
    assert.equal(await sql.locator('#output tbody tr').count(), 2);
    console.log('OK SQL: migration, three scripts, independent undo/caret, shared database/results, reset/reload/errors, script and SQLite import/export, valid project ZIP.');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
