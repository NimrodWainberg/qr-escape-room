import {
  BarChart3,
  Check,
  ChevronDown,
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
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { defaultPublicGameConfig } from "./data/challenges.js";

const STORAGE_KEY = "qr-escape-room-solved-v1";
const THEME_KEY = "qr-escape-room-theme-v1";
const ADMIN_TOKEN_KEY = "qr-escape-room-admin-token-v1";
const PLAYER_SESSION_KEY = "qr-escape-room-player-session-v1";
const PLAYER_PROFILE_KEY = "qr-escape-room-player-profile-v1";
const GAME_ACCESS_KEY = "qr-escape-room-game-access-v1";
const DEFAULT_GAME_ID = "main";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
const MAX_IMAGE_DATA_URL_LENGTH = 650_000;
const MAX_CONFIG_PAYLOAD_LENGTH = 4_300_000;
const MAX_IMAGE_DIMENSION = 1400;
const IMAGE_QUALITY_STEPS = [0.82, 0.72, 0.62, 0.52];
const PRESERVE_IMAGE_VALUE = "__qr_escape_room_preserve_image__";
const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

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

const ADMIN_HELP_TEXTS = new Set([
  "אפשר להשאיר ריק אם השאלה מודפסת ליד ה-QR",
  "אפשר לשלב תמונה עם טקסט השאלה. אם אין צורך, השאירו ריק.",
]);

function getPlayerQuestionText(value) {
  const text = String(value ?? "").trim();
  return ADMIN_HELP_TEXTS.has(text) ? "" : text;
}

function isImageDataUrl(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function preserveUnchangedImagesForSave(nextConfig, savedConfig) {
  if (!nextConfig || !savedConfig) {
    return nextConfig;
  }

  const nextPuzzleImageUrl = nextConfig.roomConfig?.puzzleImageUrl ?? "";
  const savedPuzzleImageUrl = savedConfig.roomConfig?.puzzleImageUrl ?? "";

  return {
    ...nextConfig,
    roomConfig: {
      ...nextConfig.roomConfig,
      puzzleImageUrl:
        isImageDataUrl(nextPuzzleImageUrl) && nextPuzzleImageUrl === savedPuzzleImageUrl
          ? PRESERVE_IMAGE_VALUE
          : nextPuzzleImageUrl,
    },
    challenges: (nextConfig.challenges ?? []).map((challenge, index) => {
      const savedChallenge =
        savedConfig.challenges?.find((item) => String(item.id) === String(challenge.id)) ??
        savedConfig.challenges?.[index];
      const nextQuestionImageUrl = challenge.questionImageUrl ?? "";
      const savedQuestionImageUrl = savedChallenge?.questionImageUrl ?? "";

      return {
        ...challenge,
        questionImageUrl:
          isImageDataUrl(nextQuestionImageUrl) && nextQuestionImageUrl === savedQuestionImageUrl
            ? PRESERVE_IMAGE_VALUE
            : nextQuestionImageUrl,
      };
    }),
  };
}

function getAnswerLabel(challenge, roomConfig, fallback = "הכניסו את הקוד") {
  return getEditableText(challenge.answerLabel, getEditableText(roomConfig.defaultAnswerLabel, fallback));
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = source;
  });
}

async function compressImageDataUrl(dataUrl) {
  const image = await loadImageElement(dataUrl);
  const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Canvas is unavailable");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let compressed = "";

  for (const quality of IMAGE_QUALITY_STEPS) {
    compressed = canvas.toDataURL("image/jpeg", quality);

    if (compressed.length <= MAX_IMAGE_DATA_URL_LENGTH) {
      return compressed;
    }
  }

  throw new Error("Image is too large");
}

