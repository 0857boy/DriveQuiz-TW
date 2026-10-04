import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, extname, sep } from 'node:path';
import { chromium } from '@playwright/test';
const root = resolve('dist');
const prefix = '/drivequiz-tw/';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
};
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (!path.startsWith(prefix)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const file = resolve(root, path.slice(prefix.length) || 'index.html');
  if (!file.startsWith(root + sep) || !existsSync(file)) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.setHeader('content-type', types[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(4175, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.platform === 'win32'
        ? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
        : undefined,
  });
  const context = await browser.newContext(),
    page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = 'http://127.0.0.1:4175' + prefix;
  await page.goto(base + '#/mock');
  await page.getByRole('button', { name: '開始測驗 · 30:00' }).waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      );
  });
  await page.getByRole('button', { name: '開始測驗 · 30:00' }).click();
  await page.getByTestId('exam-timer').waitFor();
  await page.getByRole('group', { name: '選擇答案' }).getByRole('button').first().click();
  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('exam-timer').waitFor();
  if (
    (await page
      .getByRole('group', { name: '選擇答案' })
      .getByRole('button')
      .first()
      .getAttribute('aria-pressed')) !== 'true'
  )
    throw Error('Offline answer did not restore');
  await page.getByRole('button', { name: '交卷並查看結果' }).click();
  await page.getByRole('button', { name: '確認交卷', exact: true }).click();
  await page.getByTestId('result-score').waitFor();
  await page.goto(base + '#/bank');
  await page.getByRole('textbox', { name: '搜尋題號或關鍵字' }).fill('183');
  await page.getByRole('button', { name: '查看題目與答案' }).click();
  const image = page.getByRole('img', { name: '第 183 題的交通圖示' });
  await image.waitFor();
  if (!(await image.evaluate((img) => img.complete && img.naturalWidth > 0)))
    throw Error('Image not available offline');
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'PASS: GitHub Pages subpath, service worker cache, offline exam resume, offline grading, offline image bank, no runtime errors.',
  );
} finally {
  await browser?.close();
  server.close();
}
