import { z } from 'zod';
import { EXAM_CONFIG } from './config/exam';

export const choiceSchema = z.object({
  id: z.number().int().min(1).max(3),
  text: z.string().min(1),
});
export const questionSchema = z
  .object({
    id: z.number().int().positive(),
    sourceVersion: z.string(),
    structure: z.string(),
    category: z.string(),
    type: z.enum(['text', 'image']),
    question: z.string().min(1),
    choices: z.array(choiceSchema).length(3),
    answer: z.number().int().min(1).max(3),
    image: z.string().optional(),
    tags: z.array(z.string()),
    sourcePage: z.number().int().positive(),
    fingerprint: z.string(),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.choices.map((c) => c.id)).size !== 3)
      ctx.addIssue({ code: 'custom', message: '選項編號重複' });
    if (q.type === 'image' && !q.image) ctx.addIssue({ code: 'custom', message: '圖示題缺少圖片' });
  });
export const bankSchema = z.object({
  version: z.string(),
  source: z.string(),
  questions: z.array(questionSchema).min(50),
});
export type Question = z.infer<typeof questionSchema>;
export type Bank = z.infer<typeof bankSchema>;
export const modes = ['smart', 'weakness', 'category', 'mock', 'favorites'] as const;
export type Mode = (typeof modes)[number];
export const progressSchema = z
  .object({
    attempts: z.number().int().nonnegative(),
    correctCount: z.number().int().nonnegative(),
    wrongCount: z.number().int().nonnegative(),
    streak: z.number().int().nonnegative(),
    lastAnswerCorrect: z.boolean(),
    lastSelectedAnswer: z.number().int().min(1).max(3),
    lastSeenAt: z.number().nonnegative(),
    nextReviewAt: z.number().nonnegative(),
    reviewLevel: z.number().int().min(0).max(5),
    averageResponseMs: z.number().nonnegative(),
    fingerprint: z.string(),
  })
  .refine((p) => p.attempts === p.correctCount + p.wrongCount, '作答次數不一致');
export type Progress = z.infer<typeof progressSchema>;
export const answerSchema = z.object({
  selected: z.number().int().min(1).max(3),
  answeredAt: z.number().nonnegative(),
  responseMs: z.number().nonnegative(),
});
export type Answer = z.infer<typeof answerSchema>;
export const sessionSchema = z
  .object({
    id: z.string(),
    mode: z.enum(modes),
    questionIds: z.array(z.number().int().positive()).min(1).max(100),
    position: z.number().int().nonnegative(),
    startedAt: z.number().nonnegative(),
    deadline: z.number().nonnegative().optional(),
    answers: z.record(z.string(), answerSchema),
    endedAt: z.number().nonnegative().optional(),
    remainingSeconds: z.number().int().nonnegative().optional(),
    reason: z.enum(['submitted', 'timeout']).optional(),
  })
  .refine((s) => s.position < s.questionIds.length, '題目位置不正確')
  .refine((s) => new Set(s.questionIds).size === s.questionIds.length, '測驗題號不可重複')
  .refine(
    (s) => Object.keys(s.answers).every((id) => s.questionIds.includes(Number(id))),
    '答案包含不在測驗中的題目',
  )
  .refine(
    (s) =>
      s.mode !== 'mock' ||
      (s.deadline !== undefined && s.deadline === s.startedAt + EXAM_CONFIG.durationSeconds * 1000),
    '模擬考時間不正確',
  );
export type Session = z.infer<typeof sessionSchema>;
export const attemptSchema = answerSchema.extend({
  questionId: z.number().int().positive(),
  correct: z.boolean(),
  mode: z.enum(modes),
  sessionId: z.string(),
});
export const dataSchema = z.object({
  progress: z.record(z.string(), progressSchema),
  attempts: z.array(attemptSchema).max(5000),
  sessions: z.array(sessionSchema).max(200),
  active: sessionSchema.nullable(),
  lastResult: sessionSchema.nullable(),
  favorites: z.array(z.number().int().positive()),
  settings: z.object({
    theme: z.enum(['light', 'dark']),
    largeText: z.boolean(),
    highContrast: z.boolean(),
  }),
});
export type StudyData = z.infer<typeof dataSchema>;
export const backupSchema = z.object({
  app: z.literal('drivequiz-tw'),
  schemaVersion: z.literal(1),
  exportedAt: z.string().optional(),
  data: dataSchema,
});