function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("Invalid image file"));
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        resolve(await compressImageDataUrl(String(reader.result ?? "")));
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
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
  const serializedBody = JSON.stringify(body);

  if (serializedBody.length > MAX_CONFIG_PAYLOAD_LENGTH) {
    const error = new Error("payload_too_large");
    error.status = 413;
    error.data = { error: "payload_too_large" };
    throw error;
  }

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: serializedBody,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(data?.message ?? data?.error ?? `Request failed: ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
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

async function getJson(url, token, options = {}) {
  const response = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : undefined,
    signal: options.signal,
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

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(query).matches : false,
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
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

function getSaveErrorMessage(error) {
  if (error?.status === 413 || error?.data?.error === "payload_too_large") {
    return "השמירה נכשלה כי התמונה גדולה מדי. העלו תמונה קטנה יותר או השתמשו בקישור לתמונה.";
  }

  if (error?.status >= 500) {
    return "השמירה נכשלה בגלל שגיאת שרת. אם העליתם תמונה, נסו תמונה קטנה יותר או קישור לתמונה.";
  }

  return "השמירה נכשלה. נסו שוב.";
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
  const [recentlySolvedId, setRecentlySolvedId] = useState(null);
  const [isEnteringFinalCode, setIsEnteringFinalCode] = useState(false);
  const { roomConfig, challenges } = gameConfig;
  const isAdminRoute = path === "/admin";
  const isGameRoute = !isLobby && !isAdminRoute;
  const finalUnlocked = areAllChallengesSolved(challenges, solved);

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
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 7000);

    async function loadPublicConfig() {
      setConfigStatus("loading");

      try {
        const nextConfig = await getJson(withGame(API.publicConfig, gameId), undefined, {
          signal: controller.signal,
        });

        if (!cancelled) {
          setGameConfig(nextConfig);
          setConfigStatus("ready");
        }
      } catch {
        if (!cancelled) {
          setConfigStatus("fallback");
        }
      }

      window.clearTimeout(timeoutId);
    }

    loadPublicConfig();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [gameId]);

  useEffect(() => {
    if (!isGameRoute) {
      setLeaderboard([]);
      setShowLeaderboardModal(false);
      return undefined;
    }

    loadLeaderboard();

    const intervalId = window.setInterval(loadLeaderboard, 10000);
    return () => window.clearInterval(intervalId);
  }, [gameId, isGameRoute]);

  useEffect(() => {
    loadPublicGames();
  }, []);

  useEffect(() => {
    setSolved(readSolved(gameId));
    setRecentlySolvedId(null);
    setPlayerSession(readPlayerSession(gameId));
    setGameUnlocked(readGameAccess(gameId));
  }, [gameId]);

  useEffect(() => {
    if (!isGameRoute || playerSession || !playerProfile) {
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
  }, [gameId, isGameRoute, playerProfile, playerSession]);

  useEffect(() => {
    if (configStatus === "loading") {
      return;
    }

    if (!isGameRoute && !isLobby) {
      setShowLoginModal(false);
      return;
    }

    if (isGameRoute) {
      setShowLoginModal(!playerSession && !playerProfile);
    }
  }, [configStatus, gameId, isGameRoute, isLobby, playerProfile, playerSession]);

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

  function enterFinalCode() {
    if (!finalUnlocked) {
      navigate("/final");
      return;
    }

    setIsEnteringFinalCode(true);
    window.setTimeout(() => {
      navigate("/final");
      setIsEnteringFinalCode(false);
    }, 780);
  }

  function openFinalShortcut() {
    navigate(finalUnlocked ? "/" : "/final");
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
    setRecentlySolvedId(challengeId);
  }

  function resetProgress() {
    localStorage.removeItem(storageKeyForGame(STORAGE_KEY, gameId));
    setSolved({});
    setRecentlySolvedId(null);
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
    const profile = { name: credentials.name, email: credentials.email ?? "" };

    if (isLobby) {
      localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
      setPlayerProfile(profile);
      setShowLoginModal(false);
      return;
    }

    const session = await postJson(API.playerLogin, { ...credentials, gameId });
    const sessionWithGame = { ...session, gameId };
    localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(profile));
    localStorage.setItem(storageKeyForGame(PLAYER_SESSION_KEY, gameId), JSON.stringify(sessionWithGame));
    setPlayerProfile(profile);
    setPlayerSession(sessionWithGame);
    setShowLoginModal(false);
    await loadLeaderboard();
  }

  async function requestEmailOtp(credentials) {
    if (!supabase) {
      throw new Error("supabase_missing");
    }

    const email = String(credentials.email ?? "").trim().toLowerCase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      throw new Error(error.message || "supabase_otp_failed");
    }

    return { sent: true };
  }

  async function verifyEmailOtp(credentials) {
    if (!supabase) {
      throw new Error("supabase_missing");
    }

    const email = String(credentials.email ?? "").trim().toLowerCase();
    const code = String(credentials.code ?? "").trim();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });

    if (error) {
      throw new Error(error.message || "supabase_otp_invalid");
    }

    await supabase.auth.signOut().catch(() => {});
    await loginPlayer({ name: credentials.name, email });
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
    if (
      !window.confirm(
        getEditableText(
          roomConfig.logoutConfirmMessage,
          "לצאת מהמשחק? ההתקדמות שנשמרה במכשיר תישאר, אבל תצטרכו להיכנס שוב כדי לשמור ניקוד ודירוג.",
        ),
      )
    ) {
      return;
    }

    Object.keys(localStorage)
      .filter((key) => key === PLAYER_SESSION_KEY || key.startsWith(`${PLAYER_SESSION_KEY}:`))
      .forEach((key) => localStorage.removeItem(key));
    localStorage.removeItem(PLAYER_PROFILE_KEY);
    setPlayerProfile(null);
    setPlayerSession(null);
  }

  return (
    <div className="app-shell">
      <AnimatedBackdrop />
      <header className="topbar">
        <button className="brand-button" type="button" onClick={navigateLobby}>
          <QrCode aria-hidden="true" />
          <span>{isLobby ? "כל המשחקים" : roomConfig.title}</span>
        </button>

        <nav className="nav-actions" aria-label="ניווט">
          {((isGameRoute && playerSession?.player?.name) || (isLobby && playerProfile?.name)) && (
            <span className="player-pill">
              <span className="player-pill-name">שלום {playerSession?.player?.name ?? playerProfile.name}</span>
              <button type="button" onClick={logoutPlayer} aria-label="יציאה מהמשחק" title="יציאה מהמשחק">
                <LogOut aria-hidden="true" />
              </button>
            </span>
          )}
          {(isGameRoute || isLobby) && !playerProfile && (
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
          {isGameRoute && (
            <>
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
                onClick={openFinalShortcut}
                aria-label="לקוד הסופי"
                title="לקוד הסופי"
              >
                <Trophy aria-hidden="true" />
              </button>
            </>
          )}
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
        ) : configStatus === "loading" ? (
          <LoadingPage title="טוען משחק" />
        ) : isLobby ? (
          <GamesDirectoryPage
            games={publicGames}
            roomConfig={roomConfig}
            onNavigateToGame={navigateToGame}
          />
        ) : roomConfig.passwordProtected && !gameUnlocked ? (
          <GamePasswordGate roomConfig={roomConfig} onUnlock={unlockGame} onBack={navigateLobby} />
        ) : activeChallenge ? (
          !playerSession ? (
            <HomePage
              challenges={challenges}
              roomConfig={roomConfig}
              configStatus={configStatus}
              playerSession={playerSession}
              recentlySolvedId={recentlySolvedId}
              solved={solved}
              solvedCount={solvedCount}
              onOpenLogin={() => setShowLoginModal(true)}
              onEnterFinalCode={enterFinalCode}
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
              finalUnlocked={finalUnlocked}
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
              recentlySolvedId={recentlySolvedId}
              solved={solved}
              solvedCount={solvedCount}
              onOpenLogin={() => setShowLoginModal(true)}
              onEnterFinalCode={enterFinalCode}
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
            recentlySolvedId={recentlySolvedId}
            solved={solved}
            solvedCount={solvedCount}
            onOpenLogin={() => setShowLoginModal(true)}
            onEnterFinalCode={enterFinalCode}
            onNavigate={navigate}
            onReset={resetProgress}
          />
        )}
      </main>

      {showLoginModal && configStatus !== "loading" && (
        <Modal title="כניסה למשחק" onClose={() => setShowLoginModal(false)}>
          <LoginChoices
            showEmailLogin={roomConfig.showEmailLogin}
            onGuestLogin={loginPlayer}
            onRequestOtp={requestEmailOtp}
            onVerifyOtp={verifyEmailOtp}
          />
        </Modal>
      )}

      {showLeaderboardModal && (
        <Modal title="לוח תוצאות" wide onClose={() => setShowLeaderboardModal(false)}>
          <LeaderboardPanel leaderboard={leaderboard} />
        </Modal>
      )}

      {isEnteringFinalCode && (
        <div className="final-entry-overlay" aria-hidden="true">
          <div className="final-entry-card">
            <Trophy aria-hidden="true" />
            <span>נכנסים לקוד הסופי...</span>
          </div>
        </div>
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
  recentlySolvedId,
  solved,
  solvedCount,
  onOpenLogin,
  onEnterFinalCode,
  onNavigate,
  onReset,
}) {
  const finalUnlocked = areAllChallengesSolved(challenges, solved);
  const usePuzzleMode = roomConfig.puzzleMode === "reveal";

  return (
    <section className={`hero-section ${usePuzzleMode ? "is-puzzle-mode" : ""}`}>
      <div className="hero-copy">
        <p className="eyebrow">המשימה מתחילה כאן</p>
        <h1>{roomConfig.title}</h1>
        {roomConfig.subtitle && <p>{roomConfig.subtitle}</p>}
        {configStatus === "fallback" && (
          <p className="config-note">האתר עובד עכשיו עם הגדרות ברירת מחדל עד שהשרת יהיה זמין.</p>
        )}
      </div>

      {!playerSession && (
        <div className="player-status">
          <strong>עדיין לא נכנסתם למשחק</strong>
          <span>אפשר להתחיל כאורח עם שם בלבד.</span>
          <button className="primary-button" type="button" onClick={onOpenLogin}>
            <UserRound aria-hidden="true" />
            כניסה למשחק
          </button>
        </div>
      )}

      {!usePuzzleMode && (
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
      )}

      {usePuzzleMode && (
        <PuzzleProgress
          challenges={challenges}
          roomConfig={roomConfig}
          recentlySolvedId={recentlySolvedId}
          solved={solved}
          finalUnlocked={finalUnlocked}
          onEnterFinalCode={onEnterFinalCode}
          onNavigate={onNavigate}
          onReset={onReset}
        />
      )}

      {!usePuzzleMode && (
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
      )}

      {!usePuzzleMode && (
        <button
          className={`primary-button wide-button ${finalUnlocked ? "" : "is-soft-locked"}`}
          type="button"
          onClick={finalUnlocked ? onEnterFinalCode : () => onNavigate("/final")}
        >
          {finalUnlocked ? <Trophy aria-hidden="true" /> : <AnimatedLock state="closed" compact />}
          {finalUnlocked ? "מעבר לקוד הסופי" : "הקוד הסופי נעול"}
        </button>
      )}
    </section>
  );
}

function PuzzleProgress({ challenges, roomConfig, recentlySolvedId, solved, finalUnlocked, onEnterFinalCode, onNavigate, onReset }) {
  const solvedCount = challenges.filter((challenge) => isChallengeSolved(challenge, solved)).length;
  const theme = ["vacation", "treasure", "space"].includes(roomConfig.puzzleTheme)
    ? roomConfig.puzzleTheme
    : "vacation";
  const useSquareMobilePuzzle = useMediaQuery("(max-width: 560px)");
  const targetPuzzleSlots = Math.max(6, challenges.length + 1);
  const puzzleLayout = getJigsawLayout(
    challenges.length,
    useSquareMobilePuzzle ? (targetPuzzleSlots <= 6 ? 0.72 : 1.05) : 1.65,
    {
      allowPortrait: useSquareMobilePuzzle && targetPuzzleSlots <= 6,
      minColumns: useSquareMobilePuzzle && targetPuzzleSlots <= 6 ? 2 : 3,
    },
  );
  const puzzleSlots = Array.from({ length: puzzleLayout.slotCount }, (_, index) => challenges[index] ?? null);

  return (
    <section className={`puzzle-progress puzzle-${theme} ${finalUnlocked ? "is-complete" : ""}`} aria-label="פאזל התקדמות">
      <div className="puzzle-stage jigsaw-stage">
        <div className="puzzle-scene" aria-hidden="true">
          <span className="puzzle-sun" />
          <span className="puzzle-cloud puzzle-cloud-a" />
          <span className="puzzle-cloud puzzle-cloud-b" />
          <span className="puzzle-wave puzzle-wave-a" />
          <span className="puzzle-wave puzzle-wave-b" />
          <span className="puzzle-landmark" />
        </div>

        <div
          className={`jigsaw-board ${finalUnlocked ? "is-opened" : ""}`}
          style={{
            "--jigsaw-columns": puzzleLayout.columns,
            "--jigsaw-rows": puzzleLayout.rows,
            "--jigsaw-aspect": `${puzzleLayout.columns} / ${puzzleLayout.rows}`,
            "--jigsaw-ratio": puzzleLayout.columns / puzzleLayout.rows,
          }}
        >
          <JigsawBoardPicture
            puzzleSlots={puzzleSlots}
            challenges={challenges}
            solved={solved}
            theme={theme}
            imageUrl={roomConfig.puzzleImageUrl}
            layout={puzzleLayout}
          />

          {puzzleSlots.map((challenge, index) => {
            const solvedChallenge = challenge ? isChallengeSolved(challenge, solved) : false;
            const unlockedChallenge = challenge ? isChallengeUnlocked(challenges, challenge, solved) : false;
            const state = !challenge ? "is-mystery" : solvedChallenge ? "is-filled" : unlockedChallenge ? "is-available" : "is-empty";
            const recentlySolved = challenge?.id === recentlySolvedId;
            const visualIndex = getRtlJigsawIndex(index, puzzleLayout);
            const col = visualIndex % puzzleLayout.columns;
            const row = Math.floor(visualIndex / puzzleLayout.columns);

            return (
              <button
                className={`jigsaw-slot ${state} ${recentlySolved ? "is-recently-solved" : ""}`}
                key={challenge?.id ?? `mystery-${index}`}
                type="button"
                style={{
                  "--piece-index": visualIndex,
                  "--piece-col": col,
                  "--piece-row": row,
                  "--piece-x": puzzleLayout.columns > 1 ? `${(col / (puzzleLayout.columns - 1)) * 100}%` : "50%",
                  "--piece-y": puzzleLayout.rows > 1 ? `${(row / (puzzleLayout.rows - 1)) * 100}%` : "50%",
                  gridColumn: col + 1,
                  gridRow: row + 1,
                }}
                disabled={!challenge || !unlockedChallenge}
                onClick={() => challenge && onNavigate(challenge.path)}
                aria-label={
                  challenge
                    ? `${challenge.title}: ${solvedChallenge ? "נפתר" : unlockedChallenge ? "פתוח" : "נעול"}`
                    : "חלק מסתורי בפאזל"
                }
              >
                {challenge && <span className="jigsaw-piece-number">{challenge.id}</span>}
                {solvedChallenge ? null : !challenge ? (
                  <span className="jigsaw-piece-mystery">?</span>
                ) : (
                  <span className="jigsaw-piece-lock">
                    <AnimatedLock state={unlockedChallenge ? "open" : "closed"} compact />
                  </span>
                )}
              </button>
            );
          })}

          {finalUnlocked && (
            <>
              <div className="jigsaw-door is-right" aria-hidden="true">
                <div className="jigsaw-door-picture">
                  <JigsawBoardPicture
                    puzzleSlots={puzzleSlots}
                    challenges={challenges}
                    solved={solved}
                    theme={theme}
                    imageUrl={roomConfig.puzzleImageUrl}
                    layout={puzzleLayout}
                  />
                </div>
              </div>
              <div className="jigsaw-door is-left" aria-hidden="true">
                <div className="jigsaw-door-picture">
                  <JigsawBoardPicture
                    puzzleSlots={puzzleSlots}
                    challenges={challenges}
                    solved={solved}
                    theme={theme}
                    imageUrl={roomConfig.puzzleImageUrl}
                    layout={puzzleLayout}
                  />
                </div>
              </div>
              <div className="puzzle-unlocked-panel">
                <Trophy aria-hidden="true" />
                <strong>הפאזל הושלם</strong>
                <button className="primary-button puzzle-final-button" type="button" onClick={onEnterFinalCode}>
                  <Sparkles aria-hidden="true" />
                  {getEditableText(roomConfig.finalEntryButtonLabel, "הזנת הקוד הסופי")}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="puzzle-meter" aria-hidden="true">
          <span style={{ inlineSize: `${challenges.length ? (solvedCount / challenges.length) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="puzzle-copy">
        <p className="eyebrow">פאזל התקדמות</p>
        <h2>{getEditableText(roomConfig.puzzleTitle, "מפת הבריחה")}</h2>
        <p>{getEditableText(roomConfig.puzzleSubtitle, "כל קוד נכון חושף חלק נוסף בתמונה.")}</p>
      </div>

      <div className="puzzle-footer">
        <div>
          <strong>
            {solvedCount}/{challenges.length}
          </strong>
          <span>{finalUnlocked ? "התמונה נפתחה במלואה" : "חלקים נחשפו"}</span>
        </div>
        <button className="ghost-button" type="button" onClick={onReset}>
          <RefreshCcw aria-hidden="true" />
          איפוס
        </button>
      </div>
    </section>
  );
}

const JIGSAW_CELL_SIZE = 100;
const JIGSAW_TAB_DEPTH = 32;

function getJigsawLayout(questionCount, preferredRatio = 1.65, options = {}) {
  const targetSlots = Math.max(6, Number(questionCount) + 1);
  const minColumns = options.minColumns ?? Math.max(3, Math.ceil(Math.sqrt(targetSlots)));
  const maxColumns = Math.max(minColumns, Math.min(targetSlots, 6));
  let bestLayout = null;

  for (let columns = minColumns; columns <= maxColumns; columns += 1) {
    const rows = Math.max(2, Math.ceil(targetSlots / columns));
    const slotCount = columns * rows;
    const ratio = columns / rows;
    const emptySlots = slotCount - targetSlots;
    const portraitPenalty = !options.allowPortrait && rows > columns ? 0.9 : 0;
    const score = Math.abs(ratio - preferredRatio) + emptySlots * 0.18 + portraitPenalty;

    if (!bestLayout || score < bestLayout.score) {
      bestLayout = { columns, rows, slotCount, score };
    }
  }

  const columns = bestLayout.columns;
  const rows = bestLayout.rows;

  return {
    columns,
    rows,
    slotCount: bestLayout.slotCount,
    width: columns * JIGSAW_CELL_SIZE,
    height: rows * JIGSAW_CELL_SIZE,
  };
}

function getRtlJigsawIndex(index, layout) {
  const row = Math.floor(index / layout.columns);
  const col = index % layout.columns;
  return row * layout.columns + (layout.columns - 1 - col);
}

function getSharedVerticalEdge(row, col) {
  return (row + col) % 2 === 0 ? 1 : -1;
}

function getSharedHorizontalEdge(row, col) {
  return (row + col) % 2 === 0 ? -1 : 1;
}

function getJigsawEdges(index, layout) {
  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);

  return {
    top: row === 0 ? 0 : -getSharedHorizontalEdge(row - 1, col),
    right: col === layout.columns - 1 ? 0 : getSharedVerticalEdge(row, col),
    bottom: row === layout.rows - 1 ? 0 : getSharedHorizontalEdge(row, col),
    left: col === 0 ? 0 : -getSharedVerticalEdge(row, col - 1),
  };
}

