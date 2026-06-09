import {
  BarChart3,
  Check,
  LockKeyhole,
  Home,
  LoaderCircle,
  LogOut,
  Moon,
  Pencil,
  Plus,
  QrCode,
  RefreshCcw,
  Save,
  Settings,
  Sparkles,
  Sun,
  Trash2,
  Trophy,
  UserRound,
  X,
} from "lucide-react";
import React from "react";
import { useEffect, useMemo, useState } from "react";
import { defaultPublicGameConfig } from "./data/challenges.js";

const STORAGE_KEY = "qr-escape-room-solved-v1";
const THEME_KEY = "qr-escape-room-theme-v1";
const ADMIN_TOKEN_KEY = "qr-escape-room-admin-token-v1";
const PLAYER_SESSION_KEY = "qr-escape-room-player-session-v1";
const PLAYER_PROFILE_KEY = "qr-escape-room-player-profile-v1";
const GAME_ACCESS_KEY = "qr-escape-room-game-access-v1";
const DEFAULT_GAME_ID = "main";

const API = {
  publicConfig: "/.netlify/functions/public-config",
  publicGames: "/.netlify/functions/public-games",
  gameAccess: "/.netlify/functions/game-access",
  checkAnswer: "/.netlify/functions/check-answer",
  checkFinal: "/.netlify/functions/check-final",
  adminLogin: "/.netlify/functions/admin-login",
  adminConfig: "/.netlify/functions/admin-config",
  adminAnalytics: "/.netlify/functions/admin-analytics",
  adminGames: "/.netlify/functions/admin-games",
  adminSettings: "/.netlify/functions/admin-settings",
  adminUsers: "/.netlify/functions/admin-users",
  leaderboard: "/.netlify/functions/leaderboard",
  playerLogin: "/.netlify/functions/player-login",
  requestPlayerOtp: "/.netlify/functions/request-player-otp",
  verifyPlayerOtp: "/.netlify/functions/verify-player-otp",
};

function normalizeGameId(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || DEFAULT_GAME_ID;
}

function getRouteInfo(pathname) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === DEFAULT_GAME_ID) {
    return {
      gameId: DEFAULT_GAME_ID,
      gamePath: `/${parts.slice(1).join("/")}` || "/",
      isLobby: false,
    };
  }

  if (parts[0] === "g" && parts[1]) {
    return {
      gameId: normalizeGameId(parts[1]),
      gamePath: `/${parts.slice(2).join("/")}` || "/",
      isLobby: false,
    };
  }

  return { gameId: DEFAULT_GAME_ID, gamePath: pathname || "/", isLobby: pathname === "/" || !pathname };
}

function buildPath(gameId, gamePath) {
  const cleanGamePath = gamePath.startsWith("/") ? gamePath : `/${gamePath}`;
  return normalizeGameId(gameId) === DEFAULT_GAME_ID ? `/${DEFAULT_GAME_ID}${cleanGamePath}` : `/g/${normalizeGameId(gameId)}${cleanGamePath}`;
}

function buildDirectGamePath(gameId, gamePath = "/") {
  const cleanGamePath = gamePath.startsWith("/") ? gamePath : `/${gamePath}`;
  if (normalizeGameId(gameId) === DEFAULT_GAME_ID) {
    return `/${DEFAULT_GAME_ID}${cleanGamePath}`;
  }
  return `/g/${normalizeGameId(gameId)}${cleanGamePath}`;
}

function withGame(url, gameId) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}gameId=${encodeURIComponent(normalizeGameId(gameId))}`;
}

function storageKeyForGame(baseKey, gameId) {
  return normalizeGameId(gameId) === DEFAULT_GAME_ID ? baseKey : `${baseKey}:${normalizeGameId(gameId)}`;
}

function createRandomGameSlug() {
  return `game-${Math.random().toString(36).slice(2, 8)}`;
}

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

function getEditableText(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
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
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error ?? `Request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
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

