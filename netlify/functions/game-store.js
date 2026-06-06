import { connectLambda, getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const STORE_NAME = "qr-escape-room";
const CONFIG_KEY = "game-config-v1";
const ADMIN_USERS_KEY = "admin-users-v1";
const PLAYERS_KEY = "players-v1";
const PLAYER_KEY_PREFIX = "players-v2/";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const PLAYER_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PLAYER_EVENT_LIMIT = 200;

const defaultGameConfig = {
  roomConfig: {
    title: "חדר בריחה",
    subtitle: "",
    finalPrompt: "הקלידו את הקוד שנוצר מכל החלקים שאספתם בדרך.",
    defaultSuccessMessage: "פתרתם את השלב וקיבלתם חלק מהקוד הסופי:",
    defaultErrorMessage: "הקוד הזה לא פתח את השלב. בדקו את הרמז ונסו שוב.",
    finalErrorMessage: "אפשר לכתוב את הקוד עם רווח או בלי רווח. בדקו את החלקים ונסו שוב.",
    finalSuccessEyebrow: "הבריחה הושלמה",
    finalSuccessTitle: "חופשה נעימה!",
    finalSuccessMessage: "כל הכבוד, פתחתם את הקוד הסופי.",
    finalSuccessButtonLabel: "חזרה לשלבים",
    finalCode: "חופשה נעימה",
  },
  challenges: [
    { id: 1, path: "/q/1", title: "קוד 1", question: "", answer: "1", reward: "חו" },
    { id: 2, path: "/q/2", title: "קוד 2", question: "", answer: "2", reward: "פ" },
    { id: 3, path: "/q/3", title: "קוד 3", question: "", answer: "3", reward: "שה" },
    { id: 4, path: "/q/4", title: "קוד 4", question: "", answer: "4", reward: "נע" },
    { id: 5, path: "/q/5", title: "קוד 5", question: "", answer: "5", reward: "ימה" },
  ],
};

export function initBlobContext(event) {
  connectLambda(event);
}

export function normalizeCode(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

export function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(data),
  };
}

export function methodNotAllowed() {
  return jsonResponse(405, { error: "method_not_allowed" });
}

export function readJsonBody(event) {
  if (!event.body) {
    return {};
  }

  try {
    return JSON.parse(event.body);
  } catch {
    return null;
  }
}

function cleanString(value, fallback = "") {
  return String(value ?? fallback);
}

function sanitizeChallenge(challenge, index) {
  const fallbackId = index + 1;
  const numericId = Number(challenge?.id);
  const id = Number.isFinite(numericId) && numericId > 0 ? Math.trunc(numericId) : fallbackId;

  return {
    id,
    path: cleanString(challenge?.path, `/q/${id}`) || `/q/${id}`,
    title: cleanString(challenge?.title, `קוד ${id}`) || `קוד ${id}`,
    question: cleanString(challenge?.question),
    answer: cleanString(challenge?.answer),
    reward: cleanString(challenge?.reward),
    successMessage: cleanString(challenge?.successMessage),
    errorMessage: cleanString(challenge?.errorMessage),
  };
}

export function sanitizeGameConfig(config) {
  const source = config && typeof config === "object" ? config : defaultGameConfig;
  const sourceRoomConfig =
    source.roomConfig && typeof source.roomConfig === "object" ? source.roomConfig : defaultGameConfig.roomConfig;
  const sourceChallenges =
    Array.isArray(source.challenges) && source.challenges.length > 0 ? source.challenges : defaultGameConfig.challenges;

  return {
    roomConfig: {
      title: cleanString(sourceRoomConfig.title, defaultGameConfig.roomConfig.title),
      subtitle: cleanString(sourceRoomConfig.subtitle, defaultGameConfig.roomConfig.subtitle),
      finalPrompt: cleanString(sourceRoomConfig.finalPrompt, defaultGameConfig.roomConfig.finalPrompt),
      defaultSuccessMessage: cleanString(
        sourceRoomConfig.defaultSuccessMessage,
        defaultGameConfig.roomConfig.defaultSuccessMessage,
      ),
      defaultErrorMessage: cleanString(
        sourceRoomConfig.defaultErrorMessage,
        defaultGameConfig.roomConfig.defaultErrorMessage,
      ),
      finalErrorMessage: cleanString(sourceRoomConfig.finalErrorMessage, defaultGameConfig.roomConfig.finalErrorMessage),
      finalSuccessEyebrow: cleanString(
        sourceRoomConfig.finalSuccessEyebrow,
        defaultGameConfig.roomConfig.finalSuccessEyebrow,
      ),
      finalSuccessTitle: cleanString(
        sourceRoomConfig.finalSuccessTitle,
        defaultGameConfig.roomConfig.finalSuccessTitle,
      ),
      finalSuccessMessage: cleanString(
        sourceRoomConfig.finalSuccessMessage,
        defaultGameConfig.roomConfig.finalSuccessMessage,
      ),
      finalSuccessButtonLabel: cleanString(
        sourceRoomConfig.finalSuccessButtonLabel,
        defaultGameConfig.roomConfig.finalSuccessButtonLabel,
      ),
      finalCode: cleanString(sourceRoomConfig.finalCode, defaultGameConfig.roomConfig.finalCode),
    },
    challenges: sourceChallenges.map(sanitizeChallenge),
  };
}