function horizontalJigsawEdge(y, fromX, toX, outwardDirection) {
  if (!outwardDirection) {
    return `L${toX} ${y}`;
  }

  const length = toX - fromX;
  const edgeDirection = Math.sign(length);
  const first = fromX + length * 0.32;
  const neckStart = fromX + length * 0.41;
  const neckEnd = fromX + length * 0.59;
  const second = fromX + length * 0.68;
  const depth = JIGSAW_TAB_DEPTH * outwardDirection;

  return [
    `L${first} ${y}`,
    `C${first + edgeDirection * 4} ${y} ${neckStart - edgeDirection * 5} ${y + depth * 0.16} ${neckStart} ${y + depth * 0.43}`,
    `C${neckStart + edgeDirection * 3} ${y + depth * 0.95} ${neckEnd - edgeDirection * 3} ${y + depth * 0.95} ${neckEnd} ${y + depth * 0.43}`,
    `C${neckEnd + edgeDirection * 5} ${y + depth * 0.16} ${second - edgeDirection * 4} ${y} ${second} ${y}`,
    `L${toX} ${y}`,
  ].join(" ");
}

function verticalJigsawEdge(x, fromY, toY, direction) {
  if (!direction) {
    return `L${x} ${toY}`;
  }

  const length = toY - fromY;
  const edgeDirection = Math.sign(length);
  const outward = direction;
  const first = fromY + length * 0.32;
  const neckStart = fromY + length * 0.41;
  const neckEnd = fromY + length * 0.59;
  const second = fromY + length * 0.68;
  const depth = JIGSAW_TAB_DEPTH * outward;

  return [
    `L${x} ${first}`,
    `C${x + depth * 0.16} ${first + edgeDirection * 4} ${x + depth * 0.43} ${neckStart - edgeDirection * 5} ${x + depth * 0.43} ${neckStart}`,
    `C${x + depth * 0.95} ${neckStart + edgeDirection * 3} ${x + depth * 0.95} ${neckEnd - edgeDirection * 3} ${x + depth * 0.43} ${neckEnd}`,
    `C${x + depth * 0.16} ${neckEnd + edgeDirection * 5} ${x} ${second - edgeDirection * 4} ${x} ${second}`,
    `L${x} ${toY}`,
  ].join(" ");
}

function createJigsawPath(index, layout) {
  const edges = getJigsawEdges(index, layout);
  const col = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  const x = col * JIGSAW_CELL_SIZE;
  const y = row * JIGSAW_CELL_SIZE;
  const nextX = x + JIGSAW_CELL_SIZE;
  const nextY = y + JIGSAW_CELL_SIZE;

  return [
    `M${x} ${y}`,
    horizontalJigsawEdge(y, x, nextX, -edges.top),
    verticalJigsawEdge(nextX, y, nextY, edges.right),
    horizontalJigsawEdge(nextY, nextX, x, edges.bottom),
    verticalJigsawEdge(x, nextY, y, -edges.left),
    "Z",
  ].join(" ");
}

function createJigsawSeamPath(layout) {
  const paths = [];

  for (let row = 0; row < layout.rows; row += 1) {
    for (let col = 0; col < layout.columns - 1; col += 1) {
      const x = (col + 1) * JIGSAW_CELL_SIZE;
      const y = row * JIGSAW_CELL_SIZE;
      paths.push(`M${x} ${y} ${verticalJigsawEdge(x, y, y + JIGSAW_CELL_SIZE, getSharedVerticalEdge(row, col))}`);
    }
  }

  for (let row = 0; row < layout.rows - 1; row += 1) {
    for (let col = 0; col < layout.columns; col += 1) {
      const x = col * JIGSAW_CELL_SIZE;
      const y = (row + 1) * JIGSAW_CELL_SIZE;
      paths.push(`M${x} ${y} ${horizontalJigsawEdge(y, x, x + JIGSAW_CELL_SIZE, getSharedHorizontalEdge(row, col))}`);
    }
  }

  return paths.join(" ");
}

function PuzzlePictureArt({ theme, imageUrl, shadeId }) {
  if (imageUrl) {
    return (
      <g className="jigsaw-full-picture">
        <image href={imageUrl} x="0" y="0" width="300" height="200" preserveAspectRatio="xMidYMid slice" />
        <path d="M0 0H300V200H0Z" fill={`url(#${shadeId})`} />
      </g>
    );
  }

  if (theme === "space") {
    return (
      <g className="jigsaw-full-picture">
        <rect width="300" height="200" fill="#19254a" />
        <circle cx="238" cy="42" r="30" fill="#ffe38a" />
        <circle cx="96" cy="76" r="44" fill="#7a63ff" opacity="0.72" />
        <circle cx="104" cy="68" r="18" fill="#bdadff" opacity="0.72" />
        <path d="M0 142C52 122 94 130 139 151C190 175 238 143 300 124V200H0Z" fill="#178f9a" />
        <path d="M0 162C61 143 104 151 154 174C204 196 251 169 300 154V200H0Z" fill="#5c4ec7" opacity="0.84" />
        <path d="M46 42L69 54L48 66L25 54Z" fill="#ff8b4f" />
        <path d="M69 54L81 86L58 74L48 66Z" fill="#f25f5c" />
        <path d="M25 54L14 86L37 74L48 66Z" fill="#ffd166" />
        <path d="M176 68C202 55 230 56 260 70" stroke="#8edff5" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.72" />
        <path d="M0 0H300V200H0Z" fill={`url(#${shadeId})`} />
      </g>
    );
  }

  if (theme === "treasure") {
    return (
      <g className="jigsaw-full-picture">
        <rect width="300" height="200" fill="#d9ad63" />
        <path d="M0 0H300V200H0Z" fill="#f3d995" opacity="0.74" />
        <path d="M20 32C74 53 112 47 158 26C209 2 251 15 300 45V92C244 70 206 72 162 95C112 121 65 107 20 86Z" fill="#bd7d3c" opacity="0.42" />
        <path d="M0 136C54 116 97 125 140 143C196 168 235 139 300 119V200H0Z" fill="#4aa17c" opacity="0.74" />
        <path d="M74 58C107 56 133 70 151 101C171 134 199 147 236 142" stroke="#6f4b37" strokeWidth="8" strokeLinecap="round" strokeDasharray="1 18" fill="none" />
        <path d="M214 84L238 68L261 84L254 119H221Z" fill="#8a562f" />
        <path d="M207 86L238 54L269 86Z" fill="#f25f5c" />
        <path d="M48 126L70 101L93 126L84 154H57Z" fill="#ffd166" />
        <path d="M61 126H80V154H61Z" fill="#6f4b37" opacity="0.72" />
        <path d="M0 0H300V200H0Z" fill={`url(#${shadeId})`} />
      </g>
    );
  }

  return (
    <g className="jigsaw-full-picture">
      <rect width="300" height="200" fill="#55c7f3" />
      <path d="M0 0H300V118C246 104 216 124 174 112C124 98 94 80 42 105C22 115 10 118 0 119Z" fill="#8edff5" />
      <path d="M180 0H300V92C265 75 234 77 204 91C191 70 184 39 180 0Z" fill="#ffd166" opacity="0.88" />
      <path d="M0 20C45 2 92 12 129 38C160 60 195 62 230 43C257 28 279 26 300 34V75C257 62 230 68 197 88C152 115 112 86 76 61C45 39 19 37 0 46Z" fill="#ff8b4f" opacity="0.62" />
      <circle cx="246" cy="41" r="28" fill="#ffd166" />
      <circle cx="226" cy="58" r="48" fill="#ffd166" opacity="0.4" />
      <path d="M0 80C54 58 93 73 136 96C188 124 225 95 300 78V147C241 160 198 181 144 154C93 129 46 121 0 144Z" fill="#f7c970" opacity="0.72" />
      <path d="M0 96C63 81 101 98 144 119C200 147 241 116 300 102V154C247 173 200 195 137 164C83 138 42 130 0 151Z" fill="#38b88f" opacity="0.8" />
      <path d="M22 34C44 23 66 24 84 38M184 36C204 24 226 24 247 38" stroke="#fff7d0" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.72" />
      <path d="M0 126C37 106 68 116 98 133C139 156 169 133 205 124C241 115 270 133 300 118V200H0Z" fill="#f5d484" />
      <path d="M0 151C53 128 98 142 142 159C201 181 247 150 300 137V200H0Z" fill="#2db6a3" />
      <path d="M0 169C58 151 100 160 152 177C201 193 244 172 300 157V200H0Z" fill="#177f88" opacity="0.92" />
      <path d="M140 80C132 98 126 121 115 143" stroke="#81522f" strokeWidth="8" strokeLinecap="round" fill="none" />
      <path d="M142 77C116 80 96 93 83 113C110 109 134 100 142 77Z" fill="#24956f" />
      <path d="M145 74C166 76 188 86 205 105C179 106 155 96 145 74Z" fill="#2ba778" />
      <path d="M143 75C132 55 113 43 87 37C102 61 122 75 143 75Z" fill="#35b982" />
      <path d="M145 76C157 56 176 43 203 39C189 62 167 76 145 76Z" fill="#1f8f68" />
      <path d="M35 66L54 53L74 66L66 90H43Z" fill="#ff8b4f" />
      <path d="M47 66H62V90H47Z" fill="#6f4b37" opacity="0.78" />
      <path d="M32 67L54 43L77 67Z" fill="#f25f5c" />
      <path d="M213 139C229 126 248 126 264 139" stroke="#fff7d0" strokeWidth="7" strokeLinecap="round" fill="none" opacity="0.82" />
      <path d="M0 0H300V200H0Z" fill={`url(#${shadeId})`} />
    </g>
  );
}

function JigsawBoardPicture({ puzzleSlots, challenges, solved, theme, imageUrl, layout }) {
  const shadeId = "jigsaw-board-picture-shade";

  return (
    <svg className="jigsaw-board-picture" viewBox={`0 0 ${layout.width} ${layout.height}`} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={shadeId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.18" />
          <stop offset="0.42" stopColor="#2a234f" stopOpacity="0.08" />
          <stop offset="1" stopColor="#f4a640" stopOpacity="0.24" />
        </linearGradient>
      </defs>

      <g transform={`scale(${layout.width / 300} ${layout.height / 200})`}>
        <PuzzlePictureArt theme={theme} imageUrl={imageUrl} shadeId={shadeId} />
      </g>

      {puzzleSlots.map((challenge, index) => {
        const visualIndex = getRtlJigsawIndex(index, layout);
        const solvedChallenge = challenge ? isChallengeSolved(challenge, solved) : false;
        const unlockedChallenge = challenge ? isChallengeUnlocked(challenges, challenge, solved) : false;
        const state = !challenge ? "is-mystery" : solvedChallenge ? "is-filled" : unlockedChallenge ? "is-available" : "is-empty";

        return (
          <path
            className={`jigsaw-piece-fill-layer ${state}`}
            d={createJigsawPath(visualIndex, layout)}
            fill={state === "is-filled" || state === "is-mystery" ? "transparent" : "#77818a"}
            key={challenge?.id ?? `mystery-picture-${index}`}
          />
        );
      })}

      <path className="jigsaw-board-seams" d={createJigsawSeamPath(layout)} fill="none" />
      <path className="jigsaw-board-outline" d={`M0 0H${layout.width}V${layout.height}H0Z`} fill="none" />
    </svg>
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
          {showEmailLogin && (
            <button className="ghost-button guest-switch-button" type="button" onClick={() => setMode("email")}>
              <Sparkles aria-hidden="true" />
              חזרה לכניסה באימייל
            </button>
          )}
        </>
      )}
    </div>
  );
}

