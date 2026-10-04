import { useEffect, useRef, type ReactNode } from 'react';
import { ArrowRight, Check, Star, X } from 'lucide-react';
import type { Question } from './types';
import { useStudy } from './store';

export function PageTitle({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div className="eyebrow">{eyebrow}</div>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Star size={26} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog ref={ref} onCancel={onClose} aria-labelledby="dialog-title" className="modal">
      <div className="modal-top">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-btn" aria-label="關閉" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function QuestionImage({ question }: { question: Question }) {
  return question.image ? (
    <div className="question-image">
      <img
        src={`${import.meta.env.BASE_URL}${question.image}`}
        alt={`第 ${question.id} 題的交通圖示`}
      />
    </div>
  ) : null;
}
export function Favorite({ id }: { id: number }) {
  const favorite = useStudy((s) => s.favorites.includes(id));
  const toggle = useStudy((s) => s.toggleFavorite);
  return (
    <button
      className={`icon-btn favorite ${favorite ? 'is-favorite' : ''}`}
      aria-label={favorite ? '取消收藏' : '收藏這題'}
      aria-pressed={favorite}
      onClick={() => toggle(id)}
    >
      <Star size={20} fill={favorite ? 'currentColor' : 'none'} />
    </button>
  );
}
export function ReviewQuestion({
  question: q,
  selected,
}: {
  question: Question;
  selected?: number;
}) {
  return (
    <div className="review-question">
      <div className="row-between">
        <span className="tiny">
          #{q.id} · {q.category}
        </span>
        <Favorite id={q.id} />
      </div>
      <QuestionImage question={q} />
      <h3>{q.question}</h3>
      <div className="review-choices">
        {q.choices.map((c) => (
          <div
            key={c.id}
            className={`review-choice ${c.id === q.answer ? 'correct' : c.id === selected ? 'incorrect' : ''}`}
          >
            <span>{c.id}</span>
            <div>{c.text}</div>
            {c.id === q.answer ? (
              <b>
                <Check size={16} />
                正解
              </b>
            ) : c.id === selected ? (
              <b>
                <X size={16} />
                你的答案
              </b>
            ) : null}
          </div>
        ))}
      </div>
      {selected === undefined && <p className="warning-text">這題未作答。</p>}
      <p className="source-note">
        複習觀念：{q.tags.join('、') || q.category} · 官方題庫第 {q.sourcePage} 頁
      </p>
    </div>
  );
}
export function RoadIllustration() {
  return (
    <svg
      className="road-art"
      viewBox="0 0 350 270"
      role="img"
      aria-label="沿著學習道路，一步步抵達目標"
    >
      <defs>
        <pattern id="dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="#a2cbb4" />
        </pattern>
      </defs>
      <circle cx="197" cy="131" r="111" fill="#e4f0e6" />
      <rect x="40" y="14" width="288" height="229" fill="url(#dots)" opacity=".5" />
      <path
        d="M25 236h90c58 0 54-72 6-72h-5c-44 0-44-62 2-62h106c48 0 48-60 4-60h-26"
        fill="none"
        stroke="#c4dece"
        strokeWidth="36"
        strokeLinecap="round"
      />
      <path
        d="M25 236h90c58 0 54-72 6-72h-5c-44 0-44-62 2-62h106c48 0 48-60 4-60h-26"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeDasharray="8 8"
      />
      <g transform="translate(176 15)">
        <rect x="0" y="0" width="47" height="48" rx="13" fill="#176b4b" />
        <path
          d="m14 25 8 8 13-16"
          fill="none"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <circle cx="76" cy="104" r="8" fill="#176b4b" stroke="white" strokeWidth="4" />
      <circle cx="153" cy="213" r="8" fill="#efb655" stroke="white" strokeWidth="4" />
      <g transform="translate(255 173)">
        <rect width="69" height="58" rx="13" fill="white" />
        <path d="m23 39 9-25 10 25M28 29h9" fill="none" stroke="#176b4b" strokeWidth="3" />
        <circle cx="57" cy="8" r="11" fill="#efb655" />
        <path d="m53 8 3 3 5-5" stroke="white" fill="none" strokeWidth="2" />
      </g>
      <path d="M34 165v-27m0 0 24 7-24 8" stroke="#176b4b" strokeWidth="3" fill="#d7e8d9" />
      <circle cx="274" cy="84" r="7" fill="#efb655" />
      <path d="M300 127h10m-5-5v10" stroke="#6d9d82" strokeWidth="2" />
    </svg>
  );
}
export function ArrowLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ArrowRight size={18} />
    </>
  );
}
