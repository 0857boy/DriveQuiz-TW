import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { bankSchema, type Question, type Session } from '../types';
import {
  EXAM_CONFIG,
  formatTime,
  grade,
  mastery,
  remainingSeconds,
  selectSmart,
  updateProgress,
  weakness,
} from './engine';
const q: Question = {
  id: 1,
  sourceVersion: 'test',
  structure: '安全駕駛能力',
  category: '路口',
  type: 'text',
  question: '題目',
  choices: [
    { id: 1, text: 'A' },
    { id: 2, text: 'B' },
    { id: 3, text: 'C' },
  ],
  answer: 2,
  tags: [],
  sourcePage: 1,
  fingerprint: 'a',
};
const session = (questions: Question[], correct: number): Session => ({
  id: 's',
  mode: 'mock',
  position: 0,
  startedAt: 100,
  deadline: 1800100,
  questionIds: questions.map((q) => q.id),
  answers: Object.fromEntries(
    questions.map((q, i) => [
      q.id,
      { selected: i < correct ? q.answer : 1, answeredAt: 200, responseMs: 100 },
    ]),
  ),
});
describe('mock exam rules', () => {
  it('uses 30 minutes, 50 questions and an inclusive 85-point threshold', () => {
    expect(EXAM_CONFIG).toEqual({ durationSeconds: 1800, passingScore: 85, questionCount: 50 });
    const qs = Array.from({ length: 20 }, (_, i) => ({ ...q, id: i + 1 }));
    expect(grade(session(qs, 17), qs)).toMatchObject({ score: 85, passed: true });
    expect(grade(session(qs, 16), qs)).toMatchObject({ score: 80, passed: false });
    const fifty = Array.from({ length: 50 }, (_, i) => ({ ...q, id: i + 1 }));
    expect(grade(session(fifty, 42), fifty)).toMatchObject({ score: 84, passed: false });
    expect(grade(session(fifty, 43), fifty)).toMatchObject({ score: 86, passed: true });
  });
  it('counts unanswered as zero, separately from wrong answers', () => {
    const s = session([q, { ...q, id: 2 }, { ...q, id: 3 }, { ...q, id: 4 }], 2);
    delete s.answers[3];
    delete s.answers[4];
    expect(grade(s, [q, { ...q, id: 2 }, { ...q, id: 3 }, { ...q, id: 4 }])).toMatchObject({
      correct: 2,
      wrong: 0,
      unanswered: 2,
      score: 50,
    });
  });
  it('uses an absolute deadline after background throttling or refresh', () => {
    const deadline = 2_000_000;
    expect(remainingSeconds(deadline, deadline - 1_800_000)).toBe(1800);
    expect(remainingSeconds(deadline, deadline - 145_123)).toBe(146);
    expect(remainingSeconds(deadline, deadline)).toBe(0);
    expect(remainingSeconds(deadline, deadline + 60_000)).toBe(0);
    expect(formatTime(1800)).toBe('30:00');
    expect(formatTime(0)).toBe('00:00');
  });
});
describe('review engine', () => {
  it('schedules 1, 3, 7, 14, 30 day reviews and drops only two levels on a wrong answer', () => {
    let p = undefined;
    const now = 100000;
    for (const days of [1, 3, 7, 14, 30]) {
      p = updateProgress(p, q, 2, 1500, now);
      expect(p.nextReviewAt).toBe(now + days * 86400000);
    }
    const wrong = updateProgress(p, q, 1, 5000, now);
    expect(wrong.reviewLevel).toBe(3);
    expect(wrong.streak).toBe(0);
    expect(wrong.attempts).toBe(6);
  });
  it('does not give 100% mastery after one lucky correct answer', () => {
    const p = updateProgress(undefined, q, 2, 1000, Date.now());
    expect(mastery(p)).toBe(30);
    const wrong = updateProgress(p, q, 1, 1000, Date.now());
    expect(weakness(wrong)).toBeGreaterThan(weakness(p));
  });
  it('resets progress when the question content changes', () => {
    const p = updateProgress(undefined, q, 2, 1000, 10000);
    expect(updateProgress(p, { ...q, fingerprint: 'changed' }, 2, 1000, 20000).attempts).toBe(1);
  });
  it('fills a novice session with unique questions and no repeats', () => {
    const qs = Array.from({ length: 100 }, (_, i) => ({ ...q, id: i + 1 }));
    const selected = selectSmart(qs, {});
    expect(selected).toHaveLength(20);
    expect(new Set(selected.map((q) => q.id)).size).toBe(20);
  });
  it('mixes ten weak, six recent and four new questions when all pools are available', () => {
    const qs = Array.from({ length: 100 }, (_, i) => ({ ...q, id: i + 1 }));
    const progress = Object.fromEntries(
      qs
        .slice(0, 50)
        .map((q, i) => [q.id, updateProgress(undefined, q, i < 20 ? 1 : 2, 1000, Date.now())]),
    );
    const selected = selectSmart(qs, progress);
    expect(selected).toHaveLength(20);
    expect(selected.filter((q) => !progress[q.id])).toHaveLength(4);
    expect(
      selected.filter((q) => progress[q.id] && !progress[q.id].lastAnswerCorrect).length,
    ).toBeGreaterThanOrEqual(10);
  });
});
describe('real question bank', () => {
  it('validates every question and image-backed option', () => {
    const bank = bankSchema.parse(
      JSON.parse(readFileSync('public/questions/questions.json', 'utf8')),
    );
    expect(bank.questions).toHaveLength(1090);
    bank.questions.forEach((q, i) => {
      expect(q.id).toBe(i + 1);
      expect(q.choices.map((c) => c.id)).toEqual([1, 2, 3]);
    });
    expect(bank.questions.find((q) => q.id === 183)?.choices[1].text).toBe('圖中選項 2');
  });
});
