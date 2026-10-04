import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
mkdirSync('tmp/preview', { recursive: true });
const browser = await chromium.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1060 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button', { name: '開始智慧複習' }).waitFor();
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: 'tmp/preview/home-desktop.png', fullPage: true });
await page.goto('http://127.0.0.1:5173/#/mock');
await page.getByRole('button', { name: '開始測驗 · 30:00' }).waitFor();
await page.screenshot({ path: 'tmp/preview/mock-desktop.png', fullPage: true });
await page.getByRole('button', { name: '開始測驗 · 30:00' }).click();
await page.screenshot({ path: 'tmp/preview/exam-desktop.png', fullPage: true });
await page.getByRole('group', { name: '選擇答案' }).getByRole('button').first().click();
await page.getByRole('button', { name: '交卷並查看結果' }).click();
await page.getByRole('button', { name: '確認交卷', exact: true }).click();
await page.getByTestId('result-score').waitFor();
await page.screenshot({ path: 'tmp/preview/result-desktop.png', fullPage: false });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://127.0.0.1:5173');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole('button', { name: '開始智慧複習' }).waitFor();
await page.screenshot({ path: 'tmp/preview/home-mobile.png', fullPage: true });
await page.goto('http://127.0.0.1:5173/#/mock');
await page.getByRole('button', { name: '開始測驗 · 30:00' }).waitFor();
await page.screenshot({ path: 'tmp/preview/mock-mobile.png', fullPage: true });
await page.getByRole('button', { name: '開始測驗 · 30:00' }).click();
await page.screenshot({ path: 'tmp/preview/exam-mobile.png', fullPage: true });
await page.goto('http://127.0.0.1:5173/#/settings');
await page.getByRole('switch', { name: '深色模式' }).click();
await page.goto('http://127.0.0.1:5173/#/practice');
await page.screenshot({ path: 'tmp/preview/exam-mobile-dark.png', fullPage: true });
console.log(JSON.stringify({ screenshots: 8, runtimeErrors: errors }));
await browser.close();
