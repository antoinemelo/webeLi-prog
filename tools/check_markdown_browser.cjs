// Optional browser regression suite. Start ServeurHTTP_Web.py first.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

(async () => {
  const options = {headless: true};
  if (process.env.CHROMIUM_EXECUTABLE) options.executablePath = process.env.CHROMIUM_EXECUTABLE;
  const browser = await chromium.launch(options);
  try {
    const url = process.env.MARKDOWN_LAB_URL || 'http://127.0.0.1:8000/labs/markdown/';
    const origin = new URL(url).origin;
    const page = await browser.newPage({viewport: {width: 1365, height: 960}, locale: 'fr-CH'});
    await page.route('**/*', route => new URL(route.request().url()).origin === origin
      ? route.continue() : route.fulfill({status: 200, body: '{}'}));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const response = await page.goto(url, {waitUntil: 'load'});
    assert.equal(response.status(), 200);
    const samples = [
      ['python', 'def bonjour(nom):\n    return "Bonjour " + nom'],
      ['javascript', 'const resultat = 6 * 7;'],
      ['sql', 'SELECT nom FROM eleves WHERE classe = 2;'],
      ['html', '<script>window.markdownCodeExecuted = true;</script>'],
      ['', 'function total(a, b) { return a + b; }'],
      ['langue-inconnue', '<em title="texte">fichier & texte</em>'],
    ];
    const markdown = '# Vérification Markdown\n\n**gras** et _souligné_\n\n'
      + samples.map(([language, code]) => '```' + language + '\n' + code + '\n```').join('\n\n');
    await page.locator('#code').fill(markdown);
    await page.locator('#preview h1').filter({hasText: 'Vérification Markdown'}).waitFor();
    const blocks = page.locator('#preview pre code');
    assert.equal(await blocks.count(), samples.length);
    for (let i = 0; i < samples.length; i++) {
      assert.equal(await blocks.nth(i).textContent(), samples[i][1] + '\n');
      if (i < 5) assert(await blocks.nth(i).locator('span[class^="hljs-"]').count() > 0);
    }
    assert.equal(await page.locator('#preview script, #preview pre code em').count(), 0);
    assert.equal(await page.evaluate(() => window.markdownCodeExecuted), undefined);
    assert.equal(await page.locator('#preview u').textContent(), 'souligné');
    console.log('OK: Python, JavaScript, SQL, HTML and automatic highlighting; unknown languages remain escaped text.');

    for (const [theme, keywordColor] of [['light', 'rgb(215, 58, 73)'], ['dark', 'rgb(255, 123, 114)']]) {
      await page.evaluate(mode => window.Theme.apply(mode), theme);
      await page.waitForFunction(color => getComputedStyle(document.querySelector('#preview .hljs-keyword')).color === color, keywordColor);
    }
    await page.evaluate(() => window.Theme.apply('light'));
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#preview .hljs-keyword')).color === 'rgb(215, 58, 73)');
    console.log('OK: code colors follow the light and dark themes.');

    await page.reload({waitUntil: 'load'});
    assert.equal(await page.locator('#code').inputValue(), markdown);
    await page.locator('#preview .hljs-keyword').first().waitFor();
    await page.locator('#code').press('ControlOrMeta+Home');
    await page.screenshot({path: '/tmp/tec-markdown-highlight-desktop.png', fullPage: true});
    const downloading = page.waitForEvent('download');
    await page.locator('#dropdownFiles').click();
    await page.locator('#exportHtml').click();
    const download = await downloading;
    assert(download.suggestedFilename().endsWith('.html'));
    const exported = await fs.readFile(await download.path(), 'utf8');
    assert(exported.includes('hljs-keyword'));
    assert(!exported.includes('<script>window.markdownCodeExecuted'));
    console.log('OK: reload persistence and HTML export preserve code without executing it.');

    // Missing optional highlighting must not break the Markdown renderer.
    await page.route('**/highlight_min.js', route => route.fulfill({status: 200, body: ''}));
    await page.reload({waitUntil: 'load'});
    assert.equal(await page.locator('#code').inputValue(), markdown);
    assert.equal(await blocks.nth(0).textContent(), samples[0][1] + '\n');
    assert.equal(await page.locator('#preview .hljs-keyword').count(), 0);
    assert.deepEqual(errors, []);
    console.log('OK: plain-code fallback when highlighting is unavailable; no JavaScript errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