export function toPublicConfig(config) {
  const safeConfig = sanitizeGameConfig(config);

  return {
    roomConfig: {
      title: safeConfig.roomConfig.title,
      subtitle: safeConfig.roomConfig.subtitle,
      finalPrompt: safeConfig.roomConfig.finalPrompt,
      defaultSuccessMessage: safeConfig.roomConfig.defaultSuccessMessage,
      defaultErrorMessage: safeConfig.roomConfig.defaultErrorMessage,
      finalErrorMessage: safeConfig.roomConfig.finalErrorMessage,
      finalSuccessEyebrow: safeConfig.roomConfig.finalSuccessEyebrow,
      finalSuccessTitle: safeConfig.roomConfig.finalSuccessTitle,
      finalSuccessMessage: safeConfig.roomConfig.finalSuccessMessage,
      finalSuccessButtonLabel: safeConfig.roomConfig.finalSuccessButtonLabel,
    },
    challenges: safeConfig.challenges.map(({ answer, ...challenge }) => challenge),
  };
}

export async function getGameConfig() {
  const store = getStore(STORE_NAME);
  const savedConfig = await store.get(CONFIG_KEY, { type: "json" });
  return sanitizeGameConfig(savedConfig);
}

export async function saveGameConfig(config) {
  const cleanConfig = sanitizeGameConfig(config);
  const store = getStore(STORE_NAME);
  await store.setJSON(CONFIG_KEY, cleanConfig);
  return cleanConfig;
}

function getTokenSecret() {
  return process.env.ADMIN_TOKEN_SECRET || "";
}

function sign(value) {
  return crypto.createHmac("sha256", getTokenSecret()).update(value).digest("base64url");
}

function safeCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("base64url");
}

function normalizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("base64url")) {
  return {
    salt,
    hash: crypto.pbkdf2Sync(String(password), salt, 100000, 32, "sha256").toString("base64url"),
  };
}

function verifyPassword(password, passwordRecord) {
  if (!passwordRecord?.salt || !passwordRecord?.hash) {
    return false;
  }

  const nextRecord = hashPassword(password, passwordRecord.salt);
  return safeCompare(nextRecord.hash, passwordRecord.hash);
}

function createTemporaryPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

function createSignedToken(payload, ttlMs) {
  const now = Date.now();
  const encodedPayload = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + ttlMs })).toString("base64url");

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

function readSignedToken(token) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature || !getTokenSecret()) {
    return null;
  }

  if (!safeCompare(sign(payload), signature)) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(data.exp) > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function createAdminToken({ email = "", role = "master" } = {}) {
  return createSignedToken({ type: "admin", email, role }, TOKEN_TTL_MS);
}

export function verifyAdminToken(event) {
  const authorizationHeader = event.headers.authorization ?? event.headers.Authorization ?? "";
  const token = authorizationHeader.replace(/^Bearer\s+/i, "");
  const data = readSignedToken(token);

  return data?.type === "admin" ? data : false;
}

function createPlayerToken(player) {
  return createSignedToken(
    {
      type: "player",
      playerId: player.id,
      name: player.name,
      email: player.email,
    },
    PLAYER_TOKEN_TTL_MS,
  );
}

function sanitizeAdminUsers(data) {
  const users = Array.isArray(data?.users) ? data.users : [];

  return {
    users: users
      .map((user) => ({
        id: cleanString(user.id),
        name: cleanString(user.name),
        email: normalizeEmail(user.email),
        role: user.role === "master" ? "master" : "admin",
        password: user.password,
        createdAt: cleanString(user.createdAt),
      }))
      .filter((user) => user.id && user.email && user.password?.hash && user.password?.salt),
  };
}

function publicAdminUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}

export async function getAdminUsers() {
  const store = getStore(STORE_NAME);
  return sanitizeAdminUsers(await store.get(ADMIN_USERS_KEY, { type: "json" }));
}

async function saveAdminUsers(data) {
  const cleanData = sanitizeAdminUsers(data);
  const store = getStore(STORE_NAME);
  await store.setJSON(ADMIN_USERS_KEY, cleanData);
  return cleanData;
}

export async function findAdminUser(email) {
  const adminUsers = await getAdminUsers();
  return adminUsers.users.find((user) => user.email === normalizeEmail(email)) ?? null;
}

export async function authenticateAdminUser({ email, password }) {
  const user = await findAdminUser(email);

  if (!user || !verifyPassword(password, user.password)) {
    return null;
  }

  return publicAdminUser(user);
}

export async function createAdminUser({ email, name }) {
  const adminUsers = await getAdminUsers();
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("email_required");
  }

  if (adminUsers.users.some((user) => user.email === normalizedEmail)) {
    throw new Error("admin_exists");
  }

  const temporaryPassword = createTemporaryPassword();
  const user = {
    id: crypto.randomUUID(),
    name: cleanString(name, normalizedEmail),
    email: normalizedEmail,
    role: "admin",
    password: hashPassword(temporaryPassword),
    createdAt: new Date().toISOString(),
  };

  adminUsers.users.push(user);
  await saveAdminUsers(adminUsers);

  return {
    user: publicAdminUser(user),
    temporaryPassword,
  };
}

export async function deleteAdminUser(id) {
  const adminUsers = await getAdminUsers();
  const nextUsers = adminUsers.users.filter((user) => user.id !== id);

  await saveAdminUsers({ users: nextUsers });

  return nextUsers.map(publicAdminUser);
}

export async function listPublicAdminUsers() {
  const adminUsers = await getAdminUsers();
  return adminUsers.users.map(publicAdminUser);
}

function sanitizePlayersData(data) {
  const players = Array.isArray(data?.players) ? data.players : [];

  return {
    players: players
      .map((player) => ({
        id: cleanString(player.id),
        name: cleanString(player.name, "אורח"),
        email: normalizeEmail(player.email),
        tokenHash: cleanString(player.tokenHash),
        createdAt: cleanString(player.createdAt),
        lastSeenAt: cleanString(player.lastSeenAt),
        challenges: player.challenges && typeof player.challenges === "object" ? player.challenges : {},
        final: player.final && typeof player.final === "object" ? player.final : {},
        events: Array.isArray(player.events) ? player.events.slice(-PLAYER_EVENT_LIMIT) : [],
      }))
      .filter((player) => player.id && player.tokenHash),
  };
}

async function getPlayersData() {
  const store = getStore(STORE_NAME);
  const legacyData = sanitizePlayersData(await store.get(PLAYERS_KEY, { type: "json" }));
  const { blobs } = await store.list({ prefix: PLAYER_KEY_PREFIX });
  const playerEntries = await Promise.all(blobs.map((blob) => store.get(blob.key, { type: "json" })));
  const playersById = new Map();

  for (const player of legacyData.players) {
    playersById.set(player.id, player);
  }

  for (const player of sanitizePlayersData({ players: playerEntries }).players) {
    playersById.set(player.id, player);
  }

  return { players: [...playersById.values()] };
}

async function savePlayersData(data) {
  const cleanData = sanitizePlayersData(data);
  const store = getStore(STORE_NAME);
  await Promise.all(cleanData.players.map((player) => store.setJSON(`${PLAYER_KEY_PREFIX}${player.id}`, player)));
  return cleanData;
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    email: player.email,
    createdAt: player.createdAt,
  };
}

function getPlayerTokenFromEvent(event) {
  const authorizationHeader = event.headers.authorization ?? event.headers.Authorization ?? "";
  return authorizationHeader.replace(/^Bearer\s+/i, "");
}

export async function createPlayerSession({ name, email }) {
  const data = await getPlayersData();
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  let player = normalizedEmail ? data.players.find((item) => item.email === normalizedEmail) : null;

  if (!player) {
    player = {
      id: crypto.randomUUID(),
      name: cleanString(name, "אורח") || "אורח",
      email: normalizedEmail,
      tokenHash: "",
      createdAt: now,
      lastSeenAt: now,
      challenges: {},
      final: {},
      events: [],
    };
    data.players.push(player);
  }

  player.name = cleanString(name, player.name) || player.name;
  const token = createPlayerToken(player);
  player.tokenHash = hashToken(token);
  player.lastSeenAt = now;

  return {
    token,
    player: publicPlayer(player),
  };
}

