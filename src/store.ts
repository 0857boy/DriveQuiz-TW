import { create } from 'zustand';
import { backupSchema, type StudyData, type Question, type Mode, type Answer } from './types';
import { EXAM_CONFIG, remainingSeconds, updateProgress } from './lib/engine';

const KEY = 'drivequiz:state:v1';
export const emptyData = (): StudyData => ({
  progress: {},
  attempts: [],
  sessions: [],
  active: null,
  lastResult: null,
  favorites: [],
  settings: { theme: 'light', largeText: false, highContrast: false },
});
let initial = emptyData();
let initialWarning = '';
try {
  const raw = localStorage.getItem(KEY);
  if (raw) initial = backupSchema.parse(JSON.parse(raw)).data;
} catch {
  initialWarning = '學習紀錄無法讀取或格式不相容。請使用備份匯入；新的練習仍可正常使用。';
}

type Store = StudyData & {
  warning: string;
  start: (mode: Mode, questions: Question[]) => void;
  answer: (q: Question, selected: number, responseMs: number) => void;
  move: (position: number) => void;
  finish: (questions: Question[], now?: number) => void;
  abandon: () => void;
  toggleFavorite: (id: number) => void;
  setSettings: (settings: Partial<StudyData['settings']>) => void;
  importData: (value: unknown, questions: Question[]) => void;
  reconcile: (questions: Question[]) => void;
  reset: () => void;
};
function record(data: StudyData, q: Question, answer: Answer, mode: Mode, sessionId: string) {
  return {
    progress: {
      ...data.progress,
      [q.id]: updateProgress(
        data.progress[q.id],
        q,
        answer.selected,
        answer.responseMs,
        answer.answeredAt,
      ),
    },
    attempts: [
      ...data.attempts,
      { ...answer, questionId: q.id, correct: answer.selected === q.answer, mode, sessionId },
    ].slice(-5000),
  };
}
export function dataSnapshot(state: StudyData): StudyData {
  const { progress, attempts, sessions, active, lastResult, favorites, settings } = state;
  return { progress, attempts, sessions, active, lastResult, favorites, settings };
}
export function reconcileData(data: StudyData, questions: Question[]): StudyData {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const progress = Object.fromEntries(
    Object.entries(data.progress).filter(
      ([id, p]) => byId.get(Number(id))?.fingerprint === p.fingerprint,
    ),
  );
  const validSession = (session: StudyData['active']) =>
    !session || session.questionIds.every((id) => byId.has(id));
  return {
    ...data,
    progress,
    favorites: data.favorites.filter((id) => byId.has(id)),
    attempts: data.attempts.filter((a) => byId.has(a.questionId)),
    active: validSession(data.active) ? data.active : null,
    lastResult: validSession(data.lastResult) ? data.lastResult : null,
    sessions: data.sessions.filter(validSession),
  };
}
export const useStudy = create<Store>((set, get) => ({
  ...initial,
  warning: initialWarning,
  start: (mode, questions) => {
    if (!questions.length || get().active) return;
    const now = Date.now();
    set({
      active: {
        id: crypto.randomUUID(),
        mode,
        questionIds: questions.map((q) => q.id),
        position: 0,
        startedAt: now,
        ...(mode === 'mock' ? { deadline: now + EXAM_CONFIG.durationSeconds * 1000 } : {}),
        answers: {},
      },
      lastResult: null,
    });
  },
  answer: (q, selected, responseMs) => {
    const state = get(),
      session = state.active;
    if (
      !session ||
      session.questionIds[session.position] !== q.id ||
      (session.mode !== 'mock' && session.answers[q.id])
    )
      return;
    const now = Date.now();
    if (session.deadline && now >= session.deadline) return;
    const answer = {
      selected,
      answeredAt: now,
      responseMs: Math.max(0, Math.min(responseMs, 1800000)),
    };
    set({
      ...(session.mode === 'mock' ? {} : record(state, q, answer, session.mode, session.id)),
      active: { ...session, answers: { ...session.answers, [q.id]: answer } },
    });
  },
  move: (position) => {
    const s = get().active;
    if (s && position >= 0 && position < s.questionIds.length) set({ active: { ...s, position } });
  },
  finish: (questions, now = Date.now()) => {
    const state = get(),
      s = state.active;
    if (!s) return;
    const timeout = s.deadline !== undefined && now >= s.deadline;
    const endedAt = timeout ? s.deadline! : now;
    const result = {
      ...s,
      endedAt,
      reason: timeout ? ('timeout' as const) : ('submitted' as const),
      ...(s.deadline !== undefined
        ? { remainingSeconds: remainingSeconds(s.deadline, endedAt) }
        : {}),
    };
    let updated = dataSnapshot(state);
    if (s.mode === 'mock')
      for (const q of questions) {
        const answer = s.answers[q.id];
        if (answer) updated = { ...updated, ...record(updated, q, answer, s.mode, s.id) };
      }
    set({
      ...updated,
      active: null,
      lastResult: result,
      sessions: [...state.sessions, result].slice(-200),
    });
  },
  abandon: () => set({ active: null }),
  toggleFavorite: (id) =>
    set((s) => ({
      favorites: s.favorites.includes(id)
        ? s.favorites.filter((x) => x !== id)
        : [...s.favorites, id],
    })),
  setSettings: (settings) => set((s) => ({ settings: { ...s.settings, ...settings } })),
  importData: (value, questions) => {
    const parsed = backupSchema.parse(value).data;
    set({ ...reconcileData(parsed, questions), warning: '' });
  },
  reconcile: (questions) => set((s) => reconcileData(dataSnapshot(s), questions)),
  reset: () => set({ ...emptyData(), warning: '' }),
}));
useStudy.subscribe((state) => {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({ app: 'drivequiz-tw', schemaVersion: 1, data: dataSnapshot(state) }),
    );
  } catch {
    if (!state.warning)
      useStudy.setState({
        warning: '裝置無法儲存紀錄（可能是儲存空間不足或隱私設定）。離開前請匯出備份。',
      });
  }
});