function LoadingPage({ title = "טוען" }) {
  return (
    <section className="hero-section loading-section" aria-live="polite">
      <LoaderCircle aria-hidden="true" className="spin-icon" />
      <h1>{title}</h1>
    </section>
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
      setMessage("שלחנו קוד בן 6 ספרות לאימייל.");
    } catch (error) {
      setStatus("idle");

      if (error.message === "supabase_missing") {
        setMessage("צריך להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY ב-Netlify ואז לפרוס מחדש.");
        return;
      }

      if (String(error.message).toLowerCase().includes("email")) {
        setMessage("האימייל לא נראה תקין או ש-Supabase לא הצליח לשלוח אליו קוד.");
        return;
      }

      setMessage("לא הצלחנו לשלוח קוד דרך Supabase כרגע.");
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

      if (error.message === "supabase_missing") {
        setMessage("צריך להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY ב-Netlify ואז לפרוס מחדש.");
        setStep("email");
        return;
      }

      setMessage("הקוד לא נכון או שפג תוקף. בדקו את האימייל ונסו שוב.");
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

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
  const [autoAdvanceArmed, setAutoAdvanceArmed] = useState(false);
  const answerFields = challenge.answerFields?.length ? challenge.answerFields.slice(0, 6) : [];
  const isChoiceQuestion = challenge.answerType === "choice";
  const numericOnly = Boolean(challenge.numericOnly);
  const answerLabel = getAnswerLabel(challenge, roomConfig);
  const questionText = getPlayerQuestionText(challenge.question);
  const autoAdvanceDelaySeconds = Math.min(30, Math.max(0.5, Number(roomConfig.autoAdvanceDelaySeconds) || 2));
  const autoAdvanceEnabled = Boolean(roomConfig.autoAdvanceEnabled);

  useEffect(() => {
    setValue("");
    setAnswerValues([]);
    setChoiceId("");
    setResult(solved ? "success" : "idle");
    setAutoAdvanceArmed(false);
  }, [challenge.id]);

  useEffect(() => {
    if (!autoAdvanceEnabled || !autoAdvanceArmed || result !== "success") {
      return undefined;
    }

    const nextChallenge = getNextChallenge(challenges, challenge);
    const targetPath = nextChallenge ? nextChallenge.path : "/";
    const timeoutId = window.setTimeout(() => {
      onNavigate(targetPath);
    }, autoAdvanceDelaySeconds * 1000);

    return () => window.clearTimeout(timeoutId);
  }, [autoAdvanceArmed, autoAdvanceDelaySeconds, autoAdvanceEnabled, challenge, challenges, onNavigate, result]);

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
        setAutoAdvanceArmed(true);
        onSolve(challenge.id);
        return;
      }

      setResult("error");
    } catch {
      setResult("error");
    }
  }

  return (
    <section className={`play-panel has-top-action ${result === "error" ? "shake" : ""}`}>
      {result === "success" && <Confetti />}

      <button className="panel-top-button" type="button" onClick={() => onNavigate("/")} aria-label="חזרה לבית">
        <Home aria-hidden="true" />
      </button>

      <div className="panel-header">
        <span className="round-badge">{challenge.id}</span>
        <div>
          <p className="eyebrow">שלב {challenge.id}</p>
          <h1>{challenge.title}</h1>
        </div>
      </div>

      <div className="question-box">
        {challenge.questionImageUrl && (
          <figure className="question-image">
            <img src={challenge.questionImageUrl} alt="" />
          </figure>
        )}
        {questionText && <p>{questionText}</p>}
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
                {field.label || answerLabel}
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
            <label htmlFor={`answer-${challenge.id}`}>{answerLabel}</label>
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
      {result === "success" && (
        <UnlockNotice
          autoAdvanceDelaySeconds={autoAdvanceDelaySeconds}
          autoAdvanceEnabled={autoAdvanceEnabled && autoAdvanceArmed}
          challenge={challenge}
          challenges={challenges}
          onNavigate={onNavigate}
        />
      )}

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

function UnlockNotice({ autoAdvanceDelaySeconds = 2, autoAdvanceEnabled = false, challenge, challenges, onNavigate }) {
  const nextChallenge = getNextChallenge(challenges, challenge);
  const title = nextChallenge ? `${nextChallenge.title} נפתח!` : "הקוד הסופי נפתח!";
  const actionLabel = nextChallenge ? `מעבר אל ${nextChallenge.title}` : "לפתיחת הפאזל";
  const actionPath = nextChallenge ? nextChallenge.path : "/";
  const autoText = nextChallenge
    ? `מעבר אוטומטי בעוד ${autoAdvanceDelaySeconds} שניות.`
    : `חזרה אוטומטית לפאזל בעוד ${autoAdvanceDelaySeconds} שניות.`;

  return (
    <div className="unlock-notice" role="status">
      <AnimatedLock state="opening" />
      <span className="result-copy">
        <strong className="result-title">{title}</strong>
        <small>{autoAdvanceEnabled ? autoText : "המנעול נפתח ואפשר להתקדם לשלב הבא."}</small>
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

function shuffleFinalParts(parts) {
  if (parts.length <= 2) {
    return [...parts].reverse();
  }

  const shuffled = [...parts];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = (index * 7 + 3) % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  if (shuffled.every((part, index) => part.id === parts[index]?.id)) {
    return [...parts].reverse();
  }

  return shuffled;
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
  const collectedFinalCode = useMemo(
    () => challenges.map((challenge) => (solved[challenge.id] ? challenge.reward : "")).join(""),
    [challenges, solved],
  );
  const finalCodeValue = useMemo(
    () => normalizeFinalCodePart(roomConfig.finalCode) || normalizeFinalCodePart(collectedFinalCode),
    [collectedFinalCode, roomConfig.finalCode],
  );
  const finalParts = useMemo(
    () => challenges.filter((challenge) => solved[challenge.id] && challenge.reward).map((challenge) => ({
      id: challenge.id,
      text: challenge.reward,
    })),
    [challenges, solved],
  );
  const shuffledFinalParts = useMemo(() => shuffleFinalParts(finalParts), [finalParts]);
  const usesOrderMode = roomConfig.finalInteractionMode === "order" && finalParts.length > 1;
  const [value, setValue] = useState("");
  const [typingComplete, setTypingComplete] = useState(false);
  const [orderSelection, setOrderSelection] = useState([]);
  const [orderStatus, setOrderStatus] = useState("idle");
  const [result, setResult] = useState("idle");
  const orderComplete = !usesOrderMode || orderStatus === "success";

  useEffect(() => {
    setValue("");
    setTypingComplete(false);
    setResult("idle");

    if (!orderComplete) {
      return undefined;
    }

    if (!finalCodeValue) {
      setTypingComplete(true);
      return undefined;
    }

    let nextIndex = 0;
    let intervalId = null;
    const startDelayId = window.setTimeout(() => {
      intervalId = window.setInterval(() => {
        nextIndex += 1;
        setValue(finalCodeValue.slice(0, nextIndex));

        if (nextIndex >= finalCodeValue.length) {
          window.clearInterval(intervalId);
          setTypingComplete(true);
        }
      }, 105);
    }, 520);

    return () => {
      window.clearTimeout(startDelayId);
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [finalCodeValue, orderComplete]);

  useEffect(() => {
    setOrderSelection([]);
    setOrderStatus("idle");
  }, [usesOrderMode, finalCodeValue]);

  function selectFinalPart(part) {
    if (!usesOrderMode || orderStatus === "success" || orderSelection.some((selectedPart) => selectedPart.id === part.id)) {
      return;
    }

    const nextSelection = [...orderSelection, part];
    setOrderSelection(nextSelection);

    if (nextSelection.length !== finalParts.length) {
      setOrderStatus("idle");
      return;
    }

    const selectedCode = normalizeFinalCodePart(nextSelection.map((selectedPart) => selectedPart.text).join(""));
    const expectedCode = finalCodeValue;

    if (selectedCode === expectedCode) {
      setOrderStatus("success");
      return;
    }

    setOrderStatus("error");
    window.setTimeout(() => {
      setOrderSelection([]);
      setOrderStatus("idle");
    }, 950);
  }

  function undoFinalPart() {
    if (orderStatus === "success") {
      return;
    }

    setOrderSelection((current) => current.slice(0, -1));
    setOrderStatus("idle");
  }

  async function submitFinal(event) {
    event.preventDefault();

    if (!typingComplete || !orderComplete || result === "checking") {
      return;
    }

    setResult("checking");

    try {
      const response = await postJson(API.checkFinal, { code: finalCodeValue, gameId }, playerSession.token);
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
      <div className="final-titlebar">
        <button className="final-back-button" type="button" onClick={() => onNavigate("/")} aria-label="חזרה לשלבים">
          <Home aria-hidden="true" />
        </button>

        <div className="panel-header">
          <span className="round-badge">
            <Trophy aria-hidden="true" />
          </span>
          <div>
            <p className="eyebrow">השלב האחרון</p>
            <h1>הקוד הסופי</h1>
          </div>
        </div>
      </div>

      {usesOrderMode && (
        <div className={`final-order-game ${orderStatus === "error" ? "shake" : ""} ${orderStatus === "success" ? "is-success" : ""}`}>
          <div className="final-order-header">
            <strong>{getEditableText(roomConfig.finalOrderPrompt, "סדרו את החלקים לפי הסדר הנכון.")}</strong>
            <button className="ghost-button" type="button" onClick={undoFinalPart} disabled={!orderSelection.length || orderStatus === "success"}>
              חזרה
            </button>
          </div>
          <div className="final-order-slots" aria-label="הסדר שבחרתם">
            {finalParts.map((part, index) => (
              <span className={orderSelection[index] ? "is-filled" : ""} key={`slot-${part.id}`}>
                {orderSelection[index]?.text ?? index + 1}
              </span>
            ))}
          </div>
          <div className="final-order-parts" aria-label="חלקי הקוד">
            {shuffledFinalParts.map((part) => {
              const selected = orderSelection.some((selectedPart) => selectedPart.id === part.id);

              return (
                <button
                  className={selected ? "is-selected" : ""}
                  key={part.id}
                  type="button"
                  onClick={() => selectFinalPart(part)}
                  disabled={selected || orderStatus === "success"}
                >
                  {part.text}
                </button>
              );
            })}
          </div>
          {orderStatus === "error" && (
            <p className="final-order-error" role="alert">
              {getEditableText(roomConfig.finalOrderErrorMessage, "הסדר עדיין לא נכון. נסו שוב.")}
            </p>
          )}
          {orderStatus === "success" && <p className="final-order-success">מעולה. הקוד נפתח.</p>}
        </div>
      )}

      <div className="final-code-reveal" aria-live="polite">
        <span className="final-code-glow" aria-hidden="true" />
        <Sparkles aria-hidden="true" />
        <strong>{orderComplete ? (typingComplete ? "הקוד הורכב" : "מרכיבים את הקוד") : "הקוד נעול"}</strong>
        <div className="final-typewriter" dir="rtl">
          <span>{value || " "}</span>
          {orderComplete && !typingComplete && <i aria-hidden="true" />}
        </div>
      </div>

      <form className="code-form" onSubmit={submitFinal}>
        <label className="sr-only" htmlFor="final-code">
          הקוד הסופי
        </label>
        <input
          id="final-code"
          className="final-input is-hidden-final-code"
          autoComplete="off"
          value={value}
          readOnly
          placeholder="הקוד נכתב כאן..."
        />
        <button className="primary-button" type="submit" disabled={!typingComplete || !orderComplete || result === "checking"}>
          {result === "checking" ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <Trophy aria-hidden="true" />}
          {result === "checking" ? "פותח..." : typingComplete ? "פתיחה" : "רגע..."}
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
    questionImageUrl: "",
    answerType: "open",
    answerInputMode: "auto",
    answer: "",
    answerFields: [],
    choiceOptions: [
      { id: "option-1", text: "", correct: true },
      { id: "option-2", text: "", correct: false },
    ],
    answerLabel: "",
    reward: "",
    points: "",
    wrongAnswerPenalty: "",
    successMessage: "",
    errorMessage: "",
  };
}

function normalizeFinalCodePart(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function splitTextIntoParts(value, count) {
  const cleanValue = normalizeFinalCodePart(value);

  if (!cleanValue || count <= 0) {
    return [];
  }

  const baseSize = Math.floor(cleanValue.length / count);
  const remainder = cleanValue.length % count;
  const parts = [];
  let offset = 0;

  for (let index = 0; index < count; index += 1) {
    const size = baseSize + (index < remainder ? 1 : 0);
    parts.push(cleanValue.slice(offset, offset + size));
    offset += size;
  }

  return parts;
}

function applyFinalCodeRewards(config) {
  const parts = splitTextIntoParts(config?.roomConfig?.finalCode, config?.challenges?.length ?? 0);

  if (parts.length === 0) {
    return config;
  }

  return {
    ...config,
    challenges: config.challenges.map((challenge, index) => ({
      ...challenge,
      reward: parts[index] ?? "",
    })),
  };
}

function getFinalCodeRewardsMessage(config) {
  const cleanFinalCode = normalizeFinalCodePart(config?.roomConfig?.finalCode);
  const challengeCount = config?.challenges?.length ?? 0;

  if (!cleanFinalCode) {
    return "הכניסו תשובה סופית כדי לחלק אותה אוטומטית לשלבים.";
  }

  if (cleanFinalCode.length < challengeCount) {
    return "חילקנו את הקוד, אבל הוא קצר ממספר השלבים ולכן חלק מהשלבים נשארו ריקים.";
  }

  return "חילקנו את התשובה הסופית לחלקים לפי מספר השלבים.";
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
  const [globalSettings, setGlobalSettings] = useState({
    showEmailLogin: true,
    logoutConfirmMessage: "לצאת מהמשחק? ההתקדמות שנשמרה במכשיר תישאר, אבל תצטרכו להיכנס שוב כדי לשמור ניקוד ודירוג.",
    puzzleImages: [],
  });
  const [analytics, setAnalytics] = useState(null);
  const [activeAdminTab, setActiveAdminTab] = useState("games");
  const [games, setGames] = useState([]);
  const [newGameTitle, setNewGameTitle] = useState("");
  const [newGameId, setNewGameId] = useState("");
  const [editingGame, setEditingGame] = useState(null);
  const [editingGameConfig, setEditingGameConfig] = useState(null);
  const [editingGameSavedConfig, setEditingGameSavedConfig] = useState(null);
  const [wizardGame, setWizardGame] = useState(null);
  const [wizardGameConfig, setWizardGameConfig] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [temporaryAdminPassword, setTemporaryAdminPassword] = useState("");
  const [status, setStatus] = useState(token ? "loading" : "idle");
  const [message, setMessage] = useState("");
  const [finalCodeAutoFillRequest, setFinalCodeAutoFillRequest] = useState(0);
  const [finalRewardsMessage, setFinalRewardsMessage] = useState("");
  const [configAutosaveRequest, setConfigAutosaveRequest] = useState(0);
  const [globalAutosaveRequest, setGlobalAutosaveRequest] = useState(0);
  const latestConfigRef = useRef(config);
  const savedConfigRef = useRef(config);
  const latestGlobalSettingsRef = useRef(globalSettings);

  useEffect(() => {
    latestConfigRef.current = config;
  }, [config]);

  useEffect(() => {
    latestGlobalSettingsRef.current = globalSettings;
  }, [globalSettings]);

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
      setConfigAutosaveRequest(0);
      setGlobalAutosaveRequest(0);
      setConfig(nextConfig);
      latestConfigRef.current = nextConfig;
      savedConfigRef.current = nextConfig;
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
      latestConfigRef.current = null;
      savedConfigRef.current = null;
      setStatus("idle");
      setMessage("החיבור לניהול פג או לא תקין. צריך להתחבר שוב.");
    }
  }

  function queueConfigAutosave() {
    setMessage("שומר אוטומטית בעוד רגע...");
    setConfigAutosaveRequest(Date.now());
  }

  function queueGlobalAutosave() {
    setMessage("שומר אוטומטית בעוד רגע...");
    setGlobalAutosaveRequest(Date.now());
  }

  function updateEditableConfig(updater) {
    setConfig(updater);
    queueConfigAutosave();
  }

  useEffect(() => {
    if (!configAutosaveRequest || !token || !latestConfigRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setMessage("שומר אוטומטית...");

      try {
        const payload = preserveUnchangedImagesForSave(latestConfigRef.current, savedConfigRef.current);
        const response = await putJson(withGame(API.adminConfig, gameId), payload, token);
        const publicConfig =
          response.publicConfig ?? (await getJson(withGame(`${API.publicConfig}?ts=${Date.now()}`, gameId)));
        latestConfigRef.current = response.config;
        savedConfigRef.current = response.config;
        setConfig(response.config);
        onPublicConfigChange(publicConfig);
        onPublicGamesRefresh();
        setMessage("נשמר אוטומטית.");
      } catch (error) {
        setMessage(getSaveErrorMessage(error));
      }
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [configAutosaveRequest, gameId, token]);

  useEffect(() => {
    if (!globalAutosaveRequest || !token || !latestGlobalSettingsRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setMessage("שומר אוטומטית...");

      try {
        const nextSettings = await putJson(API.adminSettings, latestGlobalSettingsRef.current, token);
        const publicConfig = await getJson(withGame(`${API.publicConfig}?ts=${Date.now()}`, gameId));
        latestGlobalSettingsRef.current = nextSettings;
        setGlobalSettings(nextSettings);
        onPublicConfigChange(publicConfig);
        setMessage("נשמר אוטומטית.");
      } catch {
        setMessage("שמירת ההגדרות הכלליות נכשלה.");
      }
    }, 1800);

    return () => window.clearTimeout(timeoutId);
  }, [gameId, globalAutosaveRequest, token]);

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
    updateEditableConfig((current) => ({
      ...current,
      roomConfig: {
        ...current.roomConfig,
        [field]: value,
      },
    }));

    if (field === "finalCode") {
      setFinalRewardsMessage("נחכה 10 שניות בלי שינוי ואז נחלק את הקוד לשלבים.");
      setFinalCodeAutoFillRequest(Date.now());
    }
  }

  useEffect(() => {
    if (!finalCodeAutoFillRequest) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      updateEditableConfig((current) => {
        const nextConfig = applyFinalCodeRewards(current);
        setFinalRewardsMessage(getFinalCodeRewardsMessage(nextConfig));
        return nextConfig;
      });
    }, 10000);

    return () => window.clearTimeout(timeoutId);
  }, [finalCodeAutoFillRequest]);

  function fillRewardsFromFinalCodeNow() {
    updateEditableConfig((current) => {
      const nextConfig = applyFinalCodeRewards(current);
      setFinalRewardsMessage(`בוצע. ${getFinalCodeRewardsMessage(nextConfig)}`);
      return nextConfig;
    });
    setFinalCodeAutoFillRequest(0);
  }

  async function applyWizardConfig(targetGameId, nextConfig) {
    const cleanGameId = normalizeGameId(targetGameId);
    const configToSave = applyFinalCodeRewards(nextConfig);
    const response = await putJson(withGame(API.adminConfig, cleanGameId), configToSave, token);

    if (cleanGameId === gameId) {
      const publicConfig =
        response.publicConfig ?? (await getJson(withGame(`${API.publicConfig}?ts=${Date.now()}`, cleanGameId)));
      setConfig(response.config);
      latestConfigRef.current = response.config;
      savedConfigRef.current = response.config;
      onPublicConfigChange(publicConfig);
    }

    const gamesResponse = await getJson(API.adminGames, token);
    setGames(gamesResponse.games ?? []);
    onPublicGamesRefresh();
    onGameChange(cleanGameId);
    setWizardGame(null);
    setWizardGameConfig(null);
    setFinalRewardsMessage("האשף יצר שלבים וחילק את הקוד הסופי.");
    setActiveAdminTab("game");
    setMessage("המשחק נוצר ונשמר דרך האשף.");
  }

  function updateGlobalSetting(field, value) {
    setGlobalSettings((current) => ({
      ...current,
      [field]: value,
    }));
    queueGlobalAutosave();
  }

  async function saveGlobalSettings(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      setGlobalAutosaveRequest(0);
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
    updateEditableConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) =>
        challengeIndex === index ? { ...challenge, [field]: value } : challenge,
      ),
    }));
  }

  function updateChallengeAnswerField(index, fieldIndex, field, value) {
    updateEditableConfig((current) => ({
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
    updateEditableConfig((current) => ({
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
    updateEditableConfig((current) => ({
      ...current,
      challenges: current.challenges.map((challenge, challengeIndex) =>
        challengeIndex === index
          ? { ...challenge, answerFields: (challenge.answerFields ?? []).filter((_, itemIndex) => itemIndex !== fieldIndex) }
          : challenge,
      ),
    }));
  }

  function updateChoiceOption(index, optionIndex, field, value) {
    updateEditableConfig((current) => ({
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
    updateEditableConfig((current) => ({
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
    updateEditableConfig((current) => ({
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
    updateEditableConfig((current) => ({
      ...current,
      challenges: [...current.challenges, createBlankChallenge(current.challenges)],
    }));
  }

  function removeChallenge(index) {
    updateEditableConfig((current) => {
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
      setConfigAutosaveRequest(0);
      const payload = preserveUnchangedImagesForSave(config, savedConfigRef.current);
      const response = await putJson(withGame(API.adminConfig, gameId), payload, token);
      const publicConfig =
        response.publicConfig ?? (await getJson(withGame(`${API.publicConfig}?ts=${Date.now()}`, gameId)));
      setConfig(response.config);
      latestConfigRef.current = response.config;
      savedConfigRef.current = response.config;
      onPublicConfigChange(publicConfig);
      onPublicGamesRefresh();
      onResetProgress();
      loadAdminConfig(token);
      setStatus("ready");
      setMessage("השינויים נשמרו. ההתקדמות בדפדפן הזה אופסה כדי לבדוק את ההגדרות החדשות מיד.");
    } catch (error) {
      setStatus("ready");
      setMessage(getSaveErrorMessage(error));
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
        },
        token,
      );
      const gamesResponse = await getJson(API.adminGames, token);
      setGames(gamesResponse.games ?? []);
      setNewGameTitle("");
      setNewGameId("");
      setWizardGame(response.game);
      setWizardGameConfig(response.config);
      onGameChange(response.game.id);
      onPublicGamesRefresh();
      setMessage("המשחק החדש נוצר. אפשר לבנות אותו בצ׳אט או לסגור ולהגדיר ידנית.");
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
    setEditingGameSavedConfig(null);

    try {
      const nextConfig = await getJson(withGame(API.adminConfig, game.id), token);
      setEditingGameConfig(nextConfig);
      setEditingGameSavedConfig(nextConfig);
    } catch {
      setMessage("לא הצלחנו לפתוח את עריכת המשחק.");
      setEditingGame(null);
      setEditingGameSavedConfig(null);
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
      const payload = preserveUnchangedImagesForSave(editingGameConfig, editingGameSavedConfig);
      const response = await putJson(withGame(API.adminConfig, editingGame.id), payload, token);
      const gamesResponse = await getJson(API.adminGames, token);
      setGames(gamesResponse.games ?? []);

      if (editingGame.id === gameId) {
        setConfig(response.config);
        latestConfigRef.current = response.config;
        savedConfigRef.current = response.config;
        onPublicConfigChange(response.publicConfig);
      }

      onPublicGamesRefresh();
      setEditingGame(null);
      setEditingGameConfig(null);
      setEditingGameSavedConfig(null);
      setMessage("פרטי המשחק נשמרו.");
    } catch (error) {
      setMessage(getSaveErrorMessage(error));
    }
  }

  function logout() {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken("");
    setConfig(null);
    savedConfigRef.current = null;
    setAnalytics(null);
    setGlobalSettings({
      showEmailLogin: true,
      logoutConfirmMessage: "לצאת מהמשחק? ההתקדמות שנשמרה במכשיר תישאר, אבל תצטרכו להיכנס שוב כדי לשמור ניקוד ודירוג.",
      puzzleImages: [],
    });
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
          onAddPuzzleImage={(image) =>
            updateGlobalSetting("puzzleImages", [...(globalSettings.puzzleImages ?? []), image])
          }
          onRemovePuzzleImage={(imageId) =>
            updateGlobalSetting(
              "puzzleImages",
              (globalSettings.puzzleImages ?? []).filter((image) => image.id !== imageId),
            )
          }
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
        <Modal
          title="עריכת משחק"
          onClose={() => {
            setEditingGame(null);
            setEditingGameConfig(null);
            setEditingGameSavedConfig(null);
          }}
        >
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

      {wizardGame && (
        <Modal
          title="אשף יצירת משחק"
          wide
          onClose={() => {
            setWizardGame(null);
            setWizardGameConfig(null);
          }}
        >
          {!wizardGameConfig ? (
            <p className="admin-message">טוען...</p>
          ) : (
            <div className="admin-form">
              <div className="admin-editor-panel">
                <h3>רוצים לבנות את המשחק בצ׳אט?</h3>
                <p className="admin-help-text">
                  אפשר לענות על כמה שאלות קצרות, והאשף ימלא את שם המשחק, התשובה הסופית, השלבים והתשובות. תמיד אפשר לסגור ולהמשיך לערוך ידנית.
                </p>
              </div>
              <AdminGameWizard
                config={wizardGameConfig}
                onApply={(nextConfig) => applyWizardConfig(wizardGame.id, nextConfig)}
              />
            </div>
          )}
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
          finalRewardsMessage={finalRewardsMessage}
          globalSettings={globalSettings}
          message={message}
          status={status}
          onAddChallenge={addChallenge}
          onRemoveChallenge={removeChallenge}
          onAddAnswerField={addChallengeAnswerField}
          onAddChoiceOption={addChoiceOption}
          onRemoveAnswerField={removeChallengeAnswerField}
          onRemoveChoiceOption={removeChoiceOption}
          onSaveConfig={saveConfig}
          onSplitFinalCodeRewards={fillRewardsFromFinalCodeNow}
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
        כל משחק מקבל כתובות, שאלות, קודים, שחקנים ודירוג משלו. אחרי יצירת משחק אפשר לבנות אותו בצ׳אט או לערוך ידנית.
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
          אחרי היצירה ייפתח אשף קצר בצ׳אט. אפשר לסגור אותו ולהמשיך לערוך בטאב משחק.
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

function AdminGlobalSettingsPanel({ message, settings, status, onAddPuzzleImage, onRemovePuzzleImage, onSave, onUpdate }) {
  const [puzzleImageName, setPuzzleImageName] = useState("");
  const [puzzleImageUrl, setPuzzleImageUrl] = useState("");
  const [puzzleImageStatus, setPuzzleImageStatus] = useState("");

  async function handlePuzzleImageFile(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setPuzzleImageStatus("טוען תמונה...");

    try {
      const dataUrl = await readImageFile(file);
      setPuzzleImageUrl(dataUrl);
      setPuzzleImageStatus("התמונה נטענה. תנו לה שם ולחצו הוספה.");
    } catch {
      setPuzzleImageStatus("התמונה גדולה מדי. נסו תמונה קטנה יותר או הדביקו קישור לתמונה.");
    } finally {
      event.target.value = "";
    }
  }

  function addPuzzleImage(event) {
    event.preventDefault();
    const cleanUrl = puzzleImageUrl.trim();

    if (!cleanUrl) {
      setPuzzleImageStatus("צריך להעלות תמונה או להדביק קישור.");
      return;
    }

    onAddPuzzleImage({
      id: `puzzle-image-${Date.now().toString(36)}`,
      name: puzzleImageName.trim() || `תמונה ${(settings.puzzleImages ?? []).length + 1}`,
      url: cleanUrl,
    });
    setPuzzleImageName("");
    setPuzzleImageUrl("");
    setPuzzleImageStatus("התמונה נוספה לספרייה. השמירה האוטומטית תעדכן את כל המשחקים.");
  }

  return (
    <form className="admin-form" onSubmit={onSave}>
      <fieldset className="admin-section">
        <legend>הגדרות כלליות לכל המשחקים</legend>
        <label className="switch-setting">
          <span>
            <strong>כניסה באימייל וקוד חד-פעמי</strong>
            <small>כשהאפשרות כבויה, השחקן יראה רק כניסה עם שם.</small>
          </span>
          <input
            type="checkbox"
            checked={settings.showEmailLogin !== false}
            onChange={(event) => onUpdate("showEmailLogin", event.target.checked)}
          />
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
        </label>
        <label>
          טקסט אישור יציאה
          <textarea
            className="admin-textarea compact-textarea"
            value={settings.logoutConfirmMessage ?? ""}
            onChange={(event) => onUpdate("logoutConfirmMessage", event.target.value)}
            placeholder="לצאת מהמשחק? ההתקדמות שנשמרה במכשיר תישאר..."
          />
        </label>
        <p className="admin-help-text">
          ההגדרות כאן חלות על כל המשחקים. הגדרות טקסטים, ניקוד ופאזל נשמרות בנפרד לכל משחק.
        </p>
      </fieldset>

      <fieldset className="admin-section">
        <legend>ספריית תמונות פאזל</legend>
        <p className="admin-help-text">
          תמונות שתוסיפו כאן יופיעו כאפשרות בחירה בכל משחק שמפעיל פאזל.
        </p>
        <div className="admin-inline-fields">
          <label>
            שם לתמונה
            <input
              className="admin-input"
              value={puzzleImageName}
              onChange={(event) => setPuzzleImageName(event.target.value)}
              placeholder="לדוגמה: חופשה בים"
            />
          </label>
          <label>
            קישור לתמונה
            <input
              className="admin-input"
              value={puzzleImageUrl.startsWith("data:image/") ? "" : puzzleImageUrl}
              onChange={(event) => setPuzzleImageUrl(event.target.value)}
              placeholder="https://..."
              dir="ltr"
            />
          </label>
        </div>
        <div className="admin-image-actions">
          <label className="ghost-button file-upload-button">
            העלאת תמונה
            <input type="file" accept="image/*" onChange={handlePuzzleImageFile} />
          </label>
          <button className="primary-button" type="button" onClick={addPuzzleImage}>
            <Plus aria-hidden="true" />
            הוספה לספרייה
          </button>
        </div>
        {puzzleImageUrl && (
          <div className="admin-image-preview">
            <img src={puzzleImageUrl} alt="" />
          </div>
        )}
        {puzzleImageStatus && <p className="admin-help-text">{puzzleImageStatus}</p>}

        {(settings.puzzleImages ?? []).length > 0 && (
          <div className="puzzle-image-library">
            {(settings.puzzleImages ?? []).map((image) => (
              <div className="puzzle-image-card" key={image.id}>
                <img src={image.url} alt="" />
                <strong>{image.name}</strong>
                <button
                  className="icon-button danger-button"
                  type="button"
                  onClick={() => onRemovePuzzleImage(image.id)}
                  aria-label={`מחיקת ${image.name}`}
                  title={`מחיקת ${image.name}`}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
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

function AdminCollapsibleSection({ title, meta, defaultOpen = false, children, className = "" }) {
  return (
    <details className={`admin-collapse ${className}`} open={defaultOpen}>
      <summary className="admin-collapse-summary">
        <span>
          <strong>{title}</strong>
          {meta && <small>{meta}</small>}
        </span>
        <ChevronDown aria-hidden="true" />
      </summary>
      <div className="admin-collapse-body">{children}</div>
    </details>
  );
}

function createWizardChallenge(index, level, existingChallenge = null) {
  const id = index + 1;

  return {
    ...(existingChallenge ?? {}),
    id,
    path: `/q/${id}`,
    title: existingChallenge?.title || `קוד ${id}`,
    question: level.question,
    questionImageUrl: existingChallenge?.questionImageUrl ?? "",
    answerType: "open",
    answerInputMode: existingChallenge?.answerInputMode ?? "auto",
    answer: level.answer,
    answerFields: [],
    choiceOptions: existingChallenge?.choiceOptions?.length
      ? existingChallenge.choiceOptions
      : [
          { id: "option-1", text: "", correct: true },
          { id: "option-2", text: "", correct: false },
        ],
    answerLabel: existingChallenge?.answerLabel ?? "",
    reward: existingChallenge?.reward ?? "",
    points: existingChallenge?.points ?? "",
    wrongAnswerPenalty: existingChallenge?.wrongAnswerPenalty ?? "",
    successMessage: existingChallenge?.successMessage ?? "",
    errorMessage: existingChallenge?.errorMessage ?? "",
  };
}

function AdminGameWizard({ config, onApply }) {
  const [step, setStep] = useState("title");
  const [input, setInput] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [draft, setDraft] = useState({
    title: config.roomConfig.title ?? "",
    finalCode: config.roomConfig.finalCode ?? "",
    count: Math.max(1, config.challenges.length || 5),
    levels: [],
    pendingQuestion: "",
  });
  const [messages, setMessages] = useState([
    { role: "assistant", text: "בואו נבנה משחק בצורת שיחה. מה שם המשחק?" },
  ]);

  function addMessages(nextMessages) {
    setMessages((current) => [...current, ...nextMessages]);
  }

  function resetWizard() {
    setStep("title");
    setInput("");
    setIsApplying(false);
    setDraft({
      title: config.roomConfig.title ?? "",
      finalCode: config.roomConfig.finalCode ?? "",
      count: Math.max(1, config.challenges.length || 5),
      levels: [],
      pendingQuestion: "",
    });
    setMessages([{ role: "assistant", text: "בואו נבנה משחק בצורת שיחה. מה שם המשחק?" }]);
  }

  function submitWizardMessage() {
    const value = input.trim();

    if (!value && !["title", "count"].includes(step)) {
      return;
    }

    setInput("");

    if (step === "title") {
      const title = value || config.roomConfig.title || "חדר בריחה";
      setDraft((current) => ({ ...current, title }));
      setStep("finalCode");
      addMessages([
        { role: "user", text: title },
        { role: "assistant", text: "מה התשובה לשלב הסופי?" },
      ]);
      return;
    }

    if (step === "finalCode") {
      setDraft((current) => ({ ...current, finalCode: value }));
      setStep("count");
      addMessages([
        { role: "user", text: value },
        { role: "assistant", text: "כמה שלבים יהיו במשחק? אפשר לכתוב מספר, למשל 5." },
      ]);
      return;
    }

    if (step === "count") {
      const count = Math.min(20, Math.max(1, Number.parseInt(value || config.challenges.length || "5", 10) || 5));
      setDraft((current) => ({ ...current, count, levels: [], pendingQuestion: "" }));
      setStep("question");
      addMessages([
        { role: "user", text: String(count) },
        { role: "assistant", text: "מעולה. כתבו את השאלה לשלב 1." },
      ]);
      return;
    }

    if (step === "question") {
      const nextIndex = draft.levels.length + 1;
      setDraft((current) => ({ ...current, pendingQuestion: value }));
      setStep("answer");
      addMessages([
        { role: "user", text: value },
        { role: "assistant", text: `מה התשובה הנכונה לשלב ${nextIndex}?` },
      ]);
      return;
    }

    if (step === "answer") {
      const nextLevels = [...draft.levels, { question: draft.pendingQuestion, answer: value }];
      const finished = nextLevels.length >= draft.count;
      setDraft((current) => ({ ...current, levels: nextLevels, pendingQuestion: "" }));
      setStep(finished ? "done" : "question");
      addMessages([
        { role: "user", text: value },
        {
          role: "assistant",
          text: finished
            ? "סיימנו. אפשר להחיל את המשחק עכשיו, או להתחיל מחדש."
            : `נשמר. כתבו את השאלה לשלב ${nextLevels.length + 1}.`,
        },
      ]);
    }
  }

  async function applyWizard() {
    const levels = draft.levels.slice(0, draft.count);
    const nextConfig = {
      ...config,
      roomConfig: {
        ...config.roomConfig,
        title: draft.title || config.roomConfig.title,
        finalCode: draft.finalCode,
      },
      challenges: levels.map((level, index) => createWizardChallenge(index, level, config.challenges[index])),
    };

    setIsApplying(true);
    try {
      await onApply(nextConfig);
      addMessages([{ role: "assistant", text: "בוצע. המשחק עודכן ונשמר." }]);
    } catch {
      addMessages([{ role: "assistant", text: "לא הצלחנו לשמור כרגע. אפשר לנסות שוב." }]);
      setIsApplying(false);
    }
  }

  return (
    <section className="admin-wizard-panel">
      <div className="wizard-chat" aria-label="אשף יצירת משחק">
        {messages.map((message, index) => (
          <div className={`wizard-message is-${message.role}`} key={`${message.role}-${index}`}>
            {message.text}
          </div>
        ))}
      </div>

      {step !== "done" ? (
        <div className="wizard-input-row">
          <input
            className="admin-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submitWizardMessage();
              }
            }}
            placeholder="כתבו כאן..."
            dir="auto"
          />
          <button className="primary-button" type="button" onClick={submitWizardMessage}>
            <Sparkles aria-hidden="true" />
            שליחה
          </button>
        </div>
      ) : (
        <div className="admin-actions">
          <button className="primary-button" type="button" onClick={applyWizard} disabled={isApplying}>
            <Save aria-hidden="true" />
            {isApplying ? "שומר..." : "החל על המשחק"}
          </button>
          <button className="ghost-button" type="button" onClick={resetWizard}>
            <RefreshCcw aria-hidden="true" />
            התחלה מחדש
          </button>
        </div>
      )}
    </section>
  );
}

function addSearchResult(results, query, item) {
  const value = String(item.value ?? "");
  const searchable = [item.label, item.scope, item.value].map((part) => String(part ?? "").toLowerCase()).join(" ");

  if (!query || !searchable.includes(query)) {
    return;
  }

  results.push({ ...item, value });
}

function getAdminConfigSearchResults(config, query) {
  if (!query) {
    return [];
  }

  const results = [];
  const roomFields = [
    ["שם המשחק", "title", config.roomConfig.title, "main", "input"],
    ["טקסט פתיחה", "subtitle", config.roomConfig.subtitle, "main", "textarea"],
    ["תשובה לשלב הסופי", "finalCode", config.roomConfig.finalCode, "final", "input"],
    ["טקסט לפני הקוד הסופי", "finalPrompt", config.roomConfig.finalPrompt, "final", "textarea"],
    ["טקסט כפתור כניסה לקוד הסופי", "finalEntryButtonLabel", config.roomConfig.finalEntryButtonLabel, "final", "input"],
    ["הוראה לסידור חלקי הקוד", "finalOrderPrompt", config.roomConfig.finalOrderPrompt, "final", "textarea"],
    ["הודעת טעות בסידור חלקי הקוד", "finalOrderErrorMessage", config.roomConfig.finalOrderErrorMessage, "final", "textarea"],
    ["כותרת מסך סיום", "finalSuccessTitle", config.roomConfig.finalSuccessTitle, "final", "input"],
    ["הודעת מסך סיום", "finalSuccessMessage", config.roomConfig.finalSuccessMessage, "final", "textarea"],
    ["כותרת פאזל", "puzzleTitle", config.roomConfig.puzzleTitle, "main", "input"],
    ["טקסט פאזל", "puzzleSubtitle", config.roomConfig.puzzleSubtitle, "main", "textarea"],
    ["שניות עד מעבר אוטומטי", "autoAdvanceDelaySeconds", config.roomConfig.autoAdvanceDelaySeconds, "advanced", "input"],
    ["תווית תשובה ברירת מחדל", "defaultAnswerLabel", config.roomConfig.defaultAnswerLabel, "advanced", "input"],
    ["הודעת הצלחה ברירת מחדל", "defaultSuccessMessage", config.roomConfig.defaultSuccessMessage, "advanced", "textarea"],
    ["הודעת שגיאה ברירת מחדל", "defaultErrorMessage", config.roomConfig.defaultErrorMessage, "advanced", "textarea"],
  ];

  roomFields.forEach(([label, field, value, section, control]) => {
    addSearchResult(results, query, {
      id: `room-${field}`,
      kind: "room",
      field,
      label,
      section,
      scope: "משחק",
      control,
      value,
    });
  });

  config.challenges.forEach((challenge, challengeIndex) => {
    const level = `שלב ${challenge.id}`;
    const challengeFields = [
      ["כותרת", "title", challenge.title, "input"],
      ["שאלה", "question", challenge.question, "textarea"],
      ["תשובה", "answer", challenge.answer, "input"],
      ["חלק בקוד הסופי", "reward", challenge.reward, "input"],
      ["טקסט לפני שדה התשובה", "answerLabel", challenge.answerLabel, "input"],
      ["הודעת הצלחה", "successMessage", challenge.successMessage, "textarea"],
      ["הודעת שגיאה", "errorMessage", challenge.errorMessage, "textarea"],
    ];

    challengeFields.forEach(([label, field, value, control]) => {
      addSearchResult(results, query, {
        id: `challenge-${challenge.id}-${field}`,
        kind: "challenge",
        challengeIndex,
        field,
        label,
        section: "levels",
        scope: level,
        control,
        value,
      });
    });

    (challenge.answerFields ?? []).forEach((field, fieldIndex) => {
      addSearchResult(results, query, {
        id: `challenge-${challenge.id}-answer-field-${fieldIndex}`,
        kind: "answerField",
        challengeIndex,
        fieldIndex,
        field: "answer",
        label: field.label ? `שדה תשובה: ${field.label}` : `שדה תשובה ${fieldIndex + 1}`,
        section: "levels",
        scope: level,
        control: "input",
        value: field.answer,
      });
    });

    (challenge.choiceOptions ?? []).forEach((option, optionIndex) => {
      addSearchResult(results, query, {
        id: `challenge-${challenge.id}-choice-${optionIndex}`,
        kind: "choice",
        challengeIndex,
        optionIndex,
        field: "text",
        label: option.correct ? `אפשרות נכונה ${optionIndex + 1}` : `אפשרות ${optionIndex + 1}`,
        section: "levels",
        scope: level,
        control: "input",
        value: option.text,
      });
    });

    addSearchResult(results, query, {
      id: `challenge-${challenge.id}-path`,
      kind: "challenge",
      challengeIndex,
      field: "path",
      label: "כתובת",
      section: "levels",
      scope: level,
      control: "input",
      value: challenge.path,
    });
  });

  return results.slice(0, 30);
}

function AdminSearchResultField({
  result,
  onUpdateAnswerField,
  onUpdateChallenge,
  onUpdateChoiceOption,
  onUpdateRoomConfig,
}) {
  function updateValue(value) {
    if (result.kind === "room") {
      onUpdateRoomConfig(result.field, value);
      return;
    }

    if (result.kind === "challenge") {
      onUpdateChallenge(result.challengeIndex, result.field, value);
      return;
    }

    if (result.kind === "answerField") {
      onUpdateAnswerField(result.challengeIndex, result.fieldIndex, result.field, value);
      return;
    }

    if (result.kind === "choice") {
      onUpdateChoiceOption(result.challengeIndex, result.optionIndex, result.field, value);
    }
  }

  const Control = result.control === "textarea" ? "textarea" : "input";

  return (
    <label className="admin-search-edit-card">
      <span>
        <strong>{result.scope}</strong>
        <small>{result.label}</small>
      </span>
      <Control
        className={result.control === "textarea" ? "admin-textarea compact-textarea" : "admin-input"}
        value={result.value}
        onChange={(event) => updateValue(event.target.value)}
        dir="auto"
      />
    </label>
  );
}

function AdminGameForm({
  config,
  finalRewardsMessage,
  globalSettings,
  message,
  status,
  onAddAnswerField,
  onAddChallenge,
  onAddChoiceOption,
  onRemoveAnswerField,
  onRemoveChallenge,
  onRemoveChoiceOption,
  onSaveConfig,
  onSplitFinalCodeRewards,
  onUpdateAnswerField,
  onUpdateChallenge,
  onUpdateChoiceOption,
  onUpdateRoomConfig,
}) {
  const [section, setSection] = useState("main");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const puzzleEnabled = config.roomConfig.puzzleMode === "reveal";
  const normalizedSearchTerm = debouncedSearchTerm.trim().toLowerCase();
  const searchResults = useMemo(
    () => getAdminConfigSearchResults(config, normalizedSearchTerm),
    [config, normalizedSearchTerm],
  );
  const filteredChallenges = normalizedSearchTerm
    ? config.challenges.filter((challenge) =>
        searchResults.some((result) => result.id.startsWith(`challenge-${challenge.id}-`)),
      )
    : config.challenges;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  return (
    <form className="admin-form" onSubmit={onSaveConfig}>
      <div className="admin-search-row">
        <label>
          חיפוש בהגדרות
          <input
            className="admin-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder='חפשו שאלה, תשובה או טקסט, למשל "bla bla"'
            dir="auto"
          />
        </label>
        {searchTerm && (
          <button className="ghost-button" type="button" onClick={() => setSearchTerm("")}>
            <X aria-hidden="true" />
            ניקוי
          </button>
        )}
      </div>

      {normalizedSearchTerm && (
        <section className="admin-search-results" aria-label="תוצאות חיפוש">
          <div className="admin-section-heading">
            <strong>{searchResults.length ? `${searchResults.length} תוצאות` : "לא נמצאו תוצאות"}</strong>
            <span>מוצגים רק השדות שמכילים את הטקסט שחיפשתם.</span>
          </div>
          {searchResults.length > 0 && (
            <div className="admin-search-edit-list">
              {searchResults.map((result) => (
                <AdminSearchResultField
                  key={result.id}
                  result={result}
                  onUpdateAnswerField={onUpdateAnswerField}
                  onUpdateChallenge={onUpdateChallenge}
                  onUpdateChoiceOption={onUpdateChoiceOption}
                  onUpdateRoomConfig={onUpdateRoomConfig}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!normalizedSearchTerm && <div className="admin-subtabs" role="tablist" aria-label="הגדרות משחק">
        <button
          aria-selected={section === "main"}
          className={section === "main" ? "is-active" : ""}
          role="tab"
          type="button"
          onClick={() => setSection("main")}
        >
          עיקרי
        </button>
        <button
          aria-selected={section === "final"}
          className={section === "final" ? "is-active" : ""}
          role="tab"
          type="button"
          onClick={() => setSection("final")}
        >
          סיום
        </button>
        <button
          aria-selected={section === "levels"}
          className={section === "levels" ? "is-active" : ""}
          role="tab"
          type="button"
          onClick={() => setSection("levels")}
        >
          שלבים
        </button>
        <button
          aria-selected={section === "advanced"}
          className={section === "advanced" ? "is-active" : ""}
          role="tab"
          type="button"
          onClick={() => setSection("advanced")}
        >
          מתקדם
        </button>
      </div>}

      {!normalizedSearchTerm && section === "main" && (
        <div className="admin-editor-panel">
          <label>
            שם המשחק
            <input className="admin-input" value={config.roomConfig.title} onChange={(event) => onUpdateRoomConfig("title", event.target.value)} />
          </label>
          <label>
            טקסט פתיחה
            <textarea
              className="admin-textarea compact-textarea"
              value={config.roomConfig.subtitle}
              onChange={(event) => onUpdateRoomConfig("subtitle", event.target.value)}
              placeholder="טקסט קצר שמופיע מתחת לכותרת"
            />
          </label>

          <label className="switch-setting">
            <span>
              <strong>הצגת פאזל במשחק</strong>
              <small>כל שלב שנפתר חושף חלק נוסף בפאזל במסך הבית.</small>
            </span>
            <input
              type="checkbox"
              checked={config.roomConfig.puzzleMode === "reveal"}
              onChange={(event) => onUpdateRoomConfig("puzzleMode", event.target.checked ? "reveal" : "off")}
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
          </label>

          {puzzleEnabled && (
            <div className="nested-section">
              <AdminImageField
                label="תמונת פאזל"
                value={config.roomConfig.puzzleImageUrl ?? ""}
                onChange={(value) => onUpdateRoomConfig("puzzleImageUrl", value)}
                help="אם מעלים תמונה, היא תחליף את ציור ברירת המחדל ותישמר עם המשחק הזה."
              />
              {(globalSettings.puzzleImages ?? []).length > 0 && (
                <label>
                  בחירה מספריית תמונות
                  <select
                    className="admin-input"
                    value={config.roomConfig.puzzleImageUrl ?? ""}
                    onChange={(event) => onUpdateRoomConfig("puzzleImageUrl", event.target.value)}
                  >
                    <option value="">ציור ברירת מחדל</option>
                    {(globalSettings.puzzleImages ?? []).map((image) => (
                      <option key={image.id} value={image.url}>
                        {image.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                סגנון ברירת מחדל
                <select className="admin-input" value={config.roomConfig.puzzleTheme ?? "vacation"} onChange={(event) => onUpdateRoomConfig("puzzleTheme", event.target.value)}>
                  <option value="vacation">חופשה</option>
                  <option value="treasure">אוצר</option>
                  <option value="space">חלל</option>
                </select>
              </label>
              <AdminCollapsibleSection title="אפשרויות פאזל" meta="כותרת וטקסט עזר">
                <label>
                  כותרת הפאזל
                  <input
                    className="admin-input"
                    value={config.roomConfig.puzzleTitle ?? ""}
                    onChange={(event) => onUpdateRoomConfig("puzzleTitle", event.target.value)}
                    placeholder="מפת הבריחה"
                  />
                </label>
                <label>
                  טקסט קצר מתחת לכותרת
                  <textarea
                    className="admin-textarea compact-textarea"
                    value={config.roomConfig.puzzleSubtitle ?? ""}
                    onChange={(event) => onUpdateRoomConfig("puzzleSubtitle", event.target.value)}
                    placeholder="כל קוד נכון חושף חלק נוסף בתמונה."
                  />
                </label>
              </AdminCollapsibleSection>
            </div>
          )}
        </div>
      )}

      {!normalizedSearchTerm && section === "final" && (
        <div className="admin-editor-panel">
          <label>
            תשובה לשלב הסופי
            <span className="final-code-admin-row">
              <input className="admin-input" value={config.roomConfig.finalCode} onChange={(event) => onUpdateRoomConfig("finalCode", event.target.value)} dir="auto" />
              <button className="ghost-button" type="button" onClick={onSplitFinalCodeRewards}>
                <Sparkles aria-hidden="true" />
                החל
              </button>
            </span>
          </label>
          <p className="admin-help-text compact-help">
            {finalRewardsMessage ||
              "כשתשנו את התשובה הסופית, נחכה 10 שניות ואז נמלא אוטומטית את חלקי התשובה בכל שלב."}
          </p>

          <AdminCollapsibleSection title="קוד סופי ומסך סיום" meta="טקסטים וניקוד סיום" defaultOpen>
            <label>
              טקסט לפני הקוד הסופי
              <textarea className="admin-textarea" value={config.roomConfig.finalPrompt} onChange={(event) => onUpdateRoomConfig("finalPrompt", event.target.value)} />
            </label>
            <label>
              טקסט כפתור כניסה לקוד הסופי
              <input
                className="admin-input"
                value={config.roomConfig.finalEntryButtonLabel ?? ""}
                onChange={(event) => onUpdateRoomConfig("finalEntryButtonLabel", event.target.value)}
                placeholder="הזנת הקוד הסופי"
              />
            </label>
            <label>
              מצב פתיחת הקוד הסופי
              <select
                className="admin-input"
                value={config.roomConfig.finalInteractionMode ?? "auto"}
                onChange={(event) => onUpdateRoomConfig("finalInteractionMode", event.target.value)}
              >
                <option value="auto">אוטומטי</option>
                <option value="order">סידור חלקים</option>
              </select>
            </label>
            {(config.roomConfig.finalInteractionMode ?? "auto") === "order" && (
              <div className="admin-inline-fields">
                <label>
                  הוראה לסידור החלקים
                  <textarea
                    className="admin-textarea compact-textarea"
                    value={config.roomConfig.finalOrderPrompt ?? ""}
                    onChange={(event) => onUpdateRoomConfig("finalOrderPrompt", event.target.value)}
                    placeholder="סדרו את החלקים לפי הסדר הנכון."
                  />
                </label>
                <label>
                  הודעת טעות בסידור
                  <textarea
                    className="admin-textarea compact-textarea"
                    value={config.roomConfig.finalOrderErrorMessage ?? ""}
                    onChange={(event) => onUpdateRoomConfig("finalOrderErrorMessage", event.target.value)}
                    placeholder="הסדר עדיין לא נכון. נסו שוב."
                  />
                </label>
              </div>
            )}
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
              <label>
                הודעת שגיאה בקוד הסופי
                <textarea className="admin-textarea compact-textarea" value={config.roomConfig.finalErrorMessage} onChange={(event) => onUpdateRoomConfig("finalErrorMessage", event.target.value)} />
              </label>
            </div>
            <div className="admin-inline-fields">
              <label>
                כותרת קטנה במסך הסיום
                <input className="admin-input" value={config.roomConfig.finalSuccessEyebrow} onChange={(event) => onUpdateRoomConfig("finalSuccessEyebrow", event.target.value)} />
              </label>
              <label>
                כותרת גדולה במסך הסיום
                <input className="admin-input" value={config.roomConfig.finalSuccessTitle} onChange={(event) => onUpdateRoomConfig("finalSuccessTitle", event.target.value)} />
              </label>
            </div>
            <label>
              הודעה במסך הסיום
              <textarea className="admin-textarea compact-textarea" value={config.roomConfig.finalSuccessMessage} onChange={(event) => onUpdateRoomConfig("finalSuccessMessage", event.target.value)} />
            </label>
            <label>
              טקסט כפתור במסך הסיום
              <input className="admin-input" value={config.roomConfig.finalSuccessButtonLabel} onChange={(event) => onUpdateRoomConfig("finalSuccessButtonLabel", event.target.value)} />
            </label>
          </AdminCollapsibleSection>
        </div>
      )}

      {!normalizedSearchTerm && section === "advanced" && (
        <>
          <AdminCollapsibleSection title="מעבר בין שלבים" meta="ניווט אוטומטי אחרי תשובה נכונה" defaultOpen>
            <label className="switch-setting">
              <span>
                <strong>מעבר אוטומטי לשלב הבא</strong>
                <small>אחרי פתרון נכון המשתמש יעבור לבד לשלב הבא אחרי מספר השניות שתבחרו.</small>
              </span>
              <input
                type="checkbox"
                checked={Boolean(config.roomConfig.autoAdvanceEnabled)}
                onChange={(event) => onUpdateRoomConfig("autoAdvanceEnabled", event.target.checked)}
              />
              <span className="switch-track" aria-hidden="true">
                <span className="switch-thumb" />
              </span>
            </label>
            {config.roomConfig.autoAdvanceEnabled && (
              <label>
                כמה שניות לחכות
                <input
                  className="admin-input"
                  type="number"
                  min="0.5"
                  max="30"
                  step="0.5"
                  value={config.roomConfig.autoAdvanceDelaySeconds ?? 2}
                  onChange={(event) => onUpdateRoomConfig("autoAdvanceDelaySeconds", event.target.value)}
                />
              </label>
            )}
          </AdminCollapsibleSection>

          <AdminCollapsibleSection title="ברירות מחדל לשאלות" meta="תווית, ניקוד והודעות fallback" defaultOpen>
            <label>
              טקסט ברירת מחדל לפני שדה תשובה
              <input
                className="admin-input"
                value={config.roomConfig.defaultAnswerLabel ?? "הכניסו את הקוד"}
                onChange={(event) => onUpdateRoomConfig("defaultAnswerLabel", event.target.value)}
                placeholder="הכניסו את הקוד"
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
          </AdminCollapsibleSection>
        </>
      )}

      {!normalizedSearchTerm && section === "levels" && (
        <AdminCollapsibleSection
          title="שלבים"
          meta={normalizedSearchTerm ? `${filteredChallenges.length}/${config.challenges.length} תוצאות` : `${config.challenges.length} שלבים`}
          defaultOpen
        >
        <div className="admin-section-heading">
          <span>אפשר להוסיף או להסיר שלבים. שלב חדש מקבל כתובת חדשה אוטומטית.</span>
          <button className="ghost-button" type="button" onClick={onAddChallenge}>
            <Plus aria-hidden="true" />
            הוספת שלב
          </button>
        </div>
        <div className="admin-challenges">
          {filteredChallenges.map((challenge) => {
            const index = config.challenges.findIndex((item) => item.id === challenge.id);
            return (
            <AdminCollapsibleSection
              className="admin-challenge-collapse"
              defaultOpen={index === 0 || Boolean(normalizedSearchTerm)}
              key={challenge.id}
              meta={challenge.path}
              title={`שלב ${challenge.id}`}
            >
              <div className="admin-challenge-heading">
                <span>עריכת פרטי השלב</span>
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
              <AdminImageField
                label="תמונה לשאלה"
                value={challenge.questionImageUrl ?? ""}
                onChange={(value) => onUpdateChallenge(index, "questionImageUrl", value)}
                help="אפשר לשלב תמונה עם טקסט השאלה. אם אין צורך, השאירו ריק."
              />
              <div className="admin-inline-fields one-field">
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
              <AdminCollapsibleSection title="אפשרויות מתקדמות לשלב" meta="ניקוד, הודעות וסוג הקלדה">
                <div className="admin-inline-fields">
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
                  <label>
                    טקסט לפני שדה התשובה
                    <input
                      className="admin-input"
                      value={challenge.answerLabel ?? ""}
                      onChange={(event) => onUpdateChallenge(index, "answerLabel", event.target.value)}
                      placeholder="ריק = ברירת מחדל כללית"
                    />
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
              </AdminCollapsibleSection>
            </AdminCollapsibleSection>
            );
          })}
        </div>
        </AdminCollapsibleSection>
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

function AdminImageField({ label, value, onChange, help }) {
  const [uploadStatus, setUploadStatus] = useState("");

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadStatus("טוען תמונה...");

    try {
      const dataUrl = await readImageFile(file);
      onChange(dataUrl);
      setUploadStatus("התמונה נטענה. צריך לשמור את המשחק.");
    } catch {
      setUploadStatus("התמונה גדולה מדי. נסו תמונה קטנה יותר או הדביקו קישור לתמונה.");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="admin-image-field">
      <label>
        {label}
        <input
          className="admin-input"
          value={value ?? ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://... או העלאת תמונה"
          dir="ltr"
        />
      </label>
      <div className="admin-image-actions">
        <label className="ghost-button file-upload-button">
          העלאת תמונה
          <input type="file" accept="image/*" onChange={handleFileChange} />
        </label>
        {value && (
          <button className="ghost-button" type="button" onClick={() => onChange("")}>
            הסרת תמונה
          </button>
        )}
      </div>
      {value && (
        <div className="admin-image-preview">
          <img src={value} alt="" />
        </div>
      )}
      {help && <p className="admin-help-text">{help}</p>}
      {uploadStatus && <p className="admin-help-text">{uploadStatus}</p>}
    </div>
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
