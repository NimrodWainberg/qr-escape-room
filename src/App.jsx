import {
  Check,
  Home,
  LoaderCircle,
  LogOut,
  Moon,
  QrCode,
  RefreshCcw,
  Save,
  Settings,
  Sparkles,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { defaultPublicGameConfig } from "./data/challenges.js";

const STORAGE_KEY = "qr-escape-room-solved-v1";
const THEME_KEY = "qr-escape-room-theme-v1";
const ADMIN_TOKEN_KEY = "qr-escape-room-admin-token-v1";

const API = {
  publicConfig: "/.netlify/functions/public-config",
  checkAnswer: "/.netlify/functions/check-answer",
  checkFinal: "/.netlify/functions/check-final",
  adminLogin: "/.netlify/functions/admin-login",
  adminConfig: "/.netlify/functions/admin-config",
};

function isChallengeSolved(challenge, solved) {
  return Boolean(solved[challenge.id]);
}

function getChallengeIndex(challenges, challenge) {
  return challenges.findIndex((item) => item.id === challenge.id);
}

function getPreviousChallenge(challenges, challenge) {
  const index = getChallengeIndex(challenges, challenge);
  return index > 0 ? challenges[index - 1] : null;
}

function getNextChallenge(challenges, challenge) {
  const index = getChallengeIndex(challenges, challenge);
  return index >= 0 ? challenges[index + 1] ?? null : null;
}

function isChallengeUnlocked(challenges, challenge, solved) {
  const previousChallenge = getPreviousChallenge(challenges, challenge);
  return !previousChallenge || isChallengeSolved(previousChallenge, solved);
}

function areAllChallengesSolved(challenges, solved) {
  return challenges.every((challenge) => isChallengeSolved(challenge, solved));
}

function getFirstUnsolvedChallenge(challenges, solved) {
  return challenges.find((challenge) => !isChallengeSolved(challenge, solved)) ?? null;
}

async function postJson(url, body, token) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function putJson(url, body, token) {
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function getJson(url, token) {
  const response = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function readSolved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function readTheme() {
  if (typeof localStorage === "undefined") {
    return "light";
  }

  return localStorage.getItem(THEME_KEY) ?? "light";
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const [solved, setSolved] = useState(readSolved);
  const [theme, setTheme] = useState(readTheme);
  const [gameConfig, setGameConfig] = useState(defaultPublicGameConfig);
  const [configStatus, setConfigStatus] = useState("loading");
  const { roomConfig, challenges } = gameConfig;

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function loadPublicConfig() {
      try {
        const nextConfig = await getJson(API.publicConfig);

        if (!cancelled) {
          setGameConfig(nextConfig);
          setConfigStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setConfigStatus("fallback");
        }
      }
    }

    loadPublicConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const activeChallenge = useMemo(
    () => challenges.find((challenge) => challenge.path === path),
    [challenges, path],
  );

  const solvedCount = challenges.filter((challenge) => solved[challenge.id]).length;

  function navigate(nextPath) {
    window.history.pushState({}, "", nextPath);
    setPath(nextPath);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markSolved(challengeId) {
    setSolved((current) => {
      const next = { ...current, [challengeId]: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function resetProgress() {
    localStorage.removeItem(STORAGE_KEY);
    setSolved({});
  }

  return (
    <div className="app-shell">
      <AnimatedBackdrop />
      <header className="topbar">
        <button className="brand-button" type="button" onClick={() => navigate("/")}>
          <QrCode aria-hidden="true" />
          <span>{roomConfig.title}</span>
        </button>

        <nav className="nav-actions" aria-label="ניווט">
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate("/")}
            aria-label="עמוד הבית"
            title="עמוד הבית"
          >
            <Home aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate("/final")}
            aria-label="לקוד הסופי"
            title="לקוד הסופי"
          >
            <Trophy aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
            title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
          >
            {theme === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => navigate("/admin")}
            aria-label="ניהול"
            title="ניהול"
          >
            <Settings aria-hidden="true" />
          </button>
        </nav>
      </header>

      <main>
        {path === "/admin" ? (
          <AdminPage
            fallbackConfig={gameConfig}
            onPublicConfigChange={(publicConfig) => setGameConfig(publicConfig)}
          />
        ) : activeChallenge ? (
          isChallengeUnlocked(challenges, activeChallenge, solved) ? (
            <ChallengePage
              challenge={activeChallenge}
              challenges={challenges}
              solved={isChallengeSolved(activeChallenge, solved)}
              onSolve={markSolved}
              onNavigate={navigate}
            />
          ) : (
            <LockedPage
              title={`${activeChallenge.title} נעול`}
              message={`כדי לפתוח את השלב הזה צריך לפתור קודם את ${getPreviousChallenge(challenges, activeChallenge)?.title}.`}
              targetChallenge={getPreviousChallenge(challenges, activeChallenge)}
              onNavigate={navigate}
            />
          )
        ) : path === "/final" ? (
          areAllChallengesSolved(challenges, solved) ? (
            <FinalPage
              challenges={challenges}
              roomConfig={roomConfig}
              solved={solved}
              onNavigate={navigate}
            />
          ) : (
            <LockedPage
              title="הקוד הסופי נעול"
              message="הקוד הסופי ייפתח רק אחרי שכל השלבים נפתרו."
              targetChallenge={getFirstUnsolvedChallenge(challenges, solved)}
              onNavigate={navigate}
            />
          )
        ) : (
          <HomePage
            challenges={challenges}
            roomConfig={roomConfig}
            configStatus={configStatus}
            solved={solved}
            solvedCount={solvedCount}
            onNavigate={navigate}
            onReset={resetProgress}
          />
        )}
      </main>
    </div>
  );
}

function HomePage({ challenges, roomConfig, configStatus, solved, solvedCount, onNavigate, onReset }) {
  const finalUnlocked = areAllChallengesSolved(challenges, solved);

  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">משחק QR קצר</p>
        <h1>{roomConfig.title}</h1>
        <p>{roomConfig.subtitle}</p>
        {configStatus === "fallback" && (
          <p className="config-note">האתר עובד עכשיו עם הגדרות ברירת מחדל עד שהשרת יהיה זמין.</p>
        )}
      </div>

      <div className="status-strip" aria-label="התקדמות">
        <div>
          <strong>
            {solvedCount}/{challenges.length}
          </strong>
          <span>קודים נפתרו</span>
        </div>
        <button className="ghost-button" type="button" onClick={onReset}>
          <RefreshCcw aria-hidden="true" />
          איפוס
        </button>
      </div>

      <div className="challenge-grid">
        {challenges.map((challenge) => {
          const solvedChallenge = isChallengeSolved(challenge, solved);
          const unlockedChallenge = isChallengeUnlocked(challenges, challenge, solved);
          const cardState = solvedChallenge ? "is-solved" : unlockedChallenge ? "is-unlocked" : "is-locked";

          return (
            <button
              className={`challenge-card ${cardState}`}
              key={challenge.id}
              type="button"
              aria-disabled={!unlockedChallenge}
              onClick={() => onNavigate(challenge.path)}
            >
              <span className="card-index">{challenge.id}</span>
              <span>
                <strong>{challenge.title}</strong>
                <small>
                  {solvedChallenge
                    ? `נמצא: ${challenge.reward}`
                    : unlockedChallenge
                      ? "המנעול פתוח"
                      : "נעול עד השלב הקודם"}
                </small>
              </span>
              {solvedChallenge ? (
                <Check aria-hidden="true" />
              ) : (
                <AnimatedLock state={unlockedChallenge ? "open" : "closed"} compact />
              )}
            </button>
          );
        })}
      </div>

      <button
        className={`primary-button wide-button ${finalUnlocked ? "" : "is-soft-locked"}`}
        type="button"
        onClick={() => onNavigate("/final")}
      >
        {finalUnlocked ? <Trophy aria-hidden="true" /> : <AnimatedLock state="closed" compact />}
        {finalUnlocked ? "מעבר לקוד הסופי" : "הקוד הסופי נעול"}
      </button>
    </section>
  );
}

function ChallengePage({ challenge, challenges, solved, onSolve, onNavigate }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState(solved ? "success" : "idle");

  useEffect(() => {
    setValue("");
    setResult(solved ? "success" : "idle");
  }, [challenge.id, solved]);

  async function submitAnswer(event) {
    event.preventDefault();
    setResult("checking");

    try {
      const response = await postJson(API.checkAnswer, {
        id: challenge.id,
        answer: value,
      });

      if (response.correct) {
        setResult("success");
        onSolve(challenge.id);
        return;
      }

      setResult("error");
    } catch {
      setResult("error");
    }
  }

  return (
    <section className={`play-panel ${result === "error" ? "shake" : ""}`}>
      {result === "success" && <Confetti />}

      <div className="panel-header">
        <span className="round-badge">{challenge.id}</span>
        <div>
          <p className="eyebrow">שלב {challenge.id}</p>
          <h1>{challenge.title}</h1>
        </div>
      </div>

      <div className="question-box">
        {challenge.question ? (
          <p>{challenge.question}</p>
        ) : (
          <>
            <p>השאלה לשלב הזה יכולה להיות מודפסת ליד ה-QR.</p>
            <p className="muted">אם תרצה, אפשר להוסיף כאן גם את השאלה עצמה בהמשך.</p>
          </>
        )}
      </div>

      <form className="code-form" onSubmit={submitAnswer}>
        <label htmlFor={`answer-${challenge.id}`}>הכניסו מספר</label>
        <input
          id={`answer-${challenge.id}`}
          className="code-input"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="000"
          dir="ltr"
        />
        <button className="primary-button" type="submit" disabled={result === "checking"}>
          {result === "checking" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Sparkles aria-hidden="true" />}
          {result === "checking" ? "בודק..." : "בדיקה"}
        </button>
      </form>

      <ResultMessage result={result} reward={challenge.reward} />
      {result === "success" && <UnlockNotice challenge={challenge} challenges={challenges} onNavigate={onNavigate} />}

      <div className="page-actions">
        <button className="ghost-button" type="button" onClick={() => onNavigate("/")}>
          <Home aria-hidden="true" />
          לכל השלבים
        </button>
        <button className="ghost-button" type="button" onClick={() => onNavigate("/final")}>
          <Trophy aria-hidden="true" />
          לקוד הסופי
        </button>
      </div>
    </section>
  );
}

function ResultMessage({ result, reward }) {
  if (result === "success") {
    return (
      <div className="result success-result" role="status">
        <Check aria-hidden="true" />
        <span className="result-copy">
          <strong className="result-title">כל הכבוד!</strong>
          <small>פתרתם את השלב וקיבלתם חלק מהקוד הסופי:</small>
        </span>
        <strong>{reward}</strong>
      </div>
    );
  }

  if (result === "error") {
    return (
      <div className="result error-result" role="alert">
        <X aria-hidden="true" />
        <span className="result-copy">
          <strong className="result-title">כמעט!</strong>
          <small>הקוד הזה לא פתח את השלב. בדקו את הרמז ונסו שוב.</small>
        </span>
      </div>
    );
  }

  if (result === "checking") {
    return (
      <div className="hint-line" role="status">
        בודקים את הקוד...
      </div>
    );
  }

  return (
    <div className="hint-line">
      פתרון נכון יגלה אות או חלק מהקוד הסופי.
    </div>
  );
}

function UnlockNotice({ challenge, challenges, onNavigate }) {
  const nextChallenge = getNextChallenge(challenges, challenge);
  const title = nextChallenge ? `${nextChallenge.title} נפתח!` : "הקוד הסופי נפתח!";
  const actionLabel = nextChallenge ? `מעבר אל ${nextChallenge.title}` : "מעבר לקוד הסופי";
  const actionPath = nextChallenge ? nextChallenge.path : "/final";

  return (
    <div className="unlock-notice" role="status">
      <AnimatedLock state="opening" />
      <span className="result-copy">
        <strong className="result-title">{title}</strong>
        <small>המנעול נפתח ואפשר להתקדם לשלב הבא.</small>
      </span>
      <button className="ghost-button" type="button" onClick={() => onNavigate(actionPath)}>
        {actionLabel}
      </button>
    </div>
  );
}

function AnimatedLock({ state, compact = false, large = false }) {
  const className = [
    "animated-lock",
    `is-${state}`,
    compact ? "is-compact" : "",
    large ? "is-large" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <linearGradient id="lockBodyGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#ff6b5f" />
        </linearGradient>
        <linearGradient id="lockOpenGradient" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#21c6bd" />
          <stop offset="100%" stopColor="#8f6cff" />
        </linearGradient>
      </defs>
      <g className="lock-sparkles">
        <path d="M24 26 L28 36 L38 40 L28 44 L24 54 L20 44 L10 40 L20 36 Z" />
        <path d="M94 18 L97 26 L105 29 L97 32 L94 40 L91 32 L83 29 L91 26 Z" />
        <path d="M96 83 L100 92 L109 96 L100 100 L96 109 L92 100 L83 96 L92 92 Z" />
      </g>
      <path
        className="lock-shackle"
        d="M38 55 V42 C38 26 48 16 60 16 C72 16 82 26 82 42 V55"
        fill="none"
        stroke="currentColor"
        strokeWidth="12"
        strokeLinecap="round"
      />
      <rect className="lock-body" x="25" y="50" width="70" height="54" rx="14" />
      <circle className="lock-keyhole" cx="60" cy="72" r="7" />
      <path className="lock-keyhole" d="M60 76 L60 90" fill="none" strokeWidth="7" strokeLinecap="round" />
    </svg>
  );
}

function FinalPage({ challenges, roomConfig, solved, onNavigate }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState("idle");

  async function submitFinal(event) {
    event.preventDefault();
    setResult("checking");

    try {
      const response = await postJson(API.checkFinal, { code: value });

      if (response.correct) {
        setResult("success");
        return;
      }

      setResult("error");
    } catch {
      setResult("error");
    }
  }

  if (result === "success") {
    return <VacationCelebration onNavigate={onNavigate} />;
  }

  return (
    <section className={`play-panel final-panel ${result === "error" ? "shake" : ""}`}>
      <div className="panel-header">
        <span className="round-badge">
          <Trophy aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">השלב האחרון</p>
          <h1>הקוד הסופי</h1>
        </div>
      </div>

      <p className="lead">{roomConfig.finalPrompt}</p>

      <div className="code-fragments" aria-label="חלקי הקוד שנאספו">
        {challenges.map((challenge) => (
          <span className={solved[challenge.id] ? "fragment is-found" : "fragment"} key={challenge.id}>
            {solved[challenge.id] ? challenge.reward : "?"}
          </span>
        ))}
      </div>

      <form className="code-form" onSubmit={submitFinal}>
        <label htmlFor="final-code">הקוד שאספתם</label>
        <input
          id="final-code"
          className="final-input"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="הקלידו כאן"
        />
        <button className="primary-button" type="submit" disabled={result === "checking"}>
          {result === "checking" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Trophy aria-hidden="true" />}
          {result === "checking" ? "פותח..." : "פתיחה"}
        </button>
      </form>

      {result === "checking" && (
        <div className="hint-line" role="status">
          בודקים את הקוד הסופי...
        </div>
      )}

      {result === "error" && (
        <div className="result error-result" role="alert">
          <X aria-hidden="true" />
          <span className="result-copy">
            <strong className="result-title">עדיין לא.</strong>
            <small>אפשר לכתוב את הקוד עם רווח או בלי רווח. בדקו את החלקים ונסו שוב.</small>
          </span>
        </div>
      )}

      <button className="ghost-button" type="button" onClick={() => onNavigate("/")}>
        <Home aria-hidden="true" />
        חזרה לשלבים
      </button>
    </section>
  );
}

function AdminPage({ fallbackConfig, onPublicConfigChange }) {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(token ? "loading" : "idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    loadAdminConfig(token);
  }, [token]);

  async function loadAdminConfig(activeToken) {
    setStatus("loading");
    setMessage("");

    try {
      const nextConfig = await getJson(API.adminConfig, activeToken);
      setConfig(nextConfig);
      setStatus("ready");
    } catch {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      setToken("");
      setConfig(null);
      setStatus("idle");
      setMessage("החיבור לניהול פג או לא תקין. צריך להתחבר שוב.");
    }
  }

  async function submitLogin(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const response = await postJson(API.adminLogin, { password });
      localStorage.setItem(ADMIN_TOKEN_KEY, response.token);
      setPassword("");
      setToken(response.token);
    } catch {
      setStatus("idle");
      setMessage("הסיסמה לא נכונה או שהאדמין עדיין לא הוגדר.");
    }
  }

  function updateRoomConfig(field, value) {
    setConfig((current) => ({
      ...current,
      roomConfig: {
        ...current.roomConfig,
        [field]: value,
      },
    }));
  }

  function updateChallenge(index, field, value) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) =>
        challengeIndex === index ? { ...challenge, [field]: value } : challenge,
      ),
    }));
  }

  async function saveConfig(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const response = await putJson(API.adminConfig, config, token);
      setConfig(response.config);
      onPublicConfigChange(response.publicConfig);
      setStatus("ready");
      setMessage("השינויים נשמרו.");
    } catch {
      setStatus("ready");
      setMessage("השמירה נכשלה. נסה שוב.");
    }
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setConfig(null);
    setStatus("idle");
    setMessage("");
  }

  if (!token || !config) {
    return (
      <section className="play-panel admin-panel">
        <div className="panel-header">
          <span className="round-badge">
            <Settings aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">ניהול</p>
            <h1>{fallbackConfig.roomConfig.title}</h1>
          </div>
        </div>

        <form className="code-form" onSubmit={submitLogin}>
          <label htmlFor="admin-password">סיסמת אדמין</label>
          <input
            id="admin-password"
            className="final-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="הקלד סיסמה"
            dir="ltr"
          />
          <button className="primary-button" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Settings aria-hidden="true" />}
            כניסה
          </button>
        </form>

        {message && <p className="admin-message">{message}</p>}
      </section>
    );
  }

  return (
    <section className="play-panel admin-panel">
      <div className="admin-heading">
        <div className="panel-header">
          <span className="round-badge">
            <Settings aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">ניהול המשחק</p>
            <h1>עריכת קודים</h1>
          </div>
        </div>
        <button className="ghost-button" type="button" onClick={logout}>
          <LogOut aria-hidden="true" />
          יציאה
        </button>
      </div>

      <form className="admin-form" onSubmit={saveConfig}>
        <fieldset className="admin-section">
          <legend>הגדרות כלליות</legend>
          <label>
            שם המשחק
            <input
              className="admin-input"
              value={config.roomConfig.title}
              onChange={(event) => updateRoomConfig("title", event.target.value)}
            />
          </label>
          <label>
            טקסט פתיחה
            <textarea
              className="admin-textarea"
              value={config.roomConfig.subtitle}
              onChange={(event) => updateRoomConfig("subtitle", event.target.value)}
            />
          </label>
          <label>
            טקסט לפני הקוד הסופי
            <textarea
              className="admin-textarea"
              value={config.roomConfig.finalPrompt}
              onChange={(event) => updateRoomConfig("finalPrompt", event.target.value)}
            />
          </label>
          <label>
            פתרון סופי
            <input
              className="admin-input"
              value={config.roomConfig.finalCode}
              onChange={(event) => updateRoomConfig("finalCode", event.target.value)}
              dir="auto"
            />
          </label>
        </fieldset>

        <fieldset className="admin-section">
          <legend>שלבי QR</legend>
          <div className="admin-challenges">
            {config.challenges.map((challenge, index) => (
              <div className="admin-challenge" key={challenge.id}>
                <strong>שלב {challenge.id}</strong>
                <label>
                  כותרת
                  <input
                    className="admin-input"
                    value={challenge.title}
                    onChange={(event) => updateChallenge(index, "title", event.target.value)}
                  />
                </label>
                <label>
                  שאלה באתר
                  <textarea
                    className="admin-textarea"
                    value={challenge.question}
                    onChange={(event) => updateChallenge(index, "question", event.target.value)}
                    placeholder="אפשר להשאיר ריק אם השאלה מודפסת ליד ה-QR"
                  />
                </label>
                <div className="admin-inline-fields">
                  <label>
                    תשובה
                    <input
                      className="admin-input"
                      value={challenge.answer}
                      onChange={(event) => updateChallenge(index, "answer", event.target.value)}
                      dir="auto"
                    />
                  </label>
                  <label>
                    חלק בקוד הסופי
                    <input
                      className="admin-input"
                      value={challenge.reward}
                      onChange={(event) => updateChallenge(index, "reward", event.target.value)}
                      dir="auto"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="admin-actions">
          <button className="primary-button" type="submit" disabled={status === "saving"}>
            {status === "saving" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Save aria-hidden="true" />}
            {status === "saving" ? "שומר..." : "שמירה"}
          </button>
          {message && <span className="admin-message">{message}</span>}
        </div>
      </form>
    </section>
  );
}

function LockedPage({ title, message, targetChallenge, onNavigate }) {
  return (
    <section className="play-panel locked-panel">
      <AnimatedLock state="closed" large />
      <p className="eyebrow">נעול כרגע</p>
      <h1>{title}</h1>
      <p className="lead">{message}</p>
      <div className="page-actions">
        {targetChallenge && (
          <button className="primary-button" type="button" onClick={() => onNavigate(targetChallenge.path)}>
            אל {targetChallenge.title}
          </button>
        )}
        <button className="ghost-button" type="button" onClick={() => onNavigate("/")}>
          <Home aria-hidden="true" />
          לכל השלבים
        </button>
      </div>
    </section>
  );
}

function VacationCelebration({ onNavigate }) {
  return (
    <section className="vacation-screen" aria-live="polite">
      <div className="vacation-sparkles" aria-hidden="true">
        {Array.from({ length: 22 }).map((_, index) => (
          <span
            key={index}
            style={{
              "--x": `${(index * 19) % 100}%`,
              "--y": `${(index * 31) % 84}%`,
              "--delay": `${(index % 8) * 0.18}s`,
            }}
          />
        ))}
      </div>

      <svg
        className="vacation-svg"
        viewBox="0 0 1200 760"
        role="img"
        aria-label="איור מונפש של חופשה עם שמש, ים, דקלים וכדור חוף"
      >
        <defs>
          <linearGradient id="vacationSky" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="56%" stopColor="#bff4ff" />
            <stop offset="100%" stopColor="#fff1b8" />
          </linearGradient>
          <linearGradient id="vacationSea" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#16a6a2" />
            <stop offset="52%" stopColor="#19c6d1" />
            <stop offset="100%" stopColor="#4f8df7" />
          </linearGradient>
          <linearGradient id="vacationSand" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#ffe08a" />
            <stop offset="100%" stopColor="#ffbe62" />
          </linearGradient>
          <clipPath id="ballClip">
            <circle cx="950" cy="592" r="58" />
          </clipPath>
        </defs>

        <rect width="1200" height="760" fill="url(#vacationSky)" />

        <g className="vacation-sun">
          <circle cx="174" cy="132" r="68" fill="#ffd166" />
          <circle cx="174" cy="132" r="92" fill="none" stroke="#ffd166" strokeOpacity="0.34" strokeWidth="18" />
        </g>

        <g className="vacation-cloud cloud-one">
          <ellipse cx="740" cy="112" rx="68" ry="28" fill="#ffffff" opacity="0.88" />
          <ellipse cx="694" cy="113" rx="42" ry="24" fill="#ffffff" opacity="0.88" />
          <ellipse cx="782" cy="103" rx="42" ry="30" fill="#ffffff" opacity="0.88" />
        </g>
        <g className="vacation-cloud cloud-two">
          <ellipse cx="335" cy="214" rx="76" ry="30" fill="#ffffff" opacity="0.78" />
          <ellipse cx="282" cy="216" rx="42" ry="22" fill="#ffffff" opacity="0.78" />
          <ellipse cx="382" cy="203" rx="45" ry="31" fill="#ffffff" opacity="0.78" />
        </g>

        <g className="vacation-plane">
          <path d="M1015 126 L1120 88 L1070 150 L1062 218 L1028 160 L940 152 Z" fill="#ffffff" />
          <path d="M1028 160 L1084 129" fill="none" stroke="#2c7be5" strokeWidth="8" strokeLinecap="round" />
          <path d="M935 191 C820 184 754 151 670 102" fill="none" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="10" strokeLinecap="round" strokeDasharray="24 18" />
        </g>

        <path d="M0 390 C150 350 275 430 425 390 C590 345 715 430 885 385 C1015 350 1100 367 1200 344 L1200 760 L0 760 Z" fill="url(#vacationSea)" />
        <path className="wave wave-one" d="M-40 430 C90 388 210 463 350 425 C510 382 650 462 805 421 C960 379 1084 432 1240 392" fill="none" stroke="#e8ffff" strokeWidth="16" strokeLinecap="round" opacity="0.78" />
        <path className="wave wave-two" d="M-60 500 C95 455 246 534 405 492 C548 454 705 530 865 489 C1012 451 1108 494 1260 462" fill="none" stroke="#ffffff" strokeWidth="12" strokeLinecap="round" opacity="0.5" />

        <path d="M0 596 C172 564 287 630 444 602 C613 571 716 626 875 590 C1015 558 1103 578 1200 552 L1200 760 L0 760 Z" fill="url(#vacationSand)" />
        <path d="M0 616 C134 592 281 640 442 618 C617 594 729 642 898 611 C1015 590 1110 603 1200 586" fill="none" stroke="#fff4c2" strokeWidth="12" strokeLinecap="round" opacity="0.7" />

        <g className="palm palm-left">
          <path d="M176 662 C176 555 205 475 235 398" fill="none" stroke="#8b5e3c" strokeWidth="24" strokeLinecap="round" />
          <path d="M235 401 C181 379 126 385 81 422 C142 426 191 422 235 401Z" fill="#249962" />
          <path d="M236 398 C202 340 147 308 76 309 C132 353 179 382 236 398Z" fill="#2fb66f" />
          <path d="M238 397 C265 334 317 294 385 281 C344 338 295 378 238 397Z" fill="#24a669" />
          <path d="M239 402 C294 386 347 395 397 433 C334 433 285 424 239 402Z" fill="#37c77b" />
        </g>

        <g className="palm palm-right">
          <path d="M1084 669 C1080 570 1058 488 1029 411" fill="none" stroke="#8b5e3c" strokeWidth="22" strokeLinecap="round" />
          <path d="M1028 413 C978 392 921 400 878 438 C938 439 984 430 1028 413Z" fill="#22955f" />
          <path d="M1027 409 C984 356 932 334 864 344 C925 380 973 401 1027 409Z" fill="#31b871" />
          <path d="M1027 409 C1054 345 1106 307 1175 300 C1134 354 1085 393 1027 409Z" fill="#22a466" />
          <path d="M1027 414 C1080 401 1136 414 1179 454 C1121 452 1074 438 1027 414Z" fill="#35c47a" />
        </g>

        <g className="beach-ball" clipPath="url(#ballClip)">
          <circle cx="950" cy="592" r="58" fill="#ffffff" />
          <path d="M950 534 L950 650 L1008 592 Z" fill="#ff6b5f" />
          <path d="M950 534 L892 592 L950 592 Z" fill="#ffd166" />
          <path d="M950 592 L892 592 L950 650 Z" fill="#4f8df7" />
          <path d="M950 534 C926 558 924 621 950 650" fill="none" stroke="#202124" strokeOpacity="0.18" strokeWidth="5" />
          <circle cx="950" cy="592" r="58" fill="none" stroke="#202124" strokeOpacity="0.14" strokeWidth="5" />
        </g>
      </svg>

      <div className="vacation-content">
        <p className="eyebrow">הבריחה הושלמה</p>
        <h1>חופשה נעימה!</h1>
        <p>כל הכבוד, פתחתם את הקוד הסופי.</p>
        <button className="vacation-button" type="button" onClick={() => onNavigate("/")}>
          <Home aria-hidden="true" />
          חזרה לשלבים
        </button>
      </div>
    </section>
  );
}

function Confetti() {
  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: 30 }).map((_, index) => (
        <span
          key={index}
          style={{
            "--x": `${(index * 13) % 100}%`,
            "--delay": `${(index % 9) * 0.08}s`,
            "--spin": `${index % 2 === 0 ? 1 : -1}`,
          }}
        />
      ))}
    </div>
  );
}

function AnimatedBackdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </div>
  );
}
