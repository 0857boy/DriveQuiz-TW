import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Flag,
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  Menu,
  Moon,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';
import { backupSchema, bankSchema, type Bank, type Mode, type Question } from './types';
import { dataSnapshot, useStudy } from './store';
import {
  categoryStats,
  EXAM_CONFIG,
  formatTime,
  grade,
  mastery,
  remainingSeconds,
  selectSmart,
  shuffle,
  weakness,
} from './lib/engine';
import {
  ArrowLabel,
  Empty,
  Favorite,
  Meter,
  Modal,
  PageTitle,
  QuestionImage,
  ReviewQuestion,
  RoadIllustration,
} from './components';

const modeNames: Record<Mode, string> = {
  smart: '智慧複習',
  weakness: '弱點特訓',
  category: '分類練習',
  mock: '模擬測驗',
  favorites: '收藏練習',
};
const officialExam = 'https://tpcmv.thb.gov.tw/cp.aspx?n=9438';
const officialUpdate = 'https://www.thb.gov.tw/News_Content_table.aspx?n=12181&s=300189';
const simulator = 'https://www.mvdis.gov.tw/m3-simulator-drv/';
const nav = [
  { to: '/', title: '學習首頁', icon: LayoutDashboard },
  { to: '/weakness', title: '弱點特訓', icon: Target },
  { to: '/categories', title: '分類練習', icon: BookOpen },
  { to: '/mock', title: '模擬測驗', icon: ListChecks },
  { to: '/bank', title: '完整題庫', icon: Search },
  { to: '/stats', title: '學習紀錄', icon: BarChart3 },
];
const today = () => new Date().toLocaleDateString('sv-SE');
function localDay(ms: number) {
  return new Date(ms).toLocaleDateString('sv-SE');
}