async function getPlayerSession(event) {
  const token = getPlayerTokenFromEvent(event);

  if (!token) {
    return null;
  }

  const data = await getPlayersData();
  const signedPlayer = readSignedToken(token);
  const tokenDigest = hashToken(token);
  let playerIndex = signedPlayer?.type === "player"
    ? data.players.findIndex((player) => player.id === signedPlayer.playerId)
    : -1;

  if (playerIndex < 0) {
    playerIndex = data.players.findIndex((player) => player.tokenHash === tokenDigest);
  }

  if (playerIndex < 0 && signedPlayer?.type === "player" && signedPlayer.playerId) {
    data.players.push({
      id: signedPlayer.playerId,
      name: cleanString(signedPlayer.name, "אורח") || "אורח",
      email: normalizeEmail(signedPlayer.email),
      tokenHash: tokenDigest,
      createdAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      challenges: {},
      final: {},
      events: [],
    });
    playerIndex = data.players.length - 1;
  }

  if (playerIndex < 0) {
    return null;
  }

  return {
    data,
    player: data.players[playerIndex],
    playerIndex,
  };
}

function ensureChallengeStats(player, challengeId) {
  const key = String(challengeId);
  const currentStats = player.challenges[key] ?? {};

  player.challenges[key] = {
    attempts: Number(currentStats.attempts) || 0,
    wrongAttempts: Number(currentStats.wrongAttempts) || 0,
    firstAttemptAt: currentStats.firstAttemptAt || "",
    solvedAt: currentStats.solvedAt || "",
  };

  return player.challenges[key];
}

function recordPlayerEvent(player, event) {
  player.events = [...(Array.isArray(player.events) ? player.events : []), event].slice(-PLAYER_EVENT_LIMIT);
}

export async function recordChallengeAttempt(event, challengeId, correct) {
  const session = await getPlayerSession(event);

  if (!session) {
    return null;
  }

  const now = new Date().toISOString();
  const stats = ensureChallengeStats(session.player, challengeId);

  stats.attempts += 1;
  stats.firstAttemptAt ||= now;

  if (correct) {
    stats.solvedAt ||= now;
  } else {
    stats.wrongAttempts += 1;
  }

  session.player.lastSeenAt = now;
  recordPlayerEvent(session.player, { type: "challenge", challengeId, correct, at: now });
  await savePlayersData(session.data);

  return publicPlayer(session.player);
}

export async function recordFinalAttempt(event, correct) {
  const session = await getPlayerSession(event);

  if (!session) {
    return null;
  }

  const now = new Date().toISOString();
  const currentFinalStats = session.player.final ?? {};

  session.player.final = {
    attempts: Number(currentFinalStats.attempts) || 0,
    wrongAttempts: Number(currentFinalStats.wrongAttempts) || 0,
    firstAttemptAt: currentFinalStats.firstAttemptAt || now,
    solvedAt: currentFinalStats.solvedAt || "",
  };
  session.player.final.attempts += 1;

  if (correct) {
    session.player.final.solvedAt ||= now;
  } else {
    session.player.final.wrongAttempts += 1;
  }

  session.player.lastSeenAt = now;
  recordPlayerEvent(session.player, { type: "final", correct, at: now });
  await savePlayersData(session.data);

  return publicPlayer(session.player);
}

function msBetween(start, end) {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);

  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs ? endMs - startMs : null;
}

function summarizePlayer(player, config) {
  const challenges = config.challenges;
  const solvedChallenges = challenges.filter((challenge) => player.challenges[String(challenge.id)]?.solvedAt);
  const wrongAttempts = Object.values(player.challenges).reduce(
    (total, stats) => total + (Number(stats.wrongAttempts) || 0),
    Number(player.final?.wrongAttempts) || 0,
  );
  const finalSolvedAt = player.final?.solvedAt || "";
  const completed = Boolean(finalSolvedAt);
  const lastSolvedChallenge = solvedChallenges.at(-1) ?? null;
  const totalMs = completed
    ? msBetween(player.createdAt, finalSolvedAt)
    : msBetween(player.createdAt, player.lastSeenAt);
  const points = solvedChallenges.length * 100 + (completed ? 250 : 0) - wrongAttempts * 5;

  return {
    id: player.id,
    name: player.name,
    email: player.email,
    level: completed ? "סיים" : lastSolvedChallenge ? lastSolvedChallenge.title : "בהתחלה",
    solvedCount: solvedChallenges.length,
    challengeCount: challenges.length,
    completed,
    points: Math.max(0, points),
    wrongAttempts,
    totalMs,
    startedAt: player.createdAt,
    lastSeenAt: player.lastSeenAt,
    finalSolvedAt,
  };
}

