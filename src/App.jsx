import {
  Check,
  Home,
  LockKeyhole,
  Moon,
  QrCode,
  RefreshCcw,
  Sparkles,
  Sun,
  Trophy,
  X,
} from "lucide-react";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { challenges, roomConfig } from "./data/challenges.js";

const STORAGE_KEY = "qr-escape-room-solved-v1";
const THEME_KEY = "qr-escape-room-theme-v1";

function normalizeCode(value) {
  return value.trim().replace(/\s+/g, "");
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

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const activeChallenge = useMemo(
    () => challenges.find((challenge) => challenge.path === path),
    [path],
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
        </nav>
      </header>

      <main>
        {activeChallenge ? (
          <ChallengePage
            challenge={activeChallenge}
            solved={Boolean(solved[activeChallenge.id])}
            onSolve={markSolved}
            onNavigate={navigate}
          />
        ) : path === "/final" ? (
          <FinalPage solved={solved} onNavigate={navigate} />
        ) : (
          <HomePage
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

function HomePage({ solved, solvedCount, onNavigate, onReset }) {
  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">משחק QR קצר</p>
        <h1>{roomConfig.title}</h1>
        <p>{roomConfig.subtitle}</p>
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
        {challenges.map((challenge) => (
          <button
            className={`challenge-card ${solved[challenge.id] ? "is-solved" : ""}`}
            key={challenge.id}
            type="button"
            onClick={() => onNavigate(challenge.path)}
          >
            <span className="card-index">{challenge.id}</span>
            <span>
              <strong>{challenge.title}</strong>
              <small>{solved[challenge.id] ? `נמצא: ${challenge.reward}` : "מוכן לסריקה"}</small>
            </span>
            {solved[challenge.id] ? <Check aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
          </button>
        ))}
      </div>

      <button className="primary-button wide-button" type="button" onClick={() => onNavigate("/final")}>
        <Trophy aria-hidden="true" />
        מעבר לקוד הסופי
      </button>
    </section>
  );
}

function ChallengePage({ challenge, solved, onSolve, onNavigate }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState(solved ? "success" : "idle");

  useEffect(() => {
    setValue("");
    setResult(solved ? "success" : "idle");
  }, [challenge.id, solved]);

  function submitAnswer(event) {
    event.preventDefault();
    const normalizedValue = value.trim();

    if (normalizedValue === challenge.answer) {
      setResult("success");
      onSolve(challenge.id);
      return;
    }

    setResult("error");
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
        <button className="primary-button" type="submit">
          <Sparkles aria-hidden="true" />
          בדיקה
        </button>
      </form>

      <ResultMessage result={result} reward={challenge.reward} />

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

  return (
    <div className="hint-line">
      פתרון נכון יגלה אות או חלק מהקוד הסופי.
    </div>
  );
}

function FinalPage({ solved, onNavigate }) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState("idle");

  function submitFinal(event) {
    event.preventDefault();
    const normalizedValue = normalizeCode(value);
    const normalizedFinalCode = normalizeCode(roomConfig.finalCode);

    if (normalizedValue === normalizedFinalCode) {
      setResult("success");
      return;
    }

    setResult("error");
  }

  return (
    <section className={`play-panel final-panel ${result === "error" ? "shake" : ""}`}>
      {result === "success" && <Confetti />}

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
        <button className="primary-button" type="submit">
          <Trophy aria-hidden="true" />
          פתיחה
        </button>
      </form>

      {result === "success" && (
        <div className="result success-result" role="status">
          <Sparkles aria-hidden="true" />
          <span className="result-copy">
            <strong className="result-title">כל הכבוד!</strong>
            <small>הצלחתם לפתוח את הקוד הסופי. הבריחה הושלמה.</small>
          </span>
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
