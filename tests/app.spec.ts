import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { updateProgress } from '../src/lib/engine';
const bank = JSON.parse(readFileSync('public/questions/questions.json', 'utf8'));
const questions = bank.questions.slice(0, 50);
const KEY = 'drivequiz:state:v1';
function seed(now: number, correct = 0, expired = false) {
  return {
    app: 'drivequiz-tw',
    schemaVersion: 1,
    data: {
      progress: {},
      attempts: [],
      sessions: [],
      favorites: [],
      settings: { theme: 'light', largeText: false, highContrast: false },
      lastResult: null,
      active: {
        id: 'test-session',
        mode: 'mock',
        questionIds: questions.map((q: any) => q.id),
        position: 0,
        startedAt: expired ? now - 1800001 : now - 10000,
        deadline: expired ? now - 1 : now + 1790000,
        answers: Object.fromEntries(
          questions
            .slice(0, correct)
            .map((q: any) => [
              q.id,
              { selected: q.answer, answeredAt: now - 5000, responseMs: 1000 },
            ]),
        ),
      },
    },
  };
}

test('fresh dashboard and mobile layout have no invented progress or overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '你的弱點地圖，從第一題開始。' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '開啟選單' }).click();
  await page.getByRole('link', { name: '模擬測驗', exact: true }).click();
  await expect(page.getByRole('button', { name: '開始測驗 · 30:00' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('starts at 30:00, hides answers, saves selected choice and timer through refresh', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-04T08:00:00Z') });
  await page.goto('/#/mock');
  await page.getByRole('button', { name: '開始測驗 · 30:00' }).click();
  await expect(page.getByTestId('exam-timer')).toHaveText('30:00');
  await page.getByRole('group', { name: '選擇答案' }).getByRole('button').first().click();
  await expect(page.getByText('官方正解：', { exact: false })).toHaveCount(0);
  await page.clock.fastForward(65000);
  await expect(page.getByTestId('exam-timer')).toHaveText('28:55');
  await page.reload();
  await expect(page.getByTestId('exam-timer')).toHaveText('28:55');
  await expect(
    page.getByRole('group', { name: '選擇答案' }).getByRole('button').first(),
  ).toHaveAttribute('aria-pressed', 'true');
});
test('early submit preserves time and analyzes wrong and unanswered questions', async ({
  page,
}) => {
  await page.goto('/');
  const now = Date.now();
  await page.evaluate(({ KEY, data }) => localStorage.setItem(KEY, JSON.stringify(data)), {
    KEY,
    data: seed(now, 1),
  });
  await page.goto('/#/practice');
  await page.reload();
  await page.getByRole('button', { name: '交卷並查看結果' }).click();
  await expect(page.getByRole('dialog')).toContainText('還有 49 題未作答');
  await page.getByRole('button', { name: '確認交卷', exact: true }).click();
  await expect(page.getByTestId('result-score')).toHaveText('2分');
  await expect(page.getByTestId('remaining-time')).not.toHaveText('00:00');
  await expect(page.getByRole('heading', { name: '錯題分析 49' })).toBeVisible();
  const before = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)!).data, KEY);
  expect(before.attempts).toHaveLength(1);
  const frozenTime = await page.getByTestId('remaining-time').textContent();
  await page.reload();
  const after = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)!).data, KEY);
  expect(after.attempts).toHaveLength(1);
  expect(after.sessions).toHaveLength(1);
  await expect(page.getByTestId('remaining-time')).toHaveText(frozenTime!);
});
test('expired restored exam auto-submits once with 00:00 remaining', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ KEY, data }) => localStorage.setItem(KEY, JSON.stringify(data)), {
    KEY,
    data: seed(Date.now(), 43, true),
  });
  await page.reload();
  await expect(page.getByTestId('result-score')).toHaveText('86分');
  await expect(page.getByTestId('remaining-time')).toHaveText('00:00');
  await expect(page.getByText('✓ 達到及格門檻')).toBeVisible();
  await expect(page.getByText('時間到，系統已自動交卷。')).toBeVisible();
  await page.reload();
  const data = await page.evaluate((KEY) => JSON.parse(localStorage.getItem(KEY)!).data, KEY);
  expect(data.attempts).toHaveLength(43);
  expect(data.sessions).toHaveLength(1);
});
test('live deadline auto-submits even after navigating away', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-04T08:00:00Z') });
  await page.goto('/#/mock');
  await page.getByRole('button', { name: '開始測驗 · 30:00' }).click();
  await page.getByRole('link', { name: '稍後繼續' }).click();
  await page.clock.fastForward(1800000);
  await expect(page.getByTestId('remaining-time')).toHaveText('00:00');
  await expect(page.getByTestId('result-score')).toHaveText('0分');
});
test('practice shows inline feedback and valid record survives reload', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '開始智慧複習' }).click();
  await page.getByRole('group', { name: '選擇答案' }).getByRole('button').first().click();
  await expect(page.getByText('官方正解：', { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByText('官方正解：', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '下一題', exact: true }).click();
  await expect(page.getByText('第 2 / 20 題', { exact: false })).toBeVisible();
});
test('backup exports and invalid import keeps original data', async ({ page }) => {
  await page.goto('/#/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出學習紀錄' }).click();
  expect((await download).suggestedFilename()).toMatch(/drivequiz-backup/);
  await page.locator('input[type=file]').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"app":"wrong"}'),
  });
  await expect(page.getByRole('status')).toContainText('匯入失敗');
  await page.getByRole('button', { name: '清除', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('search renders the image-only options and allows favorite filtering', async ({ page }) => {
  await page.goto('/#/bank');
  await page.getByRole('textbox', { name: '搜尋題號或關鍵字' }).fill('183');
  await page.getByRole('button', { name: '查看題目與答案' }).click();
  await expect(page.getByText('圖中選項 2')).toBeVisible();
  await expect(page.getByRole('img', { name: '第 183 題的交通圖示' })).toBeVisible();
  await page.getByRole('button', { name: '收藏這題' }).first().click();
  await page.getByRole('button', { name: /我的收藏/ }).click();
  await expect(page.getByText('#183', { exact: true })).toBeVisible();
});

test('weakness lists cumulative mistakes, updates their order and retains counts after correct answers', async ({
  page,
}) => {
  const now = Date.now();
  const progress = Object.fromEntries(
    [
      [1, 2, 0],
      [2, 5, 10],
      [3, 5, 1],
      [183, 3, 0],
      [4, 0, 1],
    ].map(([id, wrongCount, correctCount]) => {
      const q = bank.questions.find((q: any) => q.id === id);
      return [
        id,
        {
          attempts: wrongCount + correctCount,
          correctCount,
          wrongCount,
          streak: correctCount,
          lastAnswerCorrect: correctCount > 0,
          lastSelectedAnswer: correctCount > 0 ? q.answer : (q.answer % 3) + 1,
          lastSeenAt: now,
          nextReviewAt: now + 86400000,
          reviewLevel: 5,
          averageResponseMs: 1000,
          fingerprint: q.fingerprint,
        },
      ];
    }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: '開始智慧複習', exact: true }).waitFor();
  await page.evaluate(({ KEY, data }) => localStorage.setItem(KEY, JSON.stringify(data)), {
    KEY,
    data: { ...seed(now), data: { ...seed(now).data, active: null, progress } },
  });
  await page.goto('/#/weakness');
  await page.reload();
  const list = page.getByRole('list', { name: '依累計答錯次數排序的錯題' });
  const ids = list.getByText(/^題號 #/);
  await expect(ids).toHaveText(['題號 #2', '題號 #3', '題號 #183', '題號 #1']);
  await expect(list.getByText('累計答錯 5 次')).toHaveCount(2);
  await expect(page.getByRole('combobox')).toHaveCount(0);
  await expect(page.getByRole('img', { name: '第 183 題的交通圖示' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const answer = bank.questions[0].answer;
  await page.getByRole('button', { name: '練習第 1 題', exact: true }).click();
  await page
    .getByRole('group', { name: '選擇答案' })
    .getByRole('button')
    .nth(answer % 3)
    .click();
  await page.getByRole('button', { name: '查看練習結果' }).click();
  await page.goto('/#/weakness');
  await expect(ids).toHaveText(['題號 #2', '題號 #3', '題號 #1', '題號 #183']);
  await expect(list.getByRole('listitem').nth(2)).toContainText('累計答錯 3 次');

  await page.getByRole('button', { name: '練習第 1 題', exact: true }).click();
  await page
    .getByRole('group', { name: '選擇答案' })
    .getByRole('button')
    .nth(answer - 1)
    .click();
  await page.getByRole('button', { name: '查看練習結果' }).click();
  await page.goto('/#/weakness');
  await page.reload();
  await expect(ids).toHaveText(['題號 #2', '題號 #3', '題號 #1', '題號 #183']);
  await expect(list.getByRole('listitem').nth(2)).toContainText('累計答錯 3 次');
  await page.screenshot({ path: 'test-results/weakness-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1060 });
  await page.screenshot({ path: 'test-results/weakness-desktop.png', fullPage: true });

  await page.getByRole('button', { name: '開始弱點特訓', exact: true }).click();
  const session = await page.evaluate(
    (KEY) => JSON.parse(localStorage.getItem(KEY)!).data.active,
    KEY,
  );
  expect(session.questionIds).toEqual([2, 3, 1, 183]);
});

test('opening another weakness question shows the chosen question instead of the unfinished first one', async ({
  page,
}) => {
  const now = Date.now(),
    saved = seed(now);
  const progress = Object.fromEntries(
    bank.questions
      .slice(0, 3)
      .map((q: any) => [q.id, updateProgress(undefined, q, (q.answer % 3) + 1, 1000, now)]),
  );
  await page.goto('/');
  await page.getByRole('button', { name: '開始智慧複習', exact: true }).waitFor();
  await page.evaluate(({ KEY, data }) => localStorage.setItem(KEY, JSON.stringify(data)), {
    KEY,
    data: {
      ...saved,
      data: {
        ...saved.data,
        progress,
        active: { ...saved.data.active, mode: 'weakness', deadline: undefined, questionIds: [1] },
      },
    },
  });
  await page.goto('/#/weakness');
  await page.reload();
  for (const id of [2, 3]) {
    await page.getByRole('button', { name: `練習第 ${id} 題`, exact: true }).click();
    await expect(page.getByText(new RegExp(`題號 #${id}$`))).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      bank.questions[id - 1].question,
    );
    await expect(page.getByRole('img', { name: `第 ${id} 題的交通圖示` })).toBeVisible();
    await page.getByRole('link', { name: '稍後繼續' }).click();
    await page.goto('/#/weakness');
  }
});

test('opening weakness questions within an existing drill moves to them and preserves previous answers', async ({
  page,
}) => {
  const now = Date.now(),
    saved = seed(now);
  const progress = Object.fromEntries(
    bank.questions
      .slice(0, 3)
      .map((q: any) => [q.id, updateProgress(undefined, q, (q.answer % 3) + 1, 1000, now)]),
  );
  const firstAnswer = {
    selected: bank.questions[0].answer,
    answeredAt: now - 5000,
    responseMs: 1000,
  };
  await page.goto('/');
  await page.getByRole('button', { name: '開始智慧複習', exact: true }).waitFor();
  await page.evaluate(({ KEY, data }) => localStorage.setItem(KEY, JSON.stringify(data)), {
    KEY,
    data: {
      ...saved,
      data: {
        ...saved.data,
        progress,
        active: {
          ...saved.data.active,
          mode: 'weakness',
          deadline: undefined,
          questionIds: [1, 2, 3],
          answers: { 1: firstAnswer },
        },
      },
    },
  });
  await page.goto('/#/weakness');
  await page.reload();
  for (const id of [2, 3]) {
    await page.getByRole('button', { name: `練習第 ${id} 題`, exact: true }).click();
    await expect(page.getByText(`第 ${id} / 3 題 · 題號 #${id}`)).toBeVisible();
    await expect(page.getByRole('img', { name: `第 ${id} 題的交通圖示` })).toBeVisible();
    await page.reload();
    await expect(page.getByText(`第 ${id} / 3 題 · 題號 #${id}`)).toBeVisible();
    const active = await page.evaluate(
      (KEY) => JSON.parse(localStorage.getItem(KEY)!).data.active,
      KEY,
    );
    expect(active.id).toBe(saved.data.active.id);
    expect(active.answers[1]).toEqual(firstAnswer);
    expect(active.position).toBe(id - 1);
    await page.getByRole('link', { name: '稍後繼續' }).click();
    await page.goto('/#/weakness');
  }
});