async function deleteJson(url, body, token) {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.error ?? `Request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
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

function readSolved(gameId = DEFAULT_GAME_ID) {
  try {
    return JSON.parse(localStorage.getItem(storageKeyForGame(STORAGE_KEY, gameId))) ?? {};
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

function readPlayerSession(gameId = DEFAULT_GAME_ID) {
  try {
    return JSON.parse(localStorage.getItem(storageKeyForGame(PLAYER_SESSION_KEY, gameId))) ?? null;
  } catch {
    return null;
  }
}

function readPlayerProfile() {
  try {
    return JSON.parse(localStorage.getItem(PLAYER_PROFILE_KEY)) ?? null;
  } catch {
    return null;
  }
}

function readGameAccess(gameId = DEFAULT_GAME_ID) {
  try {
    return localStorage.getItem(storageKeyForGame(GAME_ACCESS_KEY, gameId)) === "unlocked";
  } catch {
    return false;
  }
}

function formatDuration(milliseconds) {
  if (!Number.isFinite(milliseconds)) {
    return "0:00";
  }

  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function App() {
  const [routeInfo, setRouteInfo] = useState(() => getRouteInfo(window.location.pathname));
  const { gameId, gamePath: path, isLobby } = routeInfo;
  const [solved, setSolved] = useState(() => readSolved(gameId));
  const [theme, setTheme] = useState(readTheme);
  const [playerSession, setPlayerSession] = useState(() => readPlayerSession(gameId));
  const [playerProfile, setPlayerProfile] = useState(readPlayerProfile);
  const [leaderboard, setLeaderboard] = useState([]);
  const [publicGames, setPublicGames] = useState([]);
  const [gameUnlocked, setGameUnlocked] = useState(() => readGameAccess(gameId));
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLeaderboardModal, setShowLeaderboardModal] = useState(false);
  const [gameConfig, setGameConfig] = useState(defaultPublicGameConfig);
  const [configStatus, setConfigStatus] = useState("loading");
  const { roomConfig, challenges } = gameConfig;

  useEffect(() => {
    const onPopState = () => setRouteInfo(getRouteInfo(window.location.pathname));
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
        const nextConfig = await getJson(withGame(API.publicConfig, gameId));

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
  }, [gameId]);

  useEffect(() => {
    loadLeaderboard();

    const intervalId = window.setInterval(loadLeaderboard, 10000);
    return () => window.clearInterval(intervalId);
  }, [gameId]);

  useEffect(() => {
    loadPublicGames();
  }, []);

  useEffect(() => {
    setSolved(readSolved(gameId));
    setPlayerSession(readPlayerSession(gameId));
    setGameUnlocked(readGameAccess(gameId));
  }, [gameId]);

  useEffect(() => {
    if (path === "/admin" || isLobby || playerSession || !playerProfile) {
      return;
    }

    let cancelled = false;

    async function createSessionFromProfile() {
      try {
        const session = await postJson(API.playerLogin, { ...playerProfile, gameId });
        const sessionWithGame = { ...session, gameId };
        localStorage.setItem(storageKeyForGame(PLAYER_SESSION_KEY, gameId), JSON.stringify(sessionWithGame));

        if (!cancelled) {
          setPlayerSession(sessionWithGame);
          setShowLoginModal(false);
          await loadLeaderboard();
        }
      } catch {
        if (!cancelled) {
          setPlayerProfile(null);
          localStorage.removeItem(PLAYER_PROFILE_KEY);
        }
      }
    }

    createSessionFromProfile();

    return () => {
      cancelled = true;
    };
  }, [gameId, isLobby, path, playerProfile, playerSession]);

  useEffect(() => {
    if (path === "/admin" || isLobby) {
      setShowLoginModal(false);
      return;
    }

    setShowLoginModal(!playerSession && !playerProfile);
  }, [gameId, isLobby, path, playerProfile, playerSession]);

  const activeChallenge = useMemo(
    () => challenges.find((challenge) => challenge.path === path),
    [challenges, path],
  );

  const solvedCount = challenges.filter((challenge) => solved[challenge.id]).length;

  function navigate(nextPath) {
    window.history.pushState({}, "", buildPath(gameId, nextPath));
    setRouteInfo({ gameId, gamePath: nextPath, isLobby: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateToGame(nextGameId, nextPath = "/") {
    const nextId = normalizeGameId(nextGameId);
    window.history.pushState({}, "", buildDirectGamePath(nextId, nextPath));
    setRouteInfo({ gameId: nextId, gamePath: nextPath, isLobby: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateAdmin() {
    window.history.pushState({}, "", "/admin");
    setRouteInfo({ gameId, gamePath: "/admin", isLobby: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigateLobby() {
    window.history.pushState({}, "", "/");
    setRouteInfo({ gameId: DEFAULT_GAME_ID, gamePath: "/", isLobby: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function markSolved(challengeId) {
    setSolved((current) => {
      const next = { ...current, [challengeId]: true };
      localStorage.setItem(storageKeyForGame(STORAGE_KEY, gameId), JSON.stringify(next));
      return next;
    });
  }

  function resetProgress() {
    localStorage.removeItem(storageKeyForGame(STORAGE_KEY, gameId));
    setSolved({});
  }

  async function loadLeaderboard() {
    try {
      const response = await getJson(withGame(API.leaderboard, gameId));
      setLeaderboard(response.leaderboard ?? []);
    } catch {
      setLeaderboard([]);
    }
  }

  async function loadPublicGames() {
    try {
      const response = await getJson(API.publicGames);
      setPublicGames(response.games ?? []);
    } catch {
      setPublicGames([]);
    }
  }

  async function unlockGame(password) {
    await postJson(API.gameAccess, { gameId, password });
    localStorage.setItem(storageKeyForGame(GAME_ACCESS_KEY, gameId), "unlocked");
    setGameUnlocked(true);
  }

  async function loginPlayer(credentials) {
    const session = await postJson(API.playerLogin, { ...credentials, gameId });
    const sessionWithGame = { ...session, gameId };
    const profile = { name: credentials.name, email: credentials.email ?? "" };
    localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(storageKeyForGame(PLAYER_SESSION_KEY, gameId), JSON.stringify(sessionWithGame));
    setPlayerProfile(profile);
    setPlayerSession(sessionWithGame);
    setShowLoginModal(false);
    await loadLeaderboard();
  }

  async function requestPlayerOtp(credentials) {
    return postJson(API.requestPlayerOtp, { ...credentials, gameId });
  }

  async function verifyPlayerOtp(credentials) {
    const session = await postJson(API.verifyPlayerOtp, { ...credentials, gameId });
    const sessionWithGame = { ...session, gameId };
    const profile = { name: credentials.name, email: credentials.email ?? "" };
    localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(storageKeyForGame(PLAYER_SESSION_KEY, gameId), JSON.stringify(sessionWithGame));
    setPlayerProfile(profile);
    setPlayerSession(sessionWithGame);
    setShowLoginModal(false);
    await loadLeaderboard();
  }

  function updatePlayer(player) {
    if (!playerSession || !player) {
      return;
    }

    const nextSession = { ...playerSession, player };
    localStorage.setItem(storageKeyForGame(PLAYER_SESSION_KEY, gameId), JSON.stringify(nextSession));
    setPlayerSession(nextSession);
  }

  function logoutPlayer() {
    localStorage.removeItem(storageKeyForGame(PLAYER_SESSION_KEY, gameId));
    localStorage.removeItem(PLAYER_PROFILE_KEY);
    localStorage.removeItem(storageKeyForGame(STORAGE_KEY, gameId));
    setPlayerProfile(null);
    setPlayerSession(null);
    setSolved({});
  }

  return (
    <div className="app-shell">
      <AnimatedBackdrop />
      <header className="topbar">
        <button className="brand-button" type="button" onClick={navigateLobby}>
          <QrCode aria-hidden="true" />
          <span>{roomConfig.title}</span>
        </button>

        <nav className="nav-actions" aria-label="ניווט">
          {playerSession?.player?.name && (
            <span className="player-pill">
              <span className="player-pill-name">שלום {playerSession.player.name}</span>
              <button type="button" onClick={logoutPlayer} aria-label="יציאה מהמשחק" title="יציאה מהמשחק">
                <LogOut aria-hidden="true" />
              </button>
            </span>
          )}
          {!playerSession && (
            <button
              className="icon-button"
              type="button"
              onClick={() => setShowLoginModal(true)}
              aria-label="כניסה למשחק"
              title="כניסה למשחק"
            >
              <UserRound aria-hidden="true" />
            </button>
          )}
          <button
            className="icon-button"
            type="button"
            onClick={() => setShowLeaderboardModal(true)}
            aria-label="לוח תוצאות"
            title="לוח תוצאות"
          >
            <BarChart3 aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={navigateLobby}
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
            onClick={navigateAdmin}
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
            gameId={gameId}
            onGameChange={(nextGameId) => {
              const nextId = normalizeGameId(nextGameId);
              window.history.pushState({}, "", "/admin");
              setRouteInfo({ gameId: nextId, gamePath: "/admin", isLobby: false });
            }}
            onPublicConfigChange={(publicConfig) => setGameConfig(publicConfig)}
            onResetProgress={resetProgress}
            onPublicGamesRefresh={loadPublicGames}
          />
        ) : isLobby ? (
          <GamesDirectoryPage
            games={publicGames}
            roomConfig={roomConfig}
            onNavigateToGame={navigateToGame}
          />
        ) : roomConfig.passwordProtected && !gameUnlocked ? (
          <GamePasswordGate roomConfig={roomConfig} onUnlock={unlockGame} onBack={() => navigateToGame(DEFAULT_GAME_ID)} />
        ) : activeChallenge ? (
          !playerSession ? (
            <HomePage
              challenges={challenges}
              roomConfig={roomConfig}
              configStatus={configStatus}
              playerSession={playerSession}
              solved={solved}
              solvedCount={solvedCount}
              onOpenLogin={() => setShowLoginModal(true)}
              onNavigate={navigate}
              onReset={resetProgress}
            />
          ) : isChallengeUnlocked(challenges, activeChallenge, solved) ? (
            <ChallengePage
              challenge={activeChallenge}
              challenges={challenges}
              gameId={gameId}
              roomConfig={roomConfig}
              playerSession={playerSession}
              solved={isChallengeSolved(activeChallenge, solved)}
              onSolve={markSolved}
              onNavigate={navigate}
              onPlayerUpdate={updatePlayer}
              onLeaderboardRefresh={loadLeaderboard}
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
          !playerSession ? (
            <HomePage
              challenges={challenges}
              roomConfig={roomConfig}
              configStatus={configStatus}
              playerSession={playerSession}
              solved={solved}
              solvedCount={solvedCount}
              onOpenLogin={() => setShowLoginModal(true)}
              onNavigate={navigate}
              onReset={resetProgress}
            />
          ) : areAllChallengesSolved(challenges, solved) ? (
            <FinalPage
              challenges={challenges}
              gameId={gameId}
              roomConfig={roomConfig}
              playerSession={playerSession}
              solved={solved}
              onNavigate={navigate}
              onPlayerUpdate={updatePlayer}
              onLeaderboardRefresh={loadLeaderboard}
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
            playerSession={playerSession}
            solved={solved}
            solvedCount={solvedCount}
            onOpenLogin={() => setShowLoginModal(true)}
            onNavigate={navigate}
            onReset={resetProgress}
          />
        )}
      </main>

      {showLoginModal && (
        <Modal title="כניסה למשחק" onClose={() => setShowLoginModal(false)}>
          <LoginChoices
            showEmailLogin={roomConfig.showEmailLogin}
            onGuestLogin={loginPlayer}
            onRequestOtp={requestPlayerOtp}
            onVerifyOtp={verifyPlayerOtp}
          />
        </Modal>
      )}

      {showLeaderboardModal && (
        <Modal title="לוח תוצאות" wide onClose={() => setShowLeaderboardModal(false)}>
          <LeaderboardPanel leaderboard={leaderboard} />
        </Modal>
      )}
    </div>
  );
}

function GamesDirectoryPage({ games, roomConfig, onNavigateToGame }) {
  return (
    <section className="hero-section games-directory">
      <div className="games-hero">
        <span className="round-badge games-hero-badge">
          <QrCode aria-hidden="true" />
        </span>
        <div className="hero-copy">
          <p className="eyebrow">לובי המשחקים</p>
          <h1>{roomConfig.title || "חדר בריחה"}</h1>
          <p>בחרו חדר, היכנסו למשימה, ואספו רמזים בדרך לקוד הסופי.</p>
        </div>
      </div>

      {games.length > 0 ? (
        <div className="game-picker-grid">
          {games.map((game) => (
            <button className="game-picker-card" key={game.id} type="button" onClick={() => onNavigateToGame(game.id)}>
              <span className={`game-card-icon ${game.locked ? "is-locked" : ""}`}>
                {game.locked ? <LockKeyhole aria-hidden="true" /> : <QrCode aria-hidden="true" />}
              </span>
              <span>
                <strong>{game.title}</strong>
                <small>{game.locked ? "נדרשת סיסמה" : "פתוח למשחק"}</small>
              </span>
              <span className="game-card-path" dir="ltr">
                {game.id === DEFAULT_GAME_ID ? "/main" : `/g/${game.id}`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-game-state">
          <strong>עדיין אין משחקים פעילים.</strong>
          <span>אדמין יכול ליצור משחק חדש בפאנל הניהול.</span>
        </div>
      )}
    </section>
  );
}

function GamePasswordGate({ roomConfig, onBack, onUnlock }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function submitPassword(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await onUnlock(password);
      setStatus("idle");
    } catch {
      setStatus("idle");
      setMessage("הסיסמה לא נכונה. נסו שוב.");
    }
  }

  return (
    <section className="play-panel password-gate">
      <span className="round-badge">
        <LockKeyhole aria-hidden="true" />
      </span>
      <p className="eyebrow">משחק נעול</p>
      <h1>{roomConfig.title}</h1>
      <form className="code-form" onSubmit={submitPassword}>
        <label htmlFor="game-password">סיסמת משחק</label>
        <input
          id="game-password"
          className="admin-input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        <button className="primary-button" type="submit" disabled={status === "loading"}>
          {status === "loading" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Sparkles aria-hidden="true" />}
          כניסה
        </button>
      </form>
      {message && <p className="admin-message">{message}</p>}
      <button className="ghost-button" type="button" onClick={onBack}>
        חזרה לרשימת המשחקים
      </button>
    </section>
  );
}

function HomePage({
  challenges,
  roomConfig,
  configStatus,
  playerSession,
  solved,
  solvedCount,
  onOpenLogin,
  onNavigate,
  onReset,
}) {
  const finalUnlocked = areAllChallengesSolved(challenges, solved);

  return (
    <section className="hero-section">
      <div className="hero-copy">
        <p className="eyebrow">המשימה מתחילה כאן</p>
        <h1>{roomConfig.title}</h1>
        {roomConfig.subtitle && <p>{roomConfig.subtitle}</p>}
        {configStatus === "fallback" && (
          <p className="config-note">האתר עובד עכשיו עם הגדרות ברירת מחדל עד שהשרת יהיה זמין.</p>
        )}
      </div>

      {playerSession ? (
        <div className="player-status">
          <strong>שלום {playerSession.player.name}</strong>
          <span>הניקוד והזמנים שלך נשמרים לדירוג.</span>
        </div>
      ) : (
        <div className="player-status">
          <strong>עדיין לא נכנסתם למשחק</strong>
          <span>אפשר להתחיל כאורח עם שם בלבד.</span>
          <button className="primary-button" type="button" onClick={onOpenLogin}>
            <UserRound aria-hidden="true" />
            כניסה למשחק
          </button>
        </div>
      )}

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

function PlayerGate({ onLogin }) {
  return (
    <section className="play-panel">
      <div className="panel-header">
        <span className="round-badge">
          <Trophy aria-hidden="true" />
        </span>
        <div>
          <p className="eyebrow">כניסה למשחק</p>
          <h1>לפני שמתחילים</h1>
        </div>
      </div>
      <p className="lead">הכניסה שומרת ניקוד, זמן ודירוג. אין עדיין אימות מייל אמיתי.</p>
      <PlayerLoginPanel onLogin={onLogin} />
    </section>
  );
}

function LoginChoices({ showEmailLogin = true, onGuestLogin, onRequestOtp, onVerifyOtp }) {
  const [mode, setMode] = useState(showEmailLogin ? "email" : "guest");

  useEffect(() => {
    setMode(showEmailLogin ? "email" : "guest");
  }, [showEmailLogin]);

  return (
    <div className="login-choices">
      {mode === "email" ? (
        <>
          <EmailOtpPanel onRequestOtp={onRequestOtp} onVerifyOtp={onVerifyOtp} />
          <button className="ghost-button guest-switch-button" type="button" onClick={() => setMode("guest")}>
            <UserRound aria-hidden="true" />
            כניסה כאורח
          </button>
        </>
      ) : (
        <>
          <PlayerLoginPanel onLogin={onGuestLogin} />
          <button className="ghost-button guest-switch-button" type="button" onClick={() => setMode("email")}>
            <Sparkles aria-hidden="true" />
            חזרה לכניסה באימייל
          </button>
        </>
      )}
    </div>
  );
}

function PlayerLoginPanel({ onLogin }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function submitLogin(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await onLogin({ name });
      setStatus("idle");
    } catch {
      setStatus("idle");
      setMessage("לא הצלחנו להיכנס. בדקו את השם ונסו שוב.");
    }
  }

  return (
    <form className="player-login guest-login" onSubmit={submitLogin}>
      <div className="login-copy">
        <p className="eyebrow">המשך כאורח</p>
        <h2>שם בלבד ומתחילים</h2>
        <p>השם ישמש לדירוג ולסטטיסטיקות המשחק.</p>
      </div>
      <label>
        שם לתצוגה
        <input
          className="admin-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="איך לקרוא לך?"
          autoFocus
        />
      </label>
      <button className="primary-button" type="submit" disabled={status === "loading"}>
        {status === "loading" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <UserRound aria-hidden="true" />}
        המשך
      </button>
      {message && <p className="admin-message">{message}</p>}
    </form>
  );
}

function EmailOtpPanel({ onRequestOtp, onVerifyOtp }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState("email");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  async function requestOtp(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await onRequestOtp({ name, email });
      setStep("code");
      setStatus("idle");
      setMessage("שלחנו קוד בן 6 ספרות לאימייל. הקוד תקף ל-10 דקות.");
    } catch (error) {
      setStatus("idle");

      if (error.status === 409 || error.message === "email_provider_missing") {
        setMessage("כניסה באימייל מוכנה, אבל צריך להגדיר Environment variables ב-Netlify, לא OAuth providers.");
        return;
      }

      if (error.message === "invalid_email") {
        setMessage("האימייל לא נראה תקין.");
        return;
      }

      setMessage("לא הצלחנו לשלוח קוד כרגע.");
    }
  }

  async function verifyOtp(event) {
    event.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      await onVerifyOtp({ name, email, code });
      setStatus("idle");
    } catch (error) {
      setStatus("idle");

      if (error.message === "otp_expired") {
        setMessage("הקוד פג תוקף. בקשו קוד חדש.");
        setStep("email");
        return;
      }

      if (error.message === "otp_locked") {
        setMessage("היו יותר מדי ניסיונות. בקשו קוד חדש.");
        setStep("email");
        return;
      }

      setMessage("הקוד לא נכון. בדקו את האימייל ונסו שוב.");
    }
  }

  return (
    <section className="email-login" aria-label="כניסה באימייל">
      <div className="login-copy">
        <p className="eyebrow">כניסה באימייל</p>
        <h2>קוד חד-פעמי</h2>
        <p>הכניסו אימייל ונשלח קוד בן 6 ספרות.</p>
      </div>

      {step === "email" ? (
        <form className="player-login guest-login" onSubmit={requestOtp}>
          <label>
            שם לתצוגה
            <input
              className="admin-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="איך לקרוא לך?"
            />
          </label>
          <label>
            אימייל
            <input
              className="admin-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              dir="ltr"
            />
          </label>
          <button className="ghost-button" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Sparkles aria-hidden="true" />}
            שליחת קוד
          </button>
        </form>
      ) : (
        <form className="player-login guest-login" onSubmit={verifyOtp}>
          <label>
            קוד שקיבלת באימייל
            <input
              className="admin-input otp-input"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="123456"
              dir="ltr"
            />
          </label>
          <button className="primary-button" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Check aria-hidden="true" />}
            אימות וכניסה
          </button>
          <button className="ghost-button" type="button" onClick={() => setStep("email")}>
            שינוי אימייל
          </button>
        </form>
      )}

      {message && <p className="admin-message">{message}</p>}
    </section>
  );
}

function LeaderboardPanel({ leaderboard }) {
  if (!leaderboard.length) {
    return (
      <section className="leaderboard-panel" aria-label="דירוג שחקנים">
        <p className="empty-state">עדיין אין שחקנים בדירוג.</p>
      </section>
    );
  }

  return (
    <section className="leaderboard-panel" aria-label="דירוג שחקנים">
      <table className="leaderboard-table">
        <thead>
          <tr>
            <th>#</th>
            <th>שם</th>
            <th>שלב</th>
            <th>ניקוד</th>
            <th>זמן</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.slice(0, 12).map((player, index) => (
            <tr key={player.id}>
              <td>
                <span className={`rank-badge rank-${index + 1}`}>
                  {index < 3 ? ["🏆", "🥈", "🥉"][index] : index + 1}
                </span>
              </td>
              <td>{player.name}</td>
              <td>{player.level}</td>
              <td>{player.points}</td>
              <td>{formatDuration(player.totalMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Modal({ children, title, wide = false, locked = false, onClose }) {
  const close = locked ? undefined : onClose;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={close}>
      <section
        className={`modal-panel ${wide ? "is-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <h2>{title}</h2>
          {!locked && (
            <button className="icon-button" type="button" onClick={onClose} aria-label="סגירה" title="סגירה">
              <X aria-hidden="true" />
            </button>
          )}
        </div>
        {children}
      </section>
    </div>
  );
}

