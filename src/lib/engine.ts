import type { Progress, Question, Session } from '../types';
import { EXAM_CONFIG } from '../config/exam';

export { EXAM_CONFIG } from '../config/exam';
const DAY = 86_400_000;
const intervals = [0, 1, 3, 7, 14, 30];

export function remainingSeconds(deadline: number, now = Date.now()) {
  return Math.min(EXAM_CONFIG.durationSeconds, Math.max(0, Math.ceil((deadline - now) / 1000)));
}
export function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)
    .toString()
    .padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
}
export function grade(session: Session, questions: Question[]) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const correct = session.questionIds.filter(
    (id) => session.answers[id]?.selected === byId.get(id)?.answer,
  ).length;
  const answered = Object.keys(session.answers).length;
  const score = Math.round((correct / session.questionIds.length) * 100 * 10) / 10;
  return {
    correct,
    answered,
    wrong: answered - correct,
    unanswered: session.questionIds.length - answered,
    score,
    passed: score >= EXAM_CONFIG.passingScore,
  };
}
export function updateProgress(
  previous: Progress | undefined,
  question: Question,
  selected: number,
  responseMs: number,
  now: number,
): Progress {
  const old = previous?.fingerprint === question.fingerprint ? previous : undefined;
  const correct = selected === question.answer;
  const level = correct
    ? Math.min(5, (old?.reviewLevel ?? 0) + 1)
    : Math.max(0, (old?.reviewLevel ?? 0) - 2);
  const attempts = (old?.attempts ?? 0) + 1;
  return {
    attempts,
    correctCount: (old?.correctCount ?? 0) + Number(correct),
    wrongCount: (old?.wrongCount ?? 0) + Number(!correct),
    streak: correct ? (old?.streak ?? 0) + 1 : 0,
    lastAnswerCorrect: correct,
    lastSelectedAnswer: selected,
    lastSeenAt: now,
    nextReviewAt: now + intervals[level] * DAY,
    reviewLevel: level,
    averageResponseMs: ((old?.averageResponseMs ?? 0) * (attempts - 1) + responseMs) / attempts,
    fingerprint: question.fingerprint,
  };
}
export function weakness(p: Progress | undefined, now = Date.now()) {
  if (!p) return 0;
  const errorRate = p.wrongCount / Math.max(1, p.attempts);
  const overdue = Math.min(1, Math.max(0, now - p.nextReviewAt) / (7 * DAY));
  return Math.round(
    errorRate * 40 +
      Number(!p.lastAnswerCorrect) * 30 +
      Math.max(0, 1 - p.streak / 3) * 15 +
      Math.min(1, p.averageResponseMs / 30000) * 5 +
      overdue * 10,
  );
}
export function mastery(p: Progress | undefined, now = Date.now()) {
  if (!p) return 0;
  const confidence = Math.min(1, 0.3 + (p.attempts - 1) * 0.1);
  const recency = Math.max(0.65, 1 - Math.max(0, now - p.lastSeenAt) / (100 * DAY));
  return Math.round((p.correctCount / p.attempts) * confidence * recency * 100);
}
export function shuffle<T>(items: T[], random = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function selectSmart(
  questions: Question[],
  progress: Record<string, Progress>,
  count = 20,
  now = Date.now(),
) {
  const picked: Question[] = [];
  const used = new Set<number>();
  const take = (pool: Question[], n: number) => {
    for (const q of pool) {
      if (n <= 0) break;
      if (!used.has(q.id)) {
        picked.push(q);
        used.add(q.id);
        n--;
      }
    }
  };
  const weak = questions.filter(
    (q) =>
      progress[q.id] && (weakness(progress[q.id], now) >= 35 || progress[q.id].nextReviewAt <= now),
  );
  // Weighted sampling without replacement keeps the order varied within the priority pool.
  const prioritized = weak
    .map((q) => ({
      q,
      rank:
        -Math.log(Math.max(Number.EPSILON, Math.random())) / (1 + weakness(progress[q.id], now)),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.q);
  take(prioritized, Math.ceil(count * 0.5));
  take(shuffle(questions.filter((q) => progress[q.id])), Math.floor(count * 0.3));
  take(shuffle(questions.filter((q) => !progress[q.id])), Math.floor(count * 0.2));
  take(prioritized, count - picked.length);
  take(shuffle(questions), count - picked.length);
  return shuffle(picked);
}
export function categoryStats(questions: Question[], progress: Record<string, Progress>) {
  return [...new Set(questions.map((q) => q.category))].map((category) => {
    const group = questions.filter((q) => q.category === category);
    const seen = group.filter((q) => progress[q.id]);
    const attempts = seen.reduce((n, q) => n + progress[q.id].attempts, 0);
    const correct = seen.reduce((n, q) => n + progress[q.id].correctCount, 0);
    return {
      category,
      total: group.length,
      seen: seen.length,
      attempts,
      accuracy: attempts ? Math.round((correct / attempts) * 100) : 0,
      mastery: seen.length
        ? Math.round(seen.reduce((n, q) => n + mastery(progress[q.id]), 0) / group.length)
        : 0,
      weakness: seen.length
        ? Math.round(seen.reduce((n, q) => n + weakness(progress[q.id]), 0) / seen.length)
        : 0,
    };
  });
}