export default function App() {
  const [bank, setBank] = useState<Bank | null>(null),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    [menu, setMenu] = useState(false);
  const settings = useStudy((s) => s.settings),
    warning = useStudy((s) => s.warning);
  const location = useLocation(),
    navigate = useNavigate();
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch(`${import.meta.env.BASE_URL}questions/questions.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw Error('題庫無法載入');
        return r.json();
      })
      .then((value) => {
        const parsed = bankSchema.parse(value);
        if (new Set(parsed.questions.map((q) => q.id)).size !== parsed.questions.length)
          throw Error('題號重複');
        useStudy.getState().reconcile(parsed.questions);
        setBank(parsed);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError('題庫載入失敗。請確認網路連線，再試一次。');
      });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.classList.toggle('large-text', settings.largeText);
    document.documentElement.classList.toggle('high-contrast', settings.highContrast);
  }, [settings]);
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);
  // Runs across all routes; leaving the exam page never pauses the exam clock.
  useEffect(() => {
    if (!bank) return;
    const check = () => {
      const s = useStudy.getState().active;
      if (s?.deadline && Date.now() >= s.deadline) {
        useStudy.getState().finish(bank.questions);
        navigate('/result');
      }
    };
    check();
    const id = window.setInterval(check, 250);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [bank, navigate]);
  function start(mode: Mode, questions: Question[]) {
    useStudy.getState().start(mode, questions);
    navigate('/practice');
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        跳到主要內容
      </a>
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <div className="brand-mark">
            <GraduationCap size={23} />
          </div>
          <div>
            DriveQuiz<span>TW · 駕照刷題</span>
          </div>
        </Link>
        <div className="sidebar-label">你的學習空間</div>
        <nav aria-label="主選單">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'}>
              <item.icon size={20} />
              <span>{item.title}</span>
              {item.to === '/mock' && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-tip">
            <ShieldCheck size={22} />
            <strong>每次練習，都更有把握。</strong>
            <p>
              紀錄保存在這台裝置，
              <br />
              不用註冊，專心學習。
            </p>
          </div>
          <NavLink to="/settings" className="settings-link">
            <Settings2 size={20} />
            偏好與資料
          </NavLink>
          <div className="side-version">題庫版本 {bank?.version ?? '115.5.29'}</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-btn mobile-menu"
              aria-label="開啟選單"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={22} /> : <Menu size={22} />}
            </button>
            <span>
              普通汽車駕照 <ChevronRight size={14} />{' '}
              {nav.find((n) => n.to === location.pathname)?.title ??
                (location.pathname === '/practice'
                  ? '作答中'
                  : location.pathname === '/result'
                    ? '測驗結果'
                    : '偏好與資料')}
            </span>
          </div>
          <div className="top-actions">
            <span className="local-badge">
              <span />
              本機保存
            </span>
            <button
              className="icon-btn"
              aria-label={settings.theme === 'light' ? '切換深色模式' : '切換淺色模式'}
              onClick={() =>
                useStudy
                  .getState()
                  .setSettings({ theme: settings.theme === 'light' ? 'dark' : 'light' })
              }
            >
              {settings.theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {warning && (
            <div className="notice" role="status">
              {warning} <Link to="/settings">匯出備份</Link>
            </div>
          )}
          {error ? (
            <div className="empty">
              <h2>暫時無法載入題庫</h2>
              <p>{error}</p>
              <button className="btn primary" onClick={() => setRetry(retry + 1)}>
                重新載入
              </button>
            </div>
          ) : !bank ? (
            <div className="loading" role="status">
              <span className="spinner" />
              正在準備你的學習空間…
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Home bank={bank} start={start} />} />
              <Route path="/weakness" element={<Weakness bank={bank} start={start} />} />
              <Route path="/categories" element={<Categories bank={bank} start={start} />} />
              <Route path="/mock" element={<MockIntro start={start} bank={bank} />} />
              <Route path="/practice" element={<Practice bank={bank} />} />
              <Route path="/result" element={<Result bank={bank} start={start} />} />
              <Route path="/bank" element={<QuestionBank bank={bank} start={start} />} />
              <Route path="/stats" element={<Stats bank={bank} />} />
              <Route path="/settings" element={<Settings bank={bank} />} />
              <Route
                path="*"
                element={
                  <div className="empty">
                    <h1>找不到這個頁面</h1>
                    <Link to="/" className="btn primary">
                      回學習首頁
                    </Link>
                  </div>
                }
              />
            </Routes>
          )}
        </main>
        <footer>
          DriveQuiz TW <span>·</span> 一次一題，離駕照更近一步。
          <a href={simulator} target="_blank" rel="noreferrer">
            官方模擬考 <ArrowRight size={13} />
          </a>
        </footer>
      </div>
      {menu && (
        <button className="menu-scrim" aria-label="關閉選單" onClick={() => setMenu(false)} />
      )}
    </div>
  );
}
type PageProps = { bank: Bank; start: (mode: Mode, questions: Question[]) => void };
function ResumeNotice() {
  const active = useStudy((s) => s.active);
  const [discard, setDiscard] = useState(false);
  if (!active) return null;
  return (
    <>
      <div className="resume-note">
        <Clock3 size={21} />
        <div>
          <strong>上次的{modeNames[active.mode]}還在等你</strong>
          <p>
            已作答 {Object.keys(active.answers).length} / {active.questionIds.length} 題
            {active.mode === 'mock' ? ' · 倒數計時持續進行' : ''}
          </p>
        </div>
        <Link className="btn primary small" to="/practice">
          繼續作答 <ArrowRight size={16} />
        </Link>
        <button className="text-btn" onClick={() => setDiscard(true)}>
          放棄
        </button>
      </div>
      {discard && (
        <Modal title="放棄這次練習？" onClose={() => setDiscard(false)}>
          <p>
            {active.mode === 'mock'
              ? '尚未交卷的模擬考答案不會列入學習紀錄。'
              : '已完成的作答紀錄會保留。'}
            放棄後可以開始新的練習。
          </p>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setDiscard(false)}>
              繼續保留
            </button>
            <button
              className="btn danger"
              onClick={() => {
                useStudy.getState().abandon();
                setDiscard(false);
              }}
            >
              放棄這次練習
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
function Home({ bank, start }: PageProps) {
  const { progress, attempts, sessions, active } = useStudy();
  const stats = categoryStats(bank.questions, progress);
  const seen = Object.keys(progress).length,
    learned = bank.questions.filter((q) => mastery(progress[q.id]) >= 80).length;
  const due = bank.questions.filter(
    (q) => progress[q.id] && progress[q.id].nextReviewAt <= Date.now(),
  ).length;
  const todayCount = attempts.filter((a) => localDay(a.answeredAt) === today()).length;
  const weak = stats
    .filter((s) => s.seen > 0)
    .sort((a, b) => b.weakness - a.weakness)
    .slice(0, 3);
  const hour = new Date().getHours();
  return (
    <>
      <div className="home-greeting">
        <div>
          <div className="eyebrow">YOUR NEXT MILESTONE</div>
          <h1>{hour < 12 ? '早安' : hour < 18 ? '午安' : '晚安'}，今天也往前一點。</h1>
          <p>不需要一次記住所有題目。從今天的 20 題開始。</p>
        </div>
        <div className="date-chip">
          <CalendarDays size={16} />
          {new Date().toLocaleDateString('zh-TW', {
            month: 'long',
            day: 'numeric',
            weekday: 'short',
          })}
        </div>
      </div>
      <ResumeNotice />
      <section className="hero">
        <div className="hero-copy">
          <span className="pill">
            <Sparkles size={14} />
            為你安排的學習路線
          </span>
          <h2>
            把不熟的，
            <br />
            練成<span>有把握。</span>
          </h2>
          <p>
            {due
              ? `今天有 ${due} 題到期複習。讓熟悉的觀念，記得更久。`
              : '從作答中找到弱點，用剛剛好的複習把它學會。'}
          </p>
          <button
            className="btn primary"
            onClick={() =>
              active
                ? (window.location.hash = '/practice')
                : start('smart', selectSmart(bank.questions, progress))
            }
          >
            <ArrowLabel>{active ? '繼續上次練習' : '開始智慧複習'}</ArrowLabel>
          </button>
          <div className="hero-meta">
            <span>
              <ListChecks size={15} />
              20 題
            </span>
            <span>
              <Clock3 size={15} />約 6 分鐘
            </span>
            <span>
              <CheckCircle2 size={15} />
              即時解析
            </span>
          </div>
        </div>
        <RoadIllustration />
      </section>
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-title">
            <span>今日作答</span>
            <CalendarDays size={18} />
          </div>
          <strong>
            {todayCount}
            <small> / 20 題</small>
          </strong>
          <Meter value={(todayCount / 20) * 100} label="今日作答進度" />
          <p>
            {todayCount >= 20
              ? '今天的目標已達成，做得很好。'
              : `再練 ${Math.max(0, 20 - todayCount)} 題，完成今日目標`}
          </p>
        </div>
        <div className="metric">
          <div className="metric-title">
            <span>題庫進度</span>
            <BookOpen size={18} />
          </div>
          <strong>
            {seen.toLocaleString()}
            <small> / {bank.questions.length.toLocaleString()} 題</small>
          </strong>
          <Meter value={(seen / bank.questions.length) * 100} label="題庫進度" />
          <p>每一道看過的題目，都算數。</p>
        </div>
        <div className="metric">
          <div className="metric-title">
            <span>穩定掌握</span>
            <ShieldCheck size={18} />
          </div>
          <strong>
            {learned}
            <small> 題</small>
          </strong>
          <div className="metric-extra">
            <span className="green-dot" />
            依多次作答與複習時間評估
          </div>
          <p>
            {sessions.length
              ? `已完成 ${sessions.length} 次練習，繼續累積。`
              : '答對後，隔一段時間再驗證。'}
          </p>
        </div>
      </div>
      <div className="home-columns">
        <section className="panel">
          <div className="section-top">
            <div>
              <h2>下一站，補強弱點</h2>
              <p>把時間花在最值得複習的地方。</p>
            </div>
            <Link className="text-link" to="/weakness">
              查看全部 <ArrowRight size={16} />
            </Link>
          </div>
          {weak.length ? (
            <div className="weak-list">
              {weak.map((s, i) => (
                <button
                  key={s.category}
                  onClick={() =>
                    start(
                      'weakness',
                      shuffle(
                        bank.questions.filter((q) => q.category === s.category && progress[q.id]),
                      ).slice(0, 20),
                    )
                  }
                >
                  <span className="rank">0{i + 1}</span>
                  <div>
                    <strong>{s.category}</strong>
                    <span>
                      已看過 {s.seen} 題 · 正確率 {s.accuracy}%
                    </span>
                  </div>
                  <span className="weak-badge">{s.weakness >= 35 ? '優先複習' : '持續鞏固'}</span>
                  <ChevronRight size={17} />
                </button>
              ))}
            </div>
          ) : (
            <div className="new-journey">
              <div className="soft-icon">
                <Target size={28} />
              </div>
              <h3>你的弱點地圖，從第一題開始。</h3>
              <p>
                完成練習後，這裡會告訴你
                <br />
                哪些觀念需要多一點照顧。
              </p>
              <Link className="text-link" to="categories">
                先看看有哪些分類 <ArrowRight size={15} />
              </Link>
            </div>
          )}
        </section>
        <section className="panel exam-promo">
          <div className="section-top">
            <span className="soft-icon amber">
              <Timer size={23} />
            </span>
            <span className="tiny">考前準備</span>
          </div>
          <h2>準備好，試試實力。</h2>
          <p>
            限時作答，交卷後一次查看
            <br />
            分數與錯題分析。
          </p>
          <div className="exam-numbers">
            <div>
              <b>
                {EXAM_CONFIG.durationSeconds / 60}
                <small>分鐘</small>
              </b>
              <span>倒數計時</span>
            </div>
            <div>
              <b>
                {EXAM_CONFIG.passingScore}
                <small>分</small>
              </b>
              <span>及格門檻</span>
            </div>
          </div>
          <Link to="/mock" className="btn secondary">
            <ArrowLabel>進入模擬測驗</ArrowLabel>
          </Link>
        </section>
      </div>
      <div className="bottom-note">
        <ShieldCheck size={17} />
        <span>
          使用官方 PDF 題庫 {bank.version} · {bank.questions.length.toLocaleString()} 題 ·
          學習紀錄只保存在你的裝置
        </span>
      </div>
    </>
  );
}
function MockIntro({ bank, start }: PageProps) {
  const active = useStudy((s) => s.active);
  return (
    <>
      <PageTitle eyebrow="MOCK EXAM" title="給自己一次，考前演練。">
        安靜作答，專心判斷。交卷後，再一起找出需要加強的地方。
      </PageTitle>
      <ResumeNotice />
      <section className="mock-card">
        <div className="mock-intro-top">
          <div className="soft-icon">
            <ListChecks size={30} />
          </div>
          <span className="pill">普通汽車 · 文字與圖示題練習</span>
        </div>
        <h2>模擬測驗</h2>
        <div className="rule-grid">
          <div>
            <ListChecks size={22} />
            <strong>
              {EXAM_CONFIG.questionCount}
              <small>題</small>
            </strong>
            <span>隨機選擇題</span>
          </div>
          <div>
            <Timer size={22} />
            <strong>{formatTime(EXAM_CONFIG.durationSeconds)}</strong>
            <span>倒數計時</span>
          </div>
          <div>
            <Flag size={22} />
            <strong>
              {EXAM_CONFIG.passingScore}
              <small>分</small>
            </strong>
            <span>及格門檻</span>
          </div>
        </div>
        <ul className="exam-rules">
          <li>
            <Check size={17} />
            作答中不公布答案，可以回頭修改選項。
          </li>
          <li>
            <Check size={17} />
            提前交卷會保留剩餘時間；時間到，自動交卷。
          </li>
          <li>
            <Check size={17} />
            重新整理、離開頁面或關閉瀏覽器，不會暫停計時。
          </li>
          <li>
            <Check size={17} />
            交卷後顯示分數、未作答題與各分類的錯題分析。
          </li>
        </ul>
        <div className="source-callout">
          <CircleHelp size={20} />
          <div>
            <strong>關於新版正式考試</strong>
            <p>
              2026/6/30 起正式筆試共 50 題，包含 5 題危險感知影片題。本網站目前從 {bank.version}
              版題庫抽選 {EXAM_CONFIG.questionCount}{' '}
              題，尚未納入影片題；出題比例也未對齊官方配比。影片題請搭配
              <a href={simulator} target="_blank" rel="noreferrer">
                官方模擬考
              </a>
              練習。
            </p>
            <div className="source-links">
              <a href={officialExam} target="_blank" rel="noreferrer">
                30 分鐘／85 分來源 ↗
              </a>
              <a href={officialUpdate} target="_blank" rel="noreferrer">
                新制公告 ↗
              </a>
            </div>
          </div>
        </div>
        <button
          className="btn primary wide"
          onClick={() => start('mock', shuffle(bank.questions).slice(0, EXAM_CONFIG.questionCount))}
        >
          <ArrowLabel>
            {active ? '繼續上次作答' : `開始測驗 · ${formatTime(EXAM_CONFIG.durationSeconds)}`}
          </ArrowLabel>
        </button>
      </section>
      <p className="center-note">時間從按下「開始測驗」起算。未作答題以 0 分計。</p>
    </>
  );
}
function Practice({ bank }: { bank: Bank }) {
  const state = useStudy(),
    session = state.active,
    navigate = useNavigate();
  const [now, setNow] = useState(Date.now()),
    [confirm, setConfirm] = useState(false);
  const entered = useRef(Date.now());
  const q = session
    ? bank.questions.find((q) => q.id === session.questionIds[session.position])
    : undefined;
  const selected = q && session?.answers[q.id]?.selected,
    isMock = session?.mode === 'mock';
  useEffect(() => {
    entered.current = Date.now();
  }, [q?.id]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!session) return;
    session.questionIds.slice(session.position + 1, session.position + 3).forEach((id) => {
      const next = bank.questions.find((q) => q.id === id);
      if (next?.image) {
        const img = new Image();
        img.src = `${import.meta.env.BASE_URL}${next.image}`;
      }
    });
  }, [bank, session?.position, session?.id]);
  function choose(id: number) {
    if (q) state.answer(q, id, Date.now() - entered.current);
  }
  function finish() {
    state.finish(bank.questions);
    setConfirm(false);
    navigate('/result');
  }
  function next() {
    if (!session) return;
    if (session.position === session.questionIds.length - 1) isMock ? setConfirm(true) : finish();
    else state.move(session.position + 1);
  }
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        confirm ||
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        /INPUT|TEXTAREA|SELECT/.test(target?.tagName) ||
        target?.isContentEditable ||
        target?.closest('a') ||
        (event.key === 'Enter' && target?.tagName === 'BUTTON')
      )
        return;
      if (['1', '2', '3'].includes(event.key)) {
        event.preventDefault();
        choose(Number(event.key));
      } else if (event.key === 'Enter' && (isMock || selected !== undefined)) {
        event.preventDefault();
        next();
      } else if (event.key.toLowerCase() === 's' && q) {
        event.preventDefault();
        state.toggleFavorite(q.id);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });
  if (!session || !q)
    return (
      <div className="empty">
        <h1>從一段新練習開始</h1>
        <p>目前沒有進行中的測驗。</p>
        <Link to="/" className="btn primary">
          回學習首頁
        </Link>
      </div>
    );
  const count = Object.keys(session.answers).length,
    remaining = session.deadline ? remainingSeconds(session.deadline, now) : 0;
  const correct = selected === q.answer;
  return (
    <div className="practice-layout">
      <div className="practice-top">
        <Link to="/" className="back-link">
          <ArrowLeft size={17} />
          稍後繼續
        </Link>
        <span className="pill">{modeNames[session.mode]}</span>
        {isMock ? (
          <div
            className={`exam-timer ${remaining <= 300 ? 'urgent' : ''}`}
            role="timer"
            aria-label={`剩餘時間 ${formatTime(remaining)}`}
          >
            <Timer size={19} />
            <span data-testid="exam-timer">{formatTime(remaining)}</span>
          </div>
        ) : (
          <span className="tiny">
            {session.position + 1} / {session.questionIds.length}
          </span>
        )}
      </div>
      <div className="practice-body">
        <section className="question-panel">
          <div className="row-between">
            <span className="tiny">
              第 {session.position + 1} / {session.questionIds.length} 題 · 題號 #{q.id}
            </span>
            <Favorite id={q.id} />
          </div>
          <Meter value={(count / session.questionIds.length) * 100} label="測驗作答進度" />
          <div className="question-category">
            {q.structure}
            <ChevronRight size={14} />
            {q.category}
          </div>
          <QuestionImage question={q} />
          <h1 className="question-title">{q.question}</h1>
          <div className="choices" role="group" aria-label="選擇答案">
            {q.choices.map((c) => {
              const reveal = !isMock && selected !== undefined;
              return (
                <button
                  key={c.id}
                  className={`choice ${selected === c.id ? 'selected' : ''} ${reveal && c.id === q.answer ? 'correct' : ''} ${reveal && c.id === selected && !correct ? 'incorrect' : ''}`}
                  aria-pressed={selected === c.id}
                  disabled={reveal}
                  onClick={() => choose(c.id)}
                >
                  <span className="choice-number">{c.id}</span>
                  <span>{c.text}</span>
                  {reveal && c.id === q.answer ? (
                    <CheckCircle2 size={21} />
                  ) : reveal && c.id === selected && !correct ? (
                    <X size={21} />
                  ) : selected === c.id ? (
                    <Check size={21} />
                  ) : null}
                </button>
              );
            })}
          </div>
          {!isMock && selected !== undefined && (
            <div className={`feedback ${correct ? 'good' : 'bad'}`} role="status">
              <strong>
                {correct ? <CheckCircle2 size={19} /> : <X size={19} />}{' '}
                {correct ? '答對了，繼續保持！' : '這個觀念，值得再看一次。'}
              </strong>
              <p>
                官方正解：{q.answer} · {q.choices.find((c) => c.id === q.answer)?.text}
              </p>
              <span>
                複習重點：{q.tags.join('、') || q.category}。來源：官方題庫第 {q.sourcePage} 頁。
              </span>
            </div>
          )}
          <div className="question-actions">
            {isMock ? (
              <button
                className="btn secondary"
                onClick={() => state.move(session.position - 1)}
                disabled={session.position === 0}
              >
                <ArrowLeft size={16} />
                上一題
              </button>
            ) : (
              <span className="keyboard-hint">按 1–3 選答案 · Enter 下一題 · S 收藏</span>
            )}
            <button
              className="btn primary"
              onClick={next}
              disabled={!isMock && selected === undefined}
            >
              <ArrowLabel>
                {session.position === session.questionIds.length - 1
                  ? isMock
                    ? '檢查並交卷'
                    : '查看練習結果'
                  : '下一題'}
              </ArrowLabel>
            </button>
          </div>
        </section>
        {isMock && (
          <aside className="question-map panel">
            <h2>作答一覽</h2>
            <p>
              已作答 <b>{count}</b> / {session.questionIds.length} 題
            </p>
            <div className="question-grid">
              {session.questionIds.map((id, i) => (
                <button
                  key={id}
                  className={`${session.answers[id] ? 'answered' : ''} ${i === session.position ? 'current' : ''}`}
                  aria-label={`第 ${i + 1} 題，${session.answers[id] ? '已作答' : '未作答'}`}
                  aria-current={i === session.position ? 'step' : undefined}
                  onClick={() => state.move(i)}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="map-legend">
              <span>
                <i />
                未作答
              </span>
              <span>
                <i className="filled" />
                已作答
              </span>
            </div>
            <button className="btn primary wide" onClick={() => setConfirm(true)}>
              交卷並查看結果
            </button>
            <p className="tiny center-note">未作答題不計分</p>
          </aside>
        )}
      </div>
      {confirm && (
        <Modal title="準備交卷了嗎？" onClose={() => setConfirm(false)}>
          <p>
            已作答 {count} / {session.questionIds.length} 題，剩餘時間 {formatTime(remaining)}。
          </p>
          {count < session.questionIds.length && (
            <p className="warning-text">
              還有 {session.questionIds.length - count} 題未作答，將以 0 分計算。
            </p>
          )}
          <p>交卷後會公布全部答案，這次測驗便無法再修改。</p>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setConfirm(false)}>
              返回檢查
            </button>
            <button className="btn primary" onClick={finish}>
              確認交卷
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Result({ bank, start }: PageProps) {
  const session = useStudy((s) => s.lastResult),
    [filter, setFilter] = useState('wrong');
  if (!session)
    return (
      <div className="empty">
        <h1>還沒有測驗結果</h1>
        <Link className="btn primary" to="/mock">
          開始模擬測驗
        </Link>
      </div>
    );
  const result = grade(session, bank.questions),
    mock = session.mode === 'mock';
  const questions = session.questionIds.map((id) => bank.questions.find((q) => q.id === id)!);
  const mistakes = questions.filter((q) => session.answers[q.id]?.selected !== q.answer);
  const breakdown = [...new Set(questions.map((q) => q.category))]
    .map((category) => {
      const list = questions.filter((q) => q.category === category),
        errors = list.filter((q) => session.answers[q.id]?.selected !== q.answer).length;
      return { category, total: list.length, errors };
    })
    .sort((a, b) => b.errors - a.errors);
  const elapsed = Math.floor(((session.endedAt ?? Date.now()) - session.startedAt) / 1000);
  return (
    <>
      <PageTitle
        eyebrow="YOUR RESULTS"
        title={mock ? '交卷了，看看這次的收穫。' : '又往前了一步。'}
      >
        {session.reason === 'timeout'
          ? '時間到，系統已自動交卷。'
          : mock
            ? '測驗已送出，所有答案一次揭曉。'
            : '每一次作答，都讓下一次複習更有方向。'}
      </PageTitle>
      <section className={`result-hero ${mock && !result.passed ? 'needs-work' : ''}`}>
        <div className="result-score">
          <span>{mock ? '本次得分' : '本次正確率'}</span>
          <strong data-testid="result-score">
            {result.score}
            <small>{mock ? '分' : '%'}</small>
          </strong>
          <span className="pill">
            {mock
              ? result.passed
                ? '✓ 達到及格門檻'
                : '再練習，會更有把握'
              : `✓ 完成 ${result.answered} 題練習`}
          </span>
        </div>
        <div className="result-details">
          <div>
            <span>答對</span>
            <strong>
              {result.correct}
              <small>題</small>
            </strong>
          </div>
          <div>
            <span>答錯</span>
            <strong>
              {result.wrong}
              <small>題</small>
            </strong>
          </div>
          <div>
            <span>未作答</span>
            <strong>
              {result.unanswered}
              <small>題</small>
            </strong>
          </div>
          <div>
            <span>作答時間</span>
            <strong>{formatTime(elapsed)}</strong>
          </div>
          {mock && (
            <div>
              <span>交卷剩餘時間</span>
              <strong data-testid="remaining-time">
                {formatTime(session.remainingSeconds ?? 0)}
              </strong>
            </div>
          )}
          {mock && (
            <div>
              <span>及格門檻</span>
              <strong>
                {EXAM_CONFIG.passingScore}
                <small>分</small>
              </strong>
            </div>
          )}
        </div>
      </section>
      <div className="result-cta">
        {mistakes.length > 0 && (
          <button className="btn primary" onClick={() => start('weakness', mistakes.slice(0, 20))}>
            <ArrowLabel>針對這次錯題練習</ArrowLabel>
          </button>
        )}
        <Link className="btn secondary" to={mock ? '/mock' : '/'}>
          {mock ? '再做一次模擬測驗' : '回學習首頁'}
        </Link>
      </div>
      <section className="panel breakdown">
        <div className="section-top">
          <div>
            <h2>這次需要加強的觀念</h2>
            <p>包含答錯與未作答題，優先從失分最多的分類開始。</p>
          </div>
          <Target size={23} />
        </div>
        {breakdown.map((s) => (
          <div className="breakdown-row" key={s.category}>
            <span>{s.category}</span>
            <Meter value={((s.total - s.errors) / s.total) * 100} label={`${s.category}正確率`} />
            <b>
              {s.total - s.errors} / {s.total}
            </b>
            <span className={s.errors ? 'warning-text' : 'green-text'}>
              {s.errors ? `${s.errors} 題待複習` : '全部答對'}
            </span>
          </div>
        ))}
      </section>
      <div className="section-top results-title">
        <h2>
          錯題分析 <span className="count-badge">{mistakes.length}</span>
        </h2>
        <div className="segmented">
          <button className={filter === 'wrong' ? 'active' : ''} onClick={() => setFilter('wrong')}>
            錯題與未作答
          </button>
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            全部題目
          </button>
        </div>
      </div>
      {(filter === 'wrong' ? mistakes : questions).length ? (
        (filter === 'wrong' ? mistakes : questions).map((q) => (
          <ReviewQuestion key={q.id} question={q} selected={session.answers[q.id]?.selected} />
        ))
      ) : (
        <Empty title="全部答對，沒有錯題！">繼續間隔複習，讓這些觀念記得更穩。</Empty>
      )}
    </>
  );
}
function Weakness({ bank, start }: PageProps) {
  const progress = useStudy((s) => s.progress),
    [category, setCategory] = useState('all');
  const stats = categoryStats(bank.questions, progress)
    .filter((s) => s.seen > 0)
    .sort((a, b) => b.weakness - a.weakness);
  const weak = bank.questions
    .filter(
      (q) =>
        progress[q.id] &&
        weakness(progress[q.id]) >= 35 &&
        (category === 'all' || q.category === category),
    )
    .sort((a, b) => weakness(progress[b.id]) - weakness(progress[a.id]));
  return (
    <>
      <PageTitle eyebrow="FOCUS ON WHAT MATTERS" title="找到弱點，也找到方向。">
        不只記下錯題。綜合錯誤率、最近表現、作答速度與複習時間，安排下一步。
      </PageTitle>
      <ResumeNotice />
      {!stats.length ? (
        <Empty title="先開始練習，才能看見弱點">
          答過的題目會出現在這裡。
          <Link to="/" className="text-link">
            回首頁開始智慧複習 <ArrowRight size={16} />
          </Link>
        </Empty>
      ) : (
        <>
          <div className="focus-banner">
            <span className="soft-icon">
              <Target size={27} />
            </span>
            <div>
              <h2>
                {weak.length ? `${weak.length} 題，值得再多練一次。` : '目前沒有高風險題目。'}
              </h2>
              <p>答對後會安排間隔複習，確認你真的記住了。</p>
            </div>
            <button
              className="btn primary"
              disabled={!weak.length}
              onClick={() => start('weakness', shuffle(weak.slice(0, 60)).slice(0, 20))}
            >
              <ArrowLabel>開始弱點特訓</ArrowLabel>
            </button>
          </div>
          <div className="filter-row">
            <label htmlFor="weak-category">特訓分類</label>
            <select
              id="weak-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">所有弱點</option>
              {stats.map((s) => (
                <option key={s.category}>{s.category}</option>
              ))}
            </select>
          </div>
          <div className="category-grid">
            {stats
              .filter((s) => category === 'all' || s.category === category)
              .map((s) => (
                <div className="panel category-card" key={s.category}>
                  <div className="row-between">
                    <Target size={24} />
                    <span className={`weak-badge ${s.weakness < 35 ? 'stable' : ''}`}>
                      {s.weakness >= 35 ? '需要加強' : '持續鞏固'}
                    </span>
                  </div>
                  <h2>{s.category}</h2>
                  <p>
                    作答 {s.attempts} 次 · 正確率 {s.accuracy}%
                  </p>
                  <Meter value={s.mastery} label={`${s.category}掌握度`} />
                  <div className="row-between tiny">
                    <span>題庫掌握度 {s.mastery}%</span>
                    <span>
                      已看過 {s.seen} / {s.total} 題
                    </span>
                  </div>
                  <button
                    className="text-link"
                    onClick={() =>
                      start(
                        'weakness',
                        shuffle(
                          bank.questions.filter((q) => q.category === s.category && progress[q.id]),
                        ).slice(0, 20),
                      )
                    }
                  >
                    練習這個分類 <ArrowRight size={16} />
                  </button>
                </div>
              ))}
          </div>
          <p className="source-note">
            掌握度會計入尚未作答題與作答次數；第一次答對不代表已完全熟練。
          </p>
        </>
      )}
    </>
  );
}
function Categories({ bank, start }: PageProps) {
  const progress = useStudy((s) => s.progress);
  const stats = categoryStats(bank.questions, progress);
  return (
    <>
      <PageTitle eyebrow="BUILD YOUR FOUNDATION" title="一個分類，一次學好。">
        按照官方題庫架構練習，從觀念到路上的每一個判斷。
      </PageTitle>
      <ResumeNotice />
      {[...new Set(bank.questions.map((q) => q.structure))].map((structure, i) => (
        <section className="category-section" key={structure}>
          <div className="structure-heading">
            <span>0{i + 1}</span>
            <h2>{structure}</h2>
          </div>
          <div className="category-grid">
            {[
              ...new Set(
                bank.questions.filter((q) => q.structure === structure).map((q) => q.category),
              ),
            ].map((category) => {
              const group = bank.questions.filter(
                  (q) => q.structure === structure && q.category === category,
                ),
                s = stats.find((s) => s.category === category)!;
              return (
                <button
                  className="panel category-card clickable"
                  key={category}
                  onClick={() => start('category', shuffle(group).slice(0, 20))}
                >
                  <div className="row-between">
                    <BookOpen size={24} />
                    <ChevronRight size={18} />
                  </div>
                  <h3>{category}</h3>
                  <p>{group.length} 題 · 每次練習最多 20 題</p>
                  <Meter value={s.mastery} label={`${category}掌握度`} />
                  <div className="row-between tiny">
                    <span>{s.seen ? `掌握度 ${s.mastery}%` : '還沒開始，現在就出發'}</span>
                    <span>
                      {s.seen} / {s.total}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
function QuestionBank({ bank, start }: PageProps) {
  const { progress, favorites, active } = useStudy(),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [category, setCategory] = useState('all'),
    [limit, setLimit] = useState(30),
    [open, setOpen] = useState<number | null>(null);
  const filtered = useMemo(
    () =>
      bank.questions.filter(
        (q) =>
          (category === 'all' || q.category === category) &&
          (!search ||
            `${q.id} ${q.question} ${q.choices.map((c) => c.text).join(' ')} ${q.tags.join(' ')}`.includes(
              search.trim(),
            )) &&
          (filter === 'all' ||
            (filter === 'favorites' && favorites.includes(q.id)) ||
            (filter === 'wrong' && (progress[q.id]?.wrongCount ?? 0) > 0) ||
            (filter === 'new' && !progress[q.id]) ||
            (filter === 'images' && q.type === 'image')),
      ),
    [bank, progress, favorites, search, filter, category],
  );
  useEffect(() => {
    setLimit(30);
    setOpen(null);
  }, [search, filter, category]);
  return (
    <>
      <PageTitle eyebrow="QUESTION LIBRARY" title="每一道題，都在這裡。">
        搜尋題號、關鍵字，或把想再看的觀念收藏起來。
      </PageTitle>
      <ResumeNotice />
      <div className="bank-filters">
        <div className="search-field">
          <Search size={20} />
          <input
            aria-label="搜尋題號或關鍵字"
            placeholder="搜尋題號或關鍵字，例如：安全距離"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="icon-btn" aria-label="清除搜尋" onClick={() => setSearch('')}>
              <X size={17} />
            </button>
          )}
        </div>
        <select
          aria-label="題庫分類"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">所有分類</option>
          {[...new Set(bank.questions.map((q) => q.category))].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="bank-tabs">
        {[
          ['all', '全部題目'],
          ['wrong', '錯過的題'],
          ['favorites', '我的收藏'],
          ['new', '未作答'],
          ['images', '圖示題'],
        ].map(([key, label]) => (
          <button
            key={key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}
          >
            {label}
            {key === 'favorites' && <span>{favorites.length}</span>}
          </button>
        ))}
      </div>
      <div className="section-top">
        <p className="tiny">共找到 {filtered.length} 題</p>
        {filter === 'favorites' && filtered.length > 0 && (
          <button
            className="text-link"
            onClick={() => start('favorites', shuffle(filtered).slice(0, 20))}
          >
            {active ? '繼續上次作答' : '開始收藏練習'}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="bank-list">
        {filtered.slice(0, limit).map((q) => (
          <article className="bank-item" key={q.id}>
            <div className="bank-item-top">
              <span className="question-id">#{q.id}</span>
              <button
                className="bank-question"
                aria-expanded={open === q.id}
                onClick={() => setOpen(open === q.id ? null : q.id)}
              >
                <span className="tiny">
                  {q.category}
                  {q.image ? ' · 圖示題' : ''}
                </span>
                <strong>{q.question}</strong>
              </button>
              <Favorite id={q.id} />
              <button
                className="icon-btn"
                aria-label={open === q.id ? '收起答案' : '查看題目與答案'}
                aria-expanded={open === q.id}
                onClick={() => setOpen(open === q.id ? null : q.id)}
              >
                <ChevronDown size={20} />
              </button>
            </div>
            {open === q.id && (
              <ReviewQuestion question={q} selected={progress[q.id]?.lastSelectedAnswer} />
            )}
          </article>
        ))}
      </div>
      {!filtered.length && <Empty title="沒有符合的題目">試著換個關鍵字或調整篩選。</Empty>}
      {filtered.length > limit && (
        <button className="btn secondary load-more" onClick={() => setLimit(limit + 30)}>
          顯示更多題目 <ChevronDown size={17} />
        </button>
      )}
    </>
  );
}
function Stats({ bank }: { bank: Bank }) {
  const { attempts, sessions, progress } = useStudy(),
    stats = categoryStats(bank.questions, progress);
  const correct = attempts.filter((a) => a.correct).length;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 6 + i);
    return {
      label: d.toLocaleDateString('zh-TW', { weekday: 'short' }),
      day: localDay(d.getTime()),
    };
  });
  const bars = days.map((d) => ({
    ...d,
    count: attempts.filter((a) => localDay(a.answeredAt) === d.day).length,
  }));
  const max = Math.max(20, ...bars.map((b) => b.count));
  return (
    <>
      <PageTitle eyebrow="SMALL STEPS, REAL PROGRESS" title="你的努力，有跡可循。">
        把每次練習累積起來，看見自己走過的路。
      </PageTitle>
      <div className="metric-grid">
        <div className="metric">
          <div className="metric-title">
            累計作答
            <TrendingUp size={20} />
          </div>
          <strong>
            {attempts.length}
            <small>次</small>
          </strong>
          <p>保留最近 5,000 次作答</p>
        </div>
        <div className="metric">
          <div className="metric-title">
            作答正確率
            <CheckCircle2 size={20} />
          </div>
          <strong>
            {attempts.length ? Math.round((correct / attempts.length) * 100) : 0}
            <small>%</small>
          </strong>
          <p>
            {correct} 次答對 / {attempts.length} 次作答
          </p>
        </div>
        <div className="metric">
          <div className="metric-title">
            完成練習
            <Flag size={20} />
          </div>
          <strong>
            {sessions.length}
            <small>次</small>
          </strong>
          <p>保留最近 200 次練習</p>
        </div>
      </div>
      <section className="panel activity">
        <div className="section-top">
          <h2>最近 7 天</h2>
          <span className="tiny">每日作答次數</span>
        </div>
        <div className="activity-chart">
          {bars.map((b) => (
            <div className="activity-bar" key={b.day}>
              <b>{b.count}</b>
              <div className="bar-track">
                <span style={{ height: `${(b.count / max) * 100}%` }} />
              </div>
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </section>
      <section className="panel breakdown">
        <h2>分類掌握度</h2>
        {stats.map((s) => (
          <div className="breakdown-row" key={s.category}>
            <span>{s.category}</span>
            <Meter value={s.mastery} label={`${s.category}掌握度`} />
            <b>{s.mastery}%</b>
            <span className="tiny">
              {s.seen}/{s.total} 題
            </span>
          </div>
        ))}
      </section>
      <section className="panel session-history">
        <h2>最近的練習</h2>
        {!sessions.length ? (
          <Empty title="第一筆紀錄，就從今天開始">完成一次練習後，這裡會留下你的成果。</Empty>
        ) : (
          [...sessions]
            .reverse()
            .slice(0, 10)
            .map((s) => {
              const g = grade(s, bank.questions);
              return (
                <div className="session-row" key={s.id}>
                  <span className="soft-icon">
                    <ListChecks size={20} />
                  </span>
                  <div>
                    <strong>{modeNames[s.mode]}</strong>
                    <span>{new Date(s.endedAt ?? s.startedAt).toLocaleString('zh-TW')}</span>
                  </div>
                  <b>
                    {g.score}
                    {s.mode === 'mock' ? ' 分' : '%'}
                  </b>
                  <span className="tiny">
                    {g.correct}/{s.questionIds.length} 題答對
                  </span>
                </div>
              );
            })
        )}
      </section>
    </>
  );
}
function Settings({ bank }: { bank: Bank }) {
  const state = useStudy(),
    file = useRef<HTMLInputElement>(null),
    [message, setMessage] = useState(''),
    [confirm, setConfirm] = useState<'reset' | 'import' | null>(null),
    [pending, setPending] = useState<unknown>(null);
  function exportBackup() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            app: 'drivequiz-tw',
            schemaVersion: 1,
            exportedAt: new Date().toISOString(),
            data: dataSnapshot(state),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = `drivequiz-backup-${today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('備份已下載。可以在另一台裝置匯入這份 JSON。');
  }
  async function readBackup(f?: File) {
    if (!f) return;
    try {
      if (f.size > 10 * 1024 * 1024) throw Error();
      const parsed = JSON.parse(await f.text());
      backupSchema.parse(parsed);
      setPending(parsed);
      setConfirm('import');
    } catch {
      setMessage('匯入失敗：這不是有效的 DriveQuiz TW v1 備份，原有紀錄已保留。');
    }
    if (file.current) file.current.value = '';
  }
  return (
    <>
      <PageTitle eyebrow="MAKE IT YOURS" title="照你的方式，安心學習。">
        調整閱讀偏好，也替努力留下備份。
      </PageTitle>
      <section className="panel settings-panel">
        <h2>閱讀與顯示</h2>
        <div className="setting-row">
          <div>
            <strong>深色模式</strong>
            <p>在光線較暗的地方，也能舒服閱讀。</p>
          </div>
          <button
            role="switch"
            aria-checked={state.settings.theme === 'dark'}
            aria-label="深色模式"
            className={`switch ${state.settings.theme === 'dark' ? 'on' : ''}`}
            onClick={() =>
              state.setSettings({ theme: state.settings.theme === 'dark' ? 'light' : 'dark' })
            }
          >
            <span />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>放大文字</strong>
            <p>放大題目、選項與頁面文字。</p>
          </div>
          <button
            role="switch"
            aria-checked={state.settings.largeText}
            aria-label="放大文字"
            className={`switch ${state.settings.largeText ? 'on' : ''}`}
            onClick={() => state.setSettings({ largeText: !state.settings.largeText })}
          >
            <span />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <strong>高對比顯示</strong>
            <p>加深文字與邊框，提高辨識度。</p>
          </div>
          <button
            role="switch"
            aria-checked={state.settings.highContrast}
            aria-label="高對比顯示"
            className={`switch ${state.settings.highContrast ? 'on' : ''}`}
            onClick={() => state.setSettings({ highContrast: !state.settings.highContrast })}
          >
            <span />
          </button>
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>學習資料</h2>
        <p>
          紀錄儲存在這台裝置的瀏覽器。換手機、使用無痕模式或清除網站資料，都可能使紀錄消失。定期匯出備份，可以隨時搬家。
        </p>
        <div className="backup-buttons">
          <button className="btn secondary" onClick={exportBackup}>
            <ArrowDownToLine size={18} />
            匯出學習紀錄
          </button>
          <button className="btn secondary" onClick={() => file.current?.click()}>
            <Upload size={18} />
            匯入學習紀錄
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => readBackup(e.target.files?.[0])}
          />
        </div>
        {message && (
          <div role="status" className="notice">
            {message}
          </div>
        )}
        <div className="setting-row">
          <div>
            <strong>清除所有紀錄</strong>
            <p>清除作答、收藏、練習與偏好設定。</p>
          </div>
          <button className="text-btn warning-text" onClick={() => setConfirm('reset')}>
            <Trash2 size={17} />
            清除
          </button>
        </div>
      </section>
      <section className="panel settings-panel">
        <h2>題庫與考試資訊</h2>
        <p>
          普通汽車 · PDF 題庫 {bank.version} · {bank.questions.length.toLocaleString()}{' '}
          題。圖片由原始 PDF 擷取。分類沿用官方架構，細部標籤依關鍵字建立。
        </p>
        <p>
          模擬模式：30 分鐘，85 分及格，50 題各 2
          分。現有題庫不含危險感知影片題，也未配置官方出題比例。
        </p>
        <div className="source-links">
          <a href={officialExam} target="_blank" rel="noreferrer">
            官方考試規定 ↗
          </a>
          <a href={officialUpdate} target="_blank" rel="noreferrer">
            2026 新制公告 ↗
          </a>
          <a href={simulator} target="_blank" rel="noreferrer">
            練習官方影片題 ↗
          </a>
        </div>
      </section>
      {confirm && (
        <Modal
          title={confirm === 'reset' ? '清除所有學習紀錄？' : '匯入並取代現有紀錄？'}
          onClose={() => setConfirm(null)}
        >
          <p>
            {confirm === 'reset'
              ? '這個動作會刪除這台裝置的作答紀錄、收藏、進行中的測驗與偏好設定，無法復原。建議先匯出備份。'
              : '匯入會取代這台裝置現有的全部學習紀錄。與目前題庫內容不符的題目進度會自動移除。建議先匯出現有紀錄。'}
          </p>
          <div className="dialog-actions">
            <button className="btn secondary" onClick={() => setConfirm(null)}>
              取消
            </button>
            <button
              className={`btn ${confirm === 'reset' ? 'danger' : 'primary'}`}
              onClick={() => {
                try {
                  if (confirm === 'reset') {
                    state.reset();
                    setMessage('學習紀錄已清除。');
                  } else {
                    state.importData(pending, bank.questions);
                    setMessage('學習紀錄已匯入。');
                  }
                } catch {
                  setMessage('匯入失敗，原有紀錄已保留。');
                }
                setConfirm(null);
                setPending(null);
              }}
            >
              {confirm === 'reset' ? '確認清除' : '確認匯入'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