function sortLeaderboard(left, right) {
  if (left.completed !== right.completed) {
    return left.completed ? -1 : 1;
  }

  if (left.completed && right.completed && left.totalMs !== right.totalMs) {
    return (left.totalMs ?? Number.MAX_SAFE_INTEGER) - (right.totalMs ?? Number.MAX_SAFE_INTEGER);
  }

  if (left.points !== right.points) {
    return right.points - left.points;
  }

  if (left.solvedCount !== right.solvedCount) {
    return right.solvedCount - left.solvedCount;
  }

  return Date.parse(left.startedAt) - Date.parse(right.startedAt);
}

export async function getLeaderboard({ limit = 10 } = {}) {
  const [playersData, config] = await Promise.all([getPlayersData(), getGameConfig()]);

  return playersData.players.map((player) => summarizePlayer(player, config)).sort(sortLeaderboard).slice(0, limit);
}

export async function deletePlayers(ids) {
  const playerIds = new Set((Array.isArray(ids) ? ids : []).map((id) => cleanString(id)).filter(Boolean));

  if (!playerIds.size) {
    return getAnalytics();
  }

  const store = getStore(STORE_NAME);
  const legacyData = sanitizePlayersData(await store.get(PLAYERS_KEY, { type: "json" }));
  await store.setJSON(PLAYERS_KEY, {
    players: legacyData.players.filter((player) => !playerIds.has(player.id)),
  });
  await Promise.all([...playerIds].map((id) => store.delete(`${PLAYER_KEY_PREFIX}${id}`)));

  return getAnalytics();
}

export async function getAnalytics() {
  const [playersData, config] = await Promise.all([getPlayersData(), getGameConfig()]);
  const summaries = playersData.players.map((player) => summarizePlayer(player, config)).sort(sortLeaderboard);
  const completedPlayers = summaries.filter((summary) => summary.completed);
  const totalWrongAttempts = summaries.reduce((total, summary) => total + summary.wrongAttempts, 0);
  const usageByHour = {};

  for (const player of playersData.players) {
    for (const event of player.events) {
      if (!event.at) {
        continue;
      }

      const hour = event.at.slice(0, 13) + ":00";
      usageByHour[hour] = (usageByHour[hour] ?? 0) + 1;
    }
  }

  const perChallenge = config.challenges.map((challenge) => {
    const challengeStats = playersData.players
      .map((player) => player.challenges[String(challenge.id)])
      .filter(Boolean);
    const solvedDurations = playersData.players
      .map((player) => {
        const stats = player.challenges[String(challenge.id)];
        return stats?.solvedAt ? msBetween(player.createdAt, stats.solvedAt) : null;
      })
      .filter((duration) => duration !== null);

    return {
      id: challenge.id,
      title: challenge.title,
      attempts: challengeStats.reduce((total, stats) => total + (Number(stats.attempts) || 0), 0),
      wrongAttempts: challengeStats.reduce((total, stats) => total + (Number(stats.wrongAttempts) || 0), 0),
      solvedCount: challengeStats.filter((stats) => stats.solvedAt).length,
      averageSolveMs: solvedDurations.length
        ? Math.round(solvedDurations.reduce((total, duration) => total + duration, 0) / solvedDurations.length)
        : null,
    };
  });

  return {
    totals: {
      players: playersData.players.length,
      completed: completedPlayers.length,
      active: playersData.players.length - completedPlayers.length,
      wrongAttempts: totalWrongAttempts,
      averageFinishMs: completedPlayers.length
        ? Math.round(
            completedPlayers.reduce((total, player) => total + (player.totalMs ?? 0), 0) / completedPlayers.length,
          )
        : null,
    },
    perChallenge,
    usageByHour: Object.entries(usageByHour)
      .map(([hour, count]) => ({ hour, count }))
      .sort((left, right) => left.hour.localeCompare(right.hour)),
    leaderboard: summaries.slice(0, 25),
  };
}