function ChallengePage({
  challenge,
  challenges,
  gameId,
  roomConfig,
  playerSession,
  solved,
  onSolve,
  onNavigate,
  onPlayerUpdate,
  onLeaderboardRefresh,
}) {
  const [value, setValue] = useState("");
  const [answerValues, setAnswerValues] = useState([]);
  const [choiceId, setChoiceId] = useState("");
  const [result, setResult] = useState(solved ? "success" : "idle");
  const answerFields = challenge.answerFields?.length ? challenge.answerFields.slice(0, 6) : [];
  const isChoiceQuestion = challenge.answerType === "choice";
  const numericOnly = Boolean(challenge.numericOnly);

  useEffect(() => {
    setValue("");
    setAnswerValues([]);
    setChoiceId("");
    setResult(solved ? "success" : "idle");
  }, [challenge.id, solved]);

  async function submitAnswer(event) {
    event.preventDefault();
    setResult("checking");

    try {
      const response = await postJson(API.checkAnswer, {
        id: challenge.id,
        answer: value,
        answers: answerValues,
        choiceId,
        gameId,
      }, playerSession.token);

      onPlayerUpdate(response.player);
      onLeaderboardRefresh();

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
        {isChoiceQuestion ? (
          <div className="choice-answer-grid" role="radiogroup" aria-label="בחירת תשובה">
            {challenge.choiceOptions.map((option) => (
              <label className={`choice-answer ${choiceId === option.id ? "is-selected" : ""}`} key={option.id}>
                <input
                  type="radio"
                  name={`choice-${challenge.id}`}
                  value={option.id}
                  checked={choiceId === option.id}
                  onChange={(event) => setChoiceId(event.target.value)}
                />
                <span>{option.text}</span>
              </label>
            ))}
          </div>
        ) : answerFields.length > 0 ? (
          <div className="multi-answer-row">
            {answerFields.map((field, index) => (
              <label key={field.id}>
                {field.label || `תשובה ${index + 1}`}
                <input
                  className="code-input compact-code-input"
                  autoComplete="off"
                  inputMode={numericOnly ? "numeric" : "text"}
                  pattern={numericOnly ? "[0-9]*" : undefined}
                  value={answerValues[index] ?? ""}
                  onChange={(event) =>
                    setAnswerValues((current) => {
                      const next = [...current];
                      next[index] = event.target.value;
                      return next;
                    })
                  }
                  dir="auto"
                />
              </label>
            ))}
          </div>
        ) : (
          <>
            <label htmlFor={`answer-${challenge.id}`}>הכניסו מספר</label>
            <input
              id={`answer-${challenge.id}`}
              className="code-input"
              inputMode={numericOnly ? "numeric" : "text"}
              pattern={numericOnly ? "[0-9]*" : undefined}
              autoComplete="off"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={numericOnly ? "000" : "תשובה"}
              dir={numericOnly ? "ltr" : "auto"}
            />
          </>
        )}
        <button className="primary-button" type="submit" disabled={result === "checking"}>
          {result === "checking" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Sparkles aria-hidden="true" />}
          {result === "checking" ? "בודק..." : "בדיקה"}
        </button>
      </form>

      <ResultMessage challenge={challenge} result={result} roomConfig={roomConfig} />
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

function ResultMessage({ challenge, result, roomConfig }) {
  const successMessage = getEditableText(
    challenge.successMessage,
    getEditableText(roomConfig.defaultSuccessMessage, "פתרתם את השלב וקיבלתם חלק מהקוד הסופי:"),
  );
  const errorMessage = getEditableText(
    challenge.errorMessage,
    getEditableText(roomConfig.defaultErrorMessage, "הקוד הזה לא פתח את השלב. בדקו את הרמז ונסו שוב."),
  );

  if (result === "success") {
    return (
      <div className="result success-result" role="status">
        <Check aria-hidden="true" />
        <span className="result-copy">
          <strong className="result-title">כל הכבוד!</strong>
          <small>{successMessage}</small>
        </span>
        <strong>{challenge.reward}</strong>
      </div>
    );
  }

  if (result === "error") {
    return (
      <div className="result error-result" role="alert">
        <X aria-hidden="true" />
        <span className="result-copy">
          <strong className="result-title">כמעט!</strong>
          <small>{errorMessage}</small>
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

function FinalPage({
  challenges,
  gameId,
  roomConfig,
  playerSession,
  solved,
  onNavigate,
  onPlayerUpdate,
  onLeaderboardRefresh,
}) {
  const [value, setValue] = useState("");
  const [result, setResult] = useState("idle");

  async function submitFinal(event) {
    event.preventDefault();
    setResult("checking");

    try {
      const response = await postJson(API.checkFinal, { code: value, gameId }, playerSession.token);
      onPlayerUpdate(response.player);
      onLeaderboardRefresh();

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
    return <VacationCelebration onNavigate={onNavigate} roomConfig={roomConfig} />;
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
            <small>
              {getEditableText(
                roomConfig.finalErrorMessage,
                "אפשר לכתוב את הקוד עם רווח או בלי רווח. בדקו את החלקים ונסו שוב.",
              )}
            </small>
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

function getNextChallengeId(challenges) {
  return Math.max(0, ...challenges.map((challenge) => Number(challenge.id) || 0)) + 1;
}

function createBlankChallenge(challenges) {
  const id = getNextChallengeId(challenges);

  return {
    id,
    path: `/q/${id}`,
    title: `קוד ${id}`,
    question: "",
    answerType: "open",
    answerInputMode: "auto",
    answer: "",
    answerFields: [],
    choiceOptions: [
      { id: "option-1", text: "", correct: true },
      { id: "option-2", text: "", correct: false },
    ],
    reward: "",
    points: "",
    wrongAnswerPenalty: "",
    successMessage: "",
    errorMessage: "",
  };
}

function AdminPage({
  fallbackConfig,
  gameId,
  onGameChange,
  onPublicConfigChange,
  onPublicGamesRefresh,
  onResetProgress,
}) {
  const [token, setToken] = useState(() => localStorage.getItem(ADMIN_TOKEN_KEY) ?? "");
  const [adminIdentifier, setAdminIdentifier] = useState("admin");
  const [password, setPassword] = useState("");
  const [config, setConfig] = useState(null);
  const [globalSettings, setGlobalSettings] = useState({ showEmailLogin: true });
  const [analytics, setAnalytics] = useState(null);
  const [activeAdminTab, setActiveAdminTab] = useState("games");
  const [games, setGames] = useState([]);
  const [newGameTitle, setNewGameTitle] = useState("");
  const [newGameId, setNewGameId] = useState("");
  const [editingGame, setEditingGame] = useState(null);
  const [editingGameConfig, setEditingGameConfig] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [temporaryAdminPassword, setTemporaryAdminPassword] = useState("");
  const [status, setStatus] = useState(token ? "loading" : "idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      return;
    }

    loadAdminConfig(token);
  }, [token, gameId]);

  async function loadAdminConfig(activeToken) {
    setStatus("loading");
    setMessage("");

    try {
      const [nextConfig, nextAnalytics] = await Promise.all([
        getJson(withGame(API.adminConfig, gameId), activeToken),
        getJson(withGame(API.adminAnalytics, gameId), activeToken),
      ]);
      setConfig(nextConfig);
      setAnalytics(nextAnalytics);
      try {
        const [usersResponse, gamesResponse, settingsResponse] = await Promise.all([
          getJson(API.adminUsers, activeToken),
          getJson(API.adminGames, activeToken),
          getJson(API.adminSettings, activeToken),
        ]);
        setAdminUsers(usersResponse.users ?? []);
        setGames(gamesResponse.games ?? []);
        setGlobalSettings(settingsResponse);
      } catch {
        setAdminUsers([]);
      }
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
      const identifier = adminIdentifier.trim();
      const response = await postJson(API.adminLogin, {
        password,
        ...(identifier.includes("@") ? { email: identifier } : { username: identifier }),
      });
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

  function updateGlobalSetting(field, value) {
    setGlobalSettings((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveGlobalSettings(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const nextSettings = await putJson(API.adminSettings, globalSettings, token);
      const publicConfig = await getJson(withGame(`${API.publicConfig}?ts=${Date.now()}`, gameId));
      setGlobalSettings(nextSettings);
      onPublicConfigChange(publicConfig);
      setStatus("ready");
      setMessage("ההגדרות הכלליות נשמרו לכל המשחקים.");
    } catch {
      setStatus("ready");
      setMessage("שמירת ההגדרות הכלליות נכשלה.");
    }
  }

  function updateChallenge(index, field, value) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) =>
        challengeIndex === index ? { ...challenge, [field]: value } : challenge,
      ),
    }));
  }

  function updateChallengeAnswerField(index, fieldIndex, field, value) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) => {
        if (challengeIndex !== index) {
          return challenge;
        }

        const answerFields = [...(challenge.answerFields ?? [])];
        answerFields[fieldIndex] = {
          id: answerFields[fieldIndex]?.id ?? `field-${fieldIndex + 1}`,
          label: answerFields[fieldIndex]?.label ?? "",
          answer: answerFields[fieldIndex]?.answer ?? "",
          [field]: value,
        };
        return { ...challenge, answerFields };
      }),
    }));
  }

  function addChallengeAnswerField(index) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) => {
        if (challengeIndex !== index || (challenge.answerFields?.length ?? 0) >= 6) {
          return challenge;
        }

        const nextIndex = (challenge.answerFields?.length ?? 0) + 1;
        return {
          ...challenge,
          answerFields: [...(challenge.answerFields ?? []), { id: `field-${nextIndex}`, label: `שדה ${nextIndex}`, answer: "" }],
        };
      }),
    }));
  }

  function removeChallengeAnswerField(index, fieldIndex) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) =>
        challengeIndex === index
          ? { ...challenge, answerFields: (challenge.answerFields ?? []).filter((_, itemIndex) => itemIndex !== fieldIndex) }
          : challenge,
      ),
    }));
  }

  function updateChoiceOption(index, optionIndex, field, value) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) => {
        if (challengeIndex !== index) {
          return challenge;
        }

        const choiceOptions = [...(challenge.choiceOptions ?? [])];
        choiceOptions[optionIndex] = {
          id: choiceOptions[optionIndex]?.id ?? `option-${optionIndex + 1}`,
          text: choiceOptions[optionIndex]?.text ?? "",
          correct: choiceOptions[optionIndex]?.correct ?? false,
          [field]: value,
        };

        if (field === "correct" && value) {
          return {
            ...challenge,
            choiceOptions: choiceOptions.map((option, itemIndex) => ({ ...option, correct: itemIndex === optionIndex })),
          };
        }

        return { ...challenge, choiceOptions };
      }),
    }));
  }

  function addChoiceOption(index) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) => {
        if (challengeIndex !== index || (challenge.choiceOptions?.length ?? 0) >= 8) {
          return challenge;
        }

        const nextIndex = (challenge.choiceOptions?.length ?? 0) + 1;
        return {
          ...challenge,
          choiceOptions: [...(challenge.choiceOptions ?? []), { id: `option-${nextIndex}`, text: "", correct: false }],
        };
      }),
    }));
  }

  function removeChoiceOption(index, optionIndex) {
    setConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) => {
        if (challengeIndex !== index) {
          return challenge;
        }

        const choiceOptions = (challenge.choiceOptions ?? []).filter((_, itemIndex) => itemIndex !== optionIndex);
        return {
          ...challenge,
          choiceOptions: choiceOptions.some((option) => option.correct)
            ? choiceOptions
            : choiceOptions.map((option, itemIndex) => ({ ...option, correct: itemIndex === 0 })),
        };
      }),
    }));
  }

  function addChallenge() {
    setConfig((current) => ({
      ...current,
      challenges: [...current.challenges, createBlankChallenge(current.challenges)],
    }));
  }

  function removeChallenge(index) {
    setConfig((current) => {
      if (current.challenges.length <= 1) {
        return current;
      }

      return {
        ...current,
        challenges: current.challenges.filter((_, challengeIndex) => challengeIndex !== index),
      };
    });
  }

  async function saveConfig(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const response = await putJson(withGame(API.adminConfig, gameId), config, token);
      const publicConfig =
        response.publicConfig ?? (await getJson(withGame(`${API.publicConfig}?ts=${Date.now()}`, gameId)));
      setConfig(response.config);
      onPublicConfigChange(publicConfig);
      onPublicGamesRefresh();
      onResetProgress();
      loadAdminConfig(token);
      setStatus("ready");
      setMessage("השינויים נשמרו. ההתקדמות בדפדפן הזה אופסה כדי לבדוק את ההגדרות החדשות מיד.");
    } catch {
      setStatus("ready");
      setMessage("השמירה נכשלה. נסה שוב.");
    }
  }

  async function createNewGame(event) {
    event.preventDefault();
    setMessage("");

    try {
      const response = await postJson(
        API.adminGames,
        {
          id: newGameId || createRandomGameSlug(),
          title: newGameTitle,
          sourceGameId: gameId,
        },
        token,
      );
      const gamesResponse = await getJson(API.adminGames, token);
      setGames(gamesResponse.games ?? []);
      setNewGameTitle("");
      setNewGameId("");
      onGameChange(response.game.id);
      onPublicGamesRefresh();
      setMessage("המשחק החדש נוצר. אפשר לערוך לו שאלות, קודים וניקוד בטאב משחק.");
    } catch {
      setMessage("לא הצלחנו ליצור משחק. בדוק שהשם/כתובת לא קיימים כבר.");
    }
  }

  async function deleteExistingGame(targetGameId) {
    const cleanGameId = normalizeGameId(targetGameId);

    if (!window.confirm("למחוק את המשחק הזה? הפעולה תמחק גם שחקנים, דירוג ונתונים שלו.")) {
      return;
    }

    try {
      const response = await deleteJson(API.adminGames, { id: cleanGameId }, token);
      setGames(response.games ?? []);
      onPublicGamesRefresh();
      setMessage("המשחק נמחק.");

      if (cleanGameId === gameId) {
        onGameChange(response.games?.[0]?.id ?? DEFAULT_GAME_ID);
      }
    } catch {
      setMessage("לא הצלחנו למחוק את המשחק.");
    }
  }

  async function resetGameData(targetGameId) {
    const cleanGameId = normalizeGameId(targetGameId);

    if (!window.confirm("לאפס את כל השחקנים, הדירוג והנתונים של המשחק הזה? המשחק והשאלות יישארו.")) {
      return;
    }

    try {
      const nextAnalytics = await deleteJson(withGame(API.adminAnalytics, cleanGameId), { reset: true }, token);

      if (cleanGameId === gameId) {
        setAnalytics(nextAnalytics);
        onResetProgress();
      }

      setMessage("נתוני המשחק אופסו.");
    } catch {
      setMessage("לא הצלחנו לאפס את נתוני המשחק.");
    }
  }

  async function openGameEditor(game) {
    setMessage("");
    setEditingGame(game);
    setEditingGameConfig(null);

    try {
      const nextConfig = await getJson(withGame(API.adminConfig, game.id), token);
      setEditingGameConfig(nextConfig);
    } catch {
      setMessage("לא הצלחנו לפתוח את עריכת המשחק.");
      setEditingGame(null);
    }
  }

  function updateEditingGameRoomConfig(field, value) {
    setEditingGameConfig((current) => ({
      ...current,
      roomConfig: {
        ...current.roomConfig,
        [field]: value,
      },
    }));
  }

  async function saveGameEdit(event) {
    event.preventDefault();

    if (!editingGame || !editingGameConfig) {
      return;
    }

    setMessage("");

    try {
      const response = await putJson(withGame(API.adminConfig, editingGame.id), editingGameConfig, token);
      const gamesResponse = await getJson(API.adminGames, token);
      setGames(gamesResponse.games ?? []);

      if (editingGame.id === gameId) {
        setConfig(response.config);
        onPublicConfigChange(response.publicConfig);
      }

      onPublicGamesRefresh();
      setEditingGame(null);
      setEditingGameConfig(null);
      setMessage("פרטי המשחק נשמרו.");
    } catch {
      setMessage("לא הצלחנו לשמור את פרטי המשחק.");
    }
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setConfig(null);
    setAnalytics(null);
    setGlobalSettings({ showEmailLogin: true });
    setAdminUsers([]);
    setGames([]);
    setStatus("idle");
    setMessage("");
  }

  async function createAdmin(event) {
    event.preventDefault();
    setTemporaryAdminPassword("");

    try {
      const response = await postJson(
        API.adminUsers,
        {
          name: newAdminName,
          email: newAdminEmail,
        },
        token,
      );
      setTemporaryAdminPassword(response.temporaryPassword);
      setNewAdminName("");
      setNewAdminEmail("");
      const usersResponse = await getJson(API.adminUsers, token);
      setAdminUsers(usersResponse.users ?? []);
    } catch {
      setTemporaryAdminPassword("לא הצלחנו ליצור אדמין. אולי האימייל כבר קיים.");
    }
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
          <label htmlFor="admin-identifier">שם משתמש או אימייל</label>
          <input
            id="admin-identifier"
            className="admin-input"
            autoComplete="username"
            value={adminIdentifier}
            onChange={(event) => setAdminIdentifier(event.target.value)}
            placeholder="admin"
            dir="ltr"
          />
          <label htmlFor="admin-password">סיסמת אדמין</label>
          <input
            id="admin-password"
            className="admin-input"
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
            <h1>פאנל ניהול</h1>
          </div>
        </div>
        <button className="ghost-button" type="button" onClick={logout}>
          <LogOut aria-hidden="true" />
          יציאה
        </button>
      </div>

      <div className="admin-tabs" role="tablist" aria-label="אזורי ניהול">
        <button
          className={activeAdminTab === "global" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={activeAdminTab === "global"}
          onClick={() => setActiveAdminTab("global")}
        >
          כללי
        </button>
        <button
          className={activeAdminTab === "games" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={activeAdminTab === "games"}
          onClick={() => setActiveAdminTab("games")}
        >
          משחקים
        </button>
        <button
          className={activeAdminTab === "game" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={activeAdminTab === "game"}
          onClick={() => setActiveAdminTab("game")}
        >
          משחק
        </button>
        <button
          className={activeAdminTab === "users" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={activeAdminTab === "users"}
          onClick={() => setActiveAdminTab("users")}
        >
          משתמשים
        </button>
        <button
          className={activeAdminTab === "analytics" ? "is-active" : ""}
          type="button"
          role="tab"
          aria-selected={activeAdminTab === "analytics"}
          onClick={() => setActiveAdminTab("analytics")}
        >
          נתונים
        </button>
      </div>

      {activeAdminTab === "global" && (
        <AdminGlobalSettingsPanel
          message={message}
          settings={globalSettings}
          status={status}
          onSave={saveGlobalSettings}
          onUpdate={updateGlobalSetting}
        />
      )}

      {activeAdminTab === "games" && (
        <AdminGamesPanel
          currentGameId={gameId}
          games={games}
          message={message}
          newGameId={newGameId}
          newGameTitle={newGameTitle}
          onCreateGame={createNewGame}
          onDeleteGame={deleteExistingGame}
          onEditGame={openGameEditor}
          onGameChange={onGameChange}
          onNewGameIdChange={setNewGameId}
          onNewGameTitleChange={setNewGameTitle}
          onResetGameData={resetGameData}
        />
      )}

      {editingGame && (
        <Modal title="עריכת משחק" onClose={() => setEditingGame(null)}>
          <form className="admin-form" onSubmit={saveGameEdit}>
            {!editingGameConfig ? (
              <p className="admin-message">טוען...</p>
            ) : (
              <>
                <label>
                  שם המשחק
                  <input
                    className="admin-input"
                    value={editingGameConfig.roomConfig.title}
                    onChange={(event) => updateEditingGameRoomConfig("title", event.target.value)}
                  />
                </label>
                <label>
                  סיסמת כניסה למשחק
                  <input
                    className="admin-input"
                    value={editingGameConfig.roomConfig.gamePassword ?? ""}
                    onChange={(event) => updateEditingGameRoomConfig("gamePassword", event.target.value)}
                    placeholder="ריק = המשחק פתוח לכולם"
                    dir="auto"
                  />
                </label>
                <p className="admin-help-text" dir="ltr">
                  {editingGame.id === DEFAULT_GAME_ID ? "/main" : `/g/${editingGame.id}`}
                </p>
                <button className="primary-button" type="submit">
                  <Save aria-hidden="true" />
                  שמירה
                </button>
              </>
            )}
          </form>
        </Modal>
      )}

      {activeAdminTab === "analytics" && analytics && <AdminAnalyticsPanel analytics={analytics} />}

      {activeAdminTab === "users" && (
        <AdminUsersPanel
          adminUsers={adminUsers}
          newAdminEmail={newAdminEmail}
          newAdminName={newAdminName}
          temporaryAdminPassword={temporaryAdminPassword}
          onCreateAdmin={createAdmin}
          onNewAdminEmailChange={setNewAdminEmail}
          onNewAdminNameChange={setNewAdminName}
        />
      )}

      {activeAdminTab === "game" && (
        <AdminGameForm
          config={config}
          message={message}
          status={status}
          onAddChallenge={addChallenge}
          onRemoveChallenge={removeChallenge}
          onAddAnswerField={addChallengeAnswerField}
          onAddChoiceOption={addChoiceOption}
          onRemoveAnswerField={removeChallengeAnswerField}
          onRemoveChoiceOption={removeChoiceOption}
          onSaveConfig={saveConfig}
          onUpdateAnswerField={updateChallengeAnswerField}
          onUpdateChallenge={updateChallenge}
          onUpdateChoiceOption={updateChoiceOption}
          onUpdateRoomConfig={updateRoomConfig}
        />
      )}
    </section>
  );
}

function AdminGamesPanel({
  currentGameId,
  games,
  message,
  newGameId,
  newGameTitle,
  onCreateGame,
  onDeleteGame,
  onEditGame,
  onGameChange,
  onNewGameIdChange,
  onNewGameTitleChange,
  onResetGameData,
}) {
  return (
    <section className="admin-section">
      <legend>משחקים</legend>
      <p className="muted">
        כל משחק מקבל כתובות, שאלות, קודים, שחקנים ודירוג משלו. משחק חדש מועתק מהמשחק הנוכחי כדי להתחיל מהר.
      </p>

      <div className="admin-games-list">
        {games.map((game) => (
          <div className={`admin-game-card ${game.id === currentGameId ? "is-active" : ""}`} key={game.id}>
            <button className="admin-game-main" type="button" onClick={() => onGameChange(game.id)}>
              <strong>{game.title}</strong>
              <span dir="ltr">{game.id === DEFAULT_GAME_ID ? "/main" : `/g/${game.id}`}</span>
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => onEditGame(game)}
              aria-label={`עריכת ${game.title}`}
              title={`עריכת ${game.title}`}
            >
              <Pencil aria-hidden="true" />
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => onResetGameData(game.id)}
              aria-label={`איפוס נתונים של ${game.title}`}
              title={`איפוס נתונים של ${game.title}`}
            >
              <RefreshCcw aria-hidden="true" />
            </button>
            <button
              className="icon-button danger-button"
              type="button"
              onClick={() => onDeleteGame(game.id)}
              aria-label={`מחיקת ${game.title}`}
              title={`מחיקת ${game.title}`}
            >
              <Trash2 aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <form className="nested-section" onSubmit={onCreateGame}>
        <h3>יצירת משחק חדש</h3>
        <div className="admin-inline-fields">
          <label>
            שם המשחק
            <input
              className="admin-input"
              value={newGameTitle}
              onChange={(event) => onNewGameTitleChange(event.target.value)}
              placeholder="לדוגמה: חופשת קיץ"
              required
            />
          </label>
          <label>
            כתובת באנגלית
            <input
              className="admin-input"
              value={newGameId}
              onChange={(event) => onNewGameIdChange(normalizeGameId(event.target.value))}
              placeholder="summer-vacation"
              dir="ltr"
            />
          </label>
        </div>
        <p className="admin-help-text">
          אחרי היצירה אפשר לערוך בטאב משחק את השאלות, הקודים, הניקוד, ההודעות והפתרון הסופי.
        </p>
        <button className="primary-button" type="submit">
          <Plus aria-hidden="true" />
          יצירת משחק
        </button>
      </form>

      {message && <p className="admin-message">{message}</p>}
    </section>
  );
}

function AdminGlobalSettingsPanel({ message, settings, status, onSave, onUpdate }) {
  return (
    <form className="admin-form" onSubmit={onSave}>
      <fieldset className="admin-section">
        <legend>הגדרות כלליות לכל המשחקים</legend>
        <label className="inline-check setting-check">
          <input
            type="checkbox"
            checked={settings.showEmailLogin !== false}
            onChange={(event) => onUpdate("showEmailLogin", event.target.checked)}
          />
          הצגת כניסה עם אימייל וקוד חד-פעמי
        </label>
        <p className="admin-help-text">
          כשהאפשרות כבויה, כל המשחקים יציגו רק כניסה עם שם. כשהיא פעילה, השחקן יוכל לבחור גם כניסה באימייל.
        </p>
      </fieldset>

      <div className="admin-actions">
        <button className="primary-button" type="submit" disabled={status === "saving"}>
          {status === "saving" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Save aria-hidden="true" />}
          {status === "saving" ? "שומר..." : "שמירה"}
        </button>
        {message && <span className="admin-message">{message}</span>}
      </div>
    </form>
  );
}

function AdminGameForm({
  config,
  message,
  status,
  onAddAnswerField,
  onAddChallenge,
  onAddChoiceOption,
  onRemoveAnswerField,
  onRemoveChallenge,
  onRemoveChoiceOption,
  onSaveConfig,
  onUpdateAnswerField,
  onUpdateChallenge,
  onUpdateChoiceOption,
  onUpdateRoomConfig,
}) {
  const [section, setSection] = useState("main");

  return (
    <form className="admin-form" onSubmit={onSaveConfig}>
      <div className="admin-subtabs" role="tablist" aria-label="הגדרות משחק">
        <button className={section === "main" ? "is-active" : ""} type="button" onClick={() => setSection("main")}>
          הגדרות
        </button>
        <button className={section === "levels" ? "is-active" : ""} type="button" onClick={() => setSection("levels")}>
          שלבים
        </button>
      </div>

      {section === "main" && (
      <>
      <fieldset className="admin-section">
        <legend>הגדרות כלליות</legend>
        <label>
          שם המשחק
          <input
            className="admin-input"
            value={config.roomConfig.title}
            onChange={(event) => onUpdateRoomConfig("title", event.target.value)}
          />
        </label>
        <label>
          טקסט פתיחה
          <textarea
            className="admin-textarea"
            value={config.roomConfig.subtitle}
            onChange={(event) => onUpdateRoomConfig("subtitle", event.target.value)}
          />
        </label>
        <label>
          טקסט לפני הקוד הסופי
          <textarea
            className="admin-textarea"
            value={config.roomConfig.finalPrompt}
            onChange={(event) => onUpdateRoomConfig("finalPrompt", event.target.value)}
          />
        </label>
        <div className="admin-inline-fields">
          <label>
            ניקוד ברירת מחדל לכל שאלה
            <input
              className="admin-input"
              type="number"
              min="0"
              step="1"
              value={config.roomConfig.questionPoints}
              onChange={(event) => onUpdateRoomConfig("questionPoints", event.target.value)}
            />
          </label>
          <label>
            הורדה על טעות ברירת מחדל
            <input
              className="admin-input"
              type="number"
              min="0"
              step="1"
              value={config.roomConfig.wrongAnswerPenalty}
              onChange={(event) => onUpdateRoomConfig("wrongAnswerPenalty", event.target.value)}
            />
          </label>
        </div>
        <div className="admin-inline-fields">
          <label>
            בונוס לקוד הסופי
            <input
              className="admin-input"
              type="number"
              min="0"
              step="1"
              value={config.roomConfig.finalBonusPoints}
              onChange={(event) => onUpdateRoomConfig("finalBonusPoints", event.target.value)}
            />
          </label>
          <span className="admin-help-text">אם שאלה לא מגדירה ניקוד משלה, היא תשתמש בערכי ברירת המחדל.</span>
        </div>
        <div className="admin-inline-fields">
          <label>
            הודעת הצלחה ברירת מחדל
            <textarea
              className="admin-textarea compact-textarea"
              value={config.roomConfig.defaultSuccessMessage}
              onChange={(event) => onUpdateRoomConfig("defaultSuccessMessage", event.target.value)}
              placeholder="תופיע אם לשלב אין הודעת הצלחה משלו"
            />
          </label>
          <label>
            הודעת שגיאה ברירת מחדל
            <textarea
              className="admin-textarea compact-textarea"
              value={config.roomConfig.defaultErrorMessage}
              onChange={(event) => onUpdateRoomConfig("defaultErrorMessage", event.target.value)}
              placeholder="תופיע אם לשלב אין הודעת שגיאה משלו"
            />
          </label>
        </div>
        <label>
          פתרון סופי
          <input
            className="admin-input"
            value={config.roomConfig.finalCode}
            onChange={(event) => onUpdateRoomConfig("finalCode", event.target.value)}
            dir="auto"
          />
        </label>
        <label>
          הודעת שגיאה בקוד הסופי
          <textarea
            className="admin-textarea compact-textarea"
            value={config.roomConfig.finalErrorMessage}
            onChange={(event) => onUpdateRoomConfig("finalErrorMessage", event.target.value)}
          />
        </label>
      </fieldset>

      <fieldset className="admin-section">
        <legend>מסך סיום</legend>
        <label>
          כותרת קטנה
          <input
            className="admin-input"
            value={config.roomConfig.finalSuccessEyebrow}
            onChange={(event) => onUpdateRoomConfig("finalSuccessEyebrow", event.target.value)}
          />
        </label>
        <label>
          כותרת גדולה
          <input
            className="admin-input"
            value={config.roomConfig.finalSuccessTitle}
            onChange={(event) => onUpdateRoomConfig("finalSuccessTitle", event.target.value)}
          />
        </label>
        <label>
          הודעה במסך הסיום
          <textarea
            className="admin-textarea compact-textarea"
            value={config.roomConfig.finalSuccessMessage}
            onChange={(event) => onUpdateRoomConfig("finalSuccessMessage", event.target.value)}
          />
        </label>
        <label>
          טקסט כפתור במסך הסיום
          <input
            className="admin-input"
            value={config.roomConfig.finalSuccessButtonLabel}
            onChange={(event) => onUpdateRoomConfig("finalSuccessButtonLabel", event.target.value)}
          />
        </label>
      </fieldset>
      </>
      )}

      {section === "levels" && (
      <fieldset className="admin-section">
        <legend>שלבים</legend>
        <div className="admin-section-heading">
          <span>אפשר להוסיף או להסיר שלבים. שלב חדש מקבל כתובת חדשה אוטומטית.</span>
          <button className="ghost-button" type="button" onClick={onAddChallenge}>
            <Plus aria-hidden="true" />
            הוספת שלב
          </button>
        </div>
        <div className="admin-challenges">
          {config.challenges.map((challenge, index) => (
            <div className="admin-challenge" key={challenge.id}>
              <div className="admin-challenge-heading">
                <span>
                  <strong>שלב {challenge.id}</strong>
                  <small>{challenge.path}</small>
                </span>
                <button
                  className="icon-button danger-button"
                  type="button"
                  onClick={() => onRemoveChallenge(index)}
                  disabled={config.challenges.length <= 1}
                  aria-label={`מחיקת שלב ${challenge.id}`}
                  title={`מחיקת שלב ${challenge.id}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
              <label>
                כותרת
                <input
                  className="admin-input"
                  value={challenge.title}
                  onChange={(event) => onUpdateChallenge(index, "title", event.target.value)}
                />
              </label>
              <label>
                שאלה באתר
                <textarea
                  className="admin-textarea"
                  value={challenge.question}
                  onChange={(event) => onUpdateChallenge(index, "question", event.target.value)}
                  placeholder="אפשר להשאיר ריק אם השאלה מודפסת ליד ה-QR"
                />
              </label>
              <div className="admin-inline-fields">
                <label>
                  סוג תשובה
                  <select
                    className="admin-input"
                    value={challenge.answerType ?? "open"}
                    onChange={(event) => onUpdateChallenge(index, "answerType", event.target.value)}
                  >
                    <option value="open">שדות פתוחים</option>
                    <option value="choice">שאלה אמריקאית</option>
                  </select>
                </label>
                <label>
                  סוג הקלדה
                  <select
                    className="admin-input"
                    value={challenge.answerInputMode ?? "auto"}
                    onChange={(event) => onUpdateChallenge(index, "answerInputMode", event.target.value)}
                    disabled={(challenge.answerType ?? "open") === "choice"}
                  >
                    <option value="auto">אוטומטי לפי התשובה</option>
                    <option value="numeric">מספרים בלבד</option>
                    <option value="text">טקסט חופשי</option>
                  </select>
                </label>
              </div>
              <div className="admin-inline-fields">
                <label>
                  הודעת הצלחה לשלב
                  <textarea
                    className="admin-textarea compact-textarea"
                    value={challenge.successMessage}
                    onChange={(event) => onUpdateChallenge(index, "successMessage", event.target.value)}
                    placeholder="ריק = הודעת הצלחה ברירת מחדל"
                  />
                </label>
                <label>
                  הודעת שגיאה לשלב
                  <textarea
                    className="admin-textarea compact-textarea"
                    value={challenge.errorMessage}
                    onChange={(event) => onUpdateChallenge(index, "errorMessage", event.target.value)}
                    placeholder="ריק = הודעת שגיאה ברירת מחדל"
                  />
                </label>
              </div>
              {(challenge.answerType ?? "open") === "choice" ? (
                <div className="nested-section">
                  <div className="admin-section-heading">
                    <strong>תשובות אמריקאיות</strong>
                    <button className="ghost-button" type="button" onClick={() => onAddChoiceOption(index)}>
                      <Plus aria-hidden="true" />
                      הוספת אפשרות
                    </button>
                  </div>
                  {(challenge.choiceOptions ?? []).map((option, optionIndex) => (
                    <div className="admin-option-row" key={option.id ?? optionIndex}>
                      <label>
                        אפשרות
                        <input
                          className="admin-input"
                          value={option.text}
                          onChange={(event) => onUpdateChoiceOption(index, optionIndex, "text", event.target.value)}
                        />
                      </label>
                      <label className="inline-check">
                        <input
                          type="radio"
                          name={`correct-${challenge.id}`}
                          checked={Boolean(option.correct)}
                          onChange={() => onUpdateChoiceOption(index, optionIndex, "correct", true)}
                        />
                        נכונה
                      </label>
                      <button
                        className="icon-button danger-button"
                        type="button"
                        onClick={() => onRemoveChoiceOption(index, optionIndex)}
                        disabled={(challenge.choiceOptions ?? []).length <= 2}
                        aria-label="מחיקת אפשרות"
                        title="מחיקת אפשרות"
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nested-section">
                  <div className="admin-section-heading">
                    <strong>שדות תשובה</strong>
                    <button className="ghost-button" type="button" onClick={() => onAddAnswerField(index)}>
                      <Plus aria-hidden="true" />
                      הוספת שדה
                    </button>
                  </div>
                  {(challenge.answerFields ?? []).length > 0 ? (
                    (challenge.answerFields ?? []).map((field, fieldIndex) => (
                      <div className="admin-option-row" key={field.id ?? fieldIndex}>
                        <label>
                          טקסט לפני השדה
                          <input
                            className="admin-input"
                            value={field.label}
                            onChange={(event) => onUpdateAnswerField(index, fieldIndex, "label", event.target.value)}
                            placeholder='לדוגמה: X='
                          />
                        </label>
                        <label>
                          תשובה נכונה
                          <input
                            className="admin-input"
                            value={field.answer}
                            onChange={(event) => onUpdateAnswerField(index, fieldIndex, "answer", event.target.value)}
                            dir="auto"
                          />
                        </label>
                        <button
                          className="icon-button danger-button"
                          type="button"
                          onClick={() => onRemoveAnswerField(index, fieldIndex)}
                          aria-label="מחיקת שדה"
                          title="מחיקת שדה"
                        >
                          <Trash2 aria-hidden="true" />
                        </button>
                      </div>
                    ))
                  ) : (
                    <label>
                      תשובה
                      <input
                        className="admin-input"
                        value={challenge.answer}
                        onChange={(event) => onUpdateChallenge(index, "answer", event.target.value)}
                        dir="auto"
                      />
                    </label>
                  )}
                </div>
              )}
              <label>
                חלק בקוד הסופי
                <input
                  className="admin-input"
                  value={challenge.reward}
                  onChange={(event) => onUpdateChallenge(index, "reward", event.target.value)}
                  dir="auto"
                />
              </label>
              <div className="admin-inline-fields">
                <label>
                  ניקוד לשלב
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    step="1"
                    value={challenge.points}
                    onChange={(event) => onUpdateChallenge(index, "points", event.target.value)}
                    placeholder={`ברירת מחדל: ${config.roomConfig.questionPoints}`}
                  />
                </label>
                <label>
                  הורדה על כל טעות
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    step="1"
                    value={challenge.wrongAnswerPenalty}
                    onChange={(event) => onUpdateChallenge(index, "wrongAnswerPenalty", event.target.value)}
                    placeholder={`ברירת מחדל: ${config.roomConfig.wrongAnswerPenalty}`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      </fieldset>
      )}

      <div className="admin-actions">
        <button className="primary-button" type="submit" disabled={status === "saving"}>
          {status === "saving" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Save aria-hidden="true" />}
          {status === "saving" ? "שומר..." : "שמירה"}
        </button>
        {message && <span className="admin-message">{message}</span>}
      </div>
    </form>
  );
}

function AdminAnalyticsPanel({ analytics }) {
  return (
    <section className="admin-section analytics-panel">
      <legend>נתוני משחק</legend>
      <div className="analytics-cards">
        <StatCard label="שחקנים" value={analytics.totals.players} />
        <StatCard label="סיימו" value={analytics.totals.completed} />
        <StatCard label="פעילים" value={analytics.totals.active} />
        <StatCard label="ממוצע סיום" value={formatDuration(analytics.totals.averageFinishMs)} />
      </div>

      <div className="analytics-grid">
        <div>
          <h3>דירוג מובילים</h3>
          <div className="leaderboard-list compact-list">
            {analytics.leaderboard.slice(0, 8).map((player, index) => (
              <div className="leaderboard-row" key={player.id}>
                <strong>{index < 3 ? ["🏆", "🥈", "🥉"][index] : index + 1}</strong>
                <span>
                  <b>{player.name}</b>
                  <small>{player.level}</small>
                </span>
                <span>{player.points} נק'</span>
                <span>{formatDuration(player.totalMs)}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>שלבים</h3>
          <div className="analytics-list">
            {analytics.perChallenge.map((challenge) => (
              <div className="analytics-row" key={challenge.id}>
                <strong>{challenge.title}</strong>
                <span>{challenge.solvedCount} פתרו</span>
                <span>{challenge.attempts} ניסיונות</span>
                <span>{formatDuration(challenge.averageSolveMs)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h3>שעות פעילות</h3>
        <div className="usage-bars">
          {analytics.usageByHour.slice(-12).map((entry) => (
            <span key={entry.hour} title={`${entry.hour}: ${entry.count}`}>
              <i style={{ "--height": `${Math.max(8, Math.min(100, entry.count * 14))}%` }} />
              <small>{entry.hour.slice(-5)}</small>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <strong>{value ?? "-"}</strong>
      <span>{label}</span>
    </div>
  );
}

function AdminUsersPanel({
  adminUsers,
  newAdminEmail,
  newAdminName,
  temporaryAdminPassword,
  onCreateAdmin,
  onNewAdminEmailChange,
  onNewAdminNameChange,
}) {
  return (
    <section className="admin-section">
      <legend>אדמינים</legend>
      <p className="muted">רק master יכול ליצור אדמינים. כרגע הסיסמה מוצגת כאן, לא נשלחת במייל.</p>
      <form className="admin-inline-fields" onSubmit={onCreateAdmin}>
        <label>
          שם
          <input
            className="admin-input"
            value={newAdminName}
            onChange={(event) => onNewAdminNameChange(event.target.value)}
          />
        </label>
        <label>
          אימייל אדמין
          <input
            className="admin-input"
            type="email"
            value={newAdminEmail}
            onChange={(event) => onNewAdminEmailChange(event.target.value)}
            dir="ltr"
          />
        </label>
        <button className="ghost-button" type="submit">
          <Plus aria-hidden="true" />
          יצירת אדמין
        </button>
      </form>
      {temporaryAdminPassword && (
        <p className="admin-message">
          סיסמה זמנית: <span dir="ltr">{temporaryAdminPassword}</span>
        </p>
      )}
      {adminUsers.length > 0 && (
        <div className="analytics-list">
          {adminUsers.map((user) => (
            <div className="analytics-row" key={user.id}>
              <strong>{user.name || user.email}</strong>
              <span dir="ltr">{user.email}</span>
              <span>{user.role}</span>
            </div>
          ))}
        </div>
      )}
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

function VacationCelebration({ onNavigate, roomConfig }) {
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
        <p className="eyebrow">{getEditableText(roomConfig.finalSuccessEyebrow, "הבריחה הושלמה")}</p>
        <h1>{getEditableText(roomConfig.finalSuccessTitle, "חופשה נעימה!")}</h1>
        <p>{getEditableText(roomConfig.finalSuccessMessage, "כל הכבוד, פתחתם את הקוד הסופי.")}</p>
        <button className="vacation-button" type="button" onClick={() => onNavigate("/")}>
          <Home aria-hidden="true" />
          {getEditableText(roomConfig.finalSuccessButtonLabel, "חזרה לשלבים")}
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
