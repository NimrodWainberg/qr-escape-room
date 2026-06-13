import { connectLambda, getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const STORE_NAME = "qr-escape-room";
const DEFAULT_GAME_ID = "main";
const GAMES_KEY = "games-v1";
const GLOBAL_SETTINGS_KEY = "global-settings-v1";
const CONFIG_KEY = "game-config-v1";
const CONFIG_KEY_PREFIX = "game-config-v2/";
const ADMIN_USERS_KEY = "admin-users-v1";
const PLAYERS_KEY = "players-v1";
const PLAYER_KEY_PREFIX = "players-v2/";
const GAME_PLAYER_KEY_PREFIX = "game-players-v1/";
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
    gamePassword: "",
    showEmailLogin: true,
    defaultAnswerLabel: "הכניסו את הקוד",
    questionPoints: 10,
    wrongAnswerPenalty: 1,
    finalBonusPoints: 50,
    puzzleMode: "off",
    puzzleTitle: "מפת הבריחה",
    puzzleSubtitle: "כל קוד נכון חושף חלק נוסף בתמונה.",
    puzzleTheme: "vacation",
    puzzleImageUrl: "",
  },
  challenges: [
    { id: 1, path: "/q/1", title: "קוד 1", question: "", answer: "1", reward: "חו" },
    { id: 2, path: "/q/2", title: "קוד 2", question: "", answer: "2", reward: "פ" },
    { id: 3, path: "/q/3", title: "קוד 3", question: "", answer: "3", reward: "שה" },
    { id: 4, path: "/q/4", title: "קוד 4", question: "", answer: "4", reward: "נע" },
    { id: 5, path: "/q/5", title: "קוד 5", question: "", answer: "5", reward: "ימה" },
  ],
};

const defaultGlobalSettings = {
  showEmailLogin: true,
};

function createBlankGameConfig(title = "") {
  return {
    roomConfig: {
      ...defaultGameConfig.roomConfig,
      title: cleanString(title, defaultGameConfig.roomConfig.title) || defaultGameConfig.roomConfig.title,
      finalCode: "",
      gamePassword: "",
      puzzleMode: "off",
      puzzleImageUrl: "",
    },
    challenges: defaultGameConfig.challenges.map((challenge) => ({
      ...challenge,
      question: "",
      questionImageUrl: "",
      answer: "",
      answerFields: [],
      choiceOptions: [],
      reward: "",
      points: "",
      wrongAnswerPenalty: "",
      successMessage: "",
      errorMessage: "",
    })),
  };
}

export function initBlobContext(event) {
  connectLambda(event);
}

export function normalizeCode(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

export function normalizeGameId(value) {
  const slug = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return slug || DEFAULT_GAME_ID;
}

export function getGameIdFromEvent(event, body = null) {
  return normalizeGameId(event.queryStringParameters?.gameId ?? event.queryStringParameters?.game ?? body?.gameId ?? body?.game);
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

function getConfigKey(gameId = DEFAULT_GAME_ID) {
  const id = normalizeGameId(gameId);
  return id === DEFAULT_GAME_ID ? CONFIG_KEY : `${CONFIG_KEY_PREFIX}${id}`;
}

function getPlayerPrefix(gameId = DEFAULT_GAME_ID) {
  const id = normalizeGameId(gameId);
  return id === DEFAULT_GAME_ID ? PLAYER_KEY_PREFIX : `${GAME_PLAYER_KEY_PREFIX}${id}/`;
}

function getLegacyPlayersKey(gameId = DEFAULT_GAME_ID) {
  const id = normalizeGameId(gameId);
  return id === DEFAULT_GAME_ID ? PLAYERS_KEY : `${PLAYERS_KEY}/${id}`;
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function scoreNumber(value, fallback) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  return cleanNumber(value, fallback);
}

function cleanAnswerInputMode(value) {
  return ["auto", "numeric", "text"].includes(value) ? value : "auto";
}

export function sanitizeGlobalSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : defaultGlobalSettings;

  return {
    showEmailLogin: source.showEmailLogin === false ? false : defaultGlobalSettings.showEmailLogin,
  };
}

function isNumericAnswer(value) {
  return /^\d+$/.test(normalizeCode(value));
}

function resolveNumericOnly(challenge) {
  const mode = cleanAnswerInputMode(challenge.answerInputMode);

  if (mode === "numeric") {
    return true;
  }

  if (mode === "text" || challenge.answerType === "choice") {
    return false;
  }

  if (challenge.answerFields.length > 0) {
    return challenge.answerFields.every((field) => isNumericAnswer(field.answer));
  }

  return isNumericAnswer(challenge.answer);
}

function sanitizeChallenge(challenge, index) {
  const fallbackId = index + 1;
  const numericId = Number(challenge?.id);
  const id = Number.isFinite(numericId) && numericId > 0 ? Math.trunc(numericId) : fallbackId;

  const answerType = challenge?.answerType === "choice" ? "choice" : "open";
  const answerFields = Array.isArray(challenge?.answerFields)
    ? challenge.answerFields
        .slice(0, 6)
        .map((field, fieldIndex) => ({
          id: cleanString(field?.id, `field-${fieldIndex + 1}`) || `field-${fieldIndex + 1}`,
          label: cleanString(field?.label, fieldIndex === 0 ? "" : `שדה ${fieldIndex + 1}`),
          answer: cleanString(field?.answer),
        }))
        .filter((field) => field.answer || field.label)
    : [];
  const choiceOptions = Array.isArray(challenge?.choiceOptions)
    ? challenge.choiceOptions
        .slice(0, 8)
        .map((option, optionIndex) => ({
          id: cleanString(option?.id, `option-${optionIndex + 1}`) || `option-${optionIndex + 1}`,
          text: cleanString(option?.text),
          correct: Boolean(option?.correct),
        }))
        .filter((option) => option.text)
    : [];

  return {
    id,
    path: cleanString(challenge?.path, `/q/${id}`) || `/q/${id}`,
    title: cleanString(challenge?.title, `קוד ${id}`) || `קוד ${id}`,
    question: cleanString(challenge?.question),
    questionImageUrl: cleanString(challenge?.questionImageUrl),
    answerType,
    answerInputMode: cleanAnswerInputMode(challenge?.answerInputMode),
    answerLabel: cleanString(challenge?.answerLabel),
    answer: cleanString(challenge?.answer),
    answerFields,
    choiceOptions,
    reward: cleanString(challenge?.reward),
    points: cleanOptionalNumber(challenge?.points),
    wrongAnswerPenalty: cleanOptionalNumber(challenge?.wrongAnswerPenalty),
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
  const defaultAnswerLabel = cleanString(
    sourceRoomConfig.defaultAnswerLabel,
    defaultGameConfig.roomConfig.defaultAnswerLabel,
  ).trim();

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
      gamePassword: cleanString(sourceRoomConfig.gamePassword, defaultGameConfig.roomConfig.gamePassword),
      showEmailLogin: sourceRoomConfig.showEmailLogin === false ? false : defaultGameConfig.roomConfig.showEmailLogin,
      defaultAnswerLabel:
        !defaultAnswerLabel || defaultAnswerLabel === "הכניסו מספר"
          ? defaultGameConfig.roomConfig.defaultAnswerLabel
          : defaultAnswerLabel,
      questionPoints: cleanNumber(sourceRoomConfig.questionPoints, defaultGameConfig.roomConfig.questionPoints),
      wrongAnswerPenalty: cleanNumber(
        sourceRoomConfig.wrongAnswerPenalty,
        defaultGameConfig.roomConfig.wrongAnswerPenalty,
      ),
      finalBonusPoints: cleanNumber(sourceRoomConfig.finalBonusPoints, defaultGameConfig.roomConfig.finalBonusPoints),
      puzzleMode: ["off", "reveal"].includes(sourceRoomConfig.puzzleMode)
        ? sourceRoomConfig.puzzleMode
        : defaultGameConfig.roomConfig.puzzleMode,
      puzzleTitle: cleanString(sourceRoomConfig.puzzleTitle, defaultGameConfig.roomConfig.puzzleTitle),
      puzzleSubtitle: cleanString(sourceRoomConfig.puzzleSubtitle, defaultGameConfig.roomConfig.puzzleSubtitle),
      puzzleTheme: ["vacation", "treasure", "space"].includes(sourceRoomConfig.puzzleTheme)
        ? sourceRoomConfig.puzzleTheme
        : defaultGameConfig.roomConfig.puzzleTheme,
      puzzleImageUrl: cleanString(sourceRoomConfig.puzzleImageUrl, defaultGameConfig.roomConfig.puzzleImageUrl),
    },
    challenges: sourceChallenges.map(sanitizeChallenge),
  };
}

export function toPublicConfig(config, globalSettings = defaultGlobalSettings) {
  const safeConfig = sanitizeGameConfig(config);
  const safeGlobalSettings = sanitizeGlobalSettings(globalSettings);

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
      questionPoints: safeConfig.roomConfig.questionPoints,
      wrongAnswerPenalty: safeConfig.roomConfig.wrongAnswerPenalty,
      finalBonusPoints: safeConfig.roomConfig.finalBonusPoints,
      puzzleMode: safeConfig.roomConfig.puzzleMode,
      puzzleTitle: safeConfig.roomConfig.puzzleTitle,
      puzzleSubtitle: safeConfig.roomConfig.puzzleSubtitle,
      puzzleTheme: safeConfig.roomConfig.puzzleTheme,
      puzzleImageUrl: safeConfig.roomConfig.puzzleImageUrl,
      passwordProtected: Boolean(safeConfig.roomConfig.gamePassword),
      showEmailLogin: safeGlobalSettings.showEmailLogin,
      defaultAnswerLabel: safeConfig.roomConfig.defaultAnswerLabel,
    },
    challenges: safeConfig.challenges.map(({ answer, answerFields, choiceOptions, ...challenge }) => ({
      ...challenge,
      numericOnly: resolveNumericOnly({ ...challenge, answer, answerFields, choiceOptions }),
      answerFields: answerFields.map(({ answer: _answer, ...field }) => field),
      choiceOptions: choiceOptions.map(({ correct: _correct, ...option }) => option),
    })),
  };
}

export async function getGlobalSettings() {
  const store = getStore(STORE_NAME);
  const savedSettings = await store.get(GLOBAL_SETTINGS_KEY, { type: "json" });
  return sanitizeGlobalSettings(savedSettings);
}

export async function saveGlobalSettings(settings) {
  const cleanSettings = sanitizeGlobalSettings(settings);
  const store = getStore(STORE_NAME);
  await store.setJSON(GLOBAL_SETTINGS_KEY, cleanSettings);
  return cleanSettings;
}

async function publicGame(game) {
  const id = normalizeGameId(game.id);
  const config = await getGameConfig(id);

  return {
    id,
    title: cleanString(game.title, config.roomConfig.title || defaultGameConfig.roomConfig.title) || defaultGameConfig.roomConfig.title,
    createdAt: cleanString(game.createdAt),
    updatedAt: cleanString(game.updatedAt),
    locked: Boolean(config.roomConfig.gamePassword),
  };
}

async function getGamesData() {
  const store = getStore(STORE_NAME);
  const savedData = await store.get(GAMES_KEY, { type: "json" });

  if (savedData && typeof savedData === "object" && Array.isArray(savedData.games)) {
    return { games: await Promise.all(savedData.games.map(publicGame)) };
  }

  const games = Array.isArray(savedData?.games) ? await Promise.all(savedData.games.map(publicGame)) : [];

  if (!games.some((game) => game.id === DEFAULT_GAME_ID)) {
    const config = await getGameConfig(DEFAULT_GAME_ID);
    games.unshift({
      id: DEFAULT_GAME_ID,
      title: config.roomConfig.title || defaultGameConfig.roomConfig.title,
      createdAt: "",
      updatedAt: "",
    });
  }

  return { games };
}

async function saveGamesData(data) {
  const cleanGames = [];

  for (const game of Array.isArray(data?.games) ? data.games : []) {
    const cleanGame = {
      id: normalizeGameId(game.id),
      title: cleanString(game.title, defaultGameConfig.roomConfig.title) || defaultGameConfig.roomConfig.title,
      createdAt: cleanString(game.createdAt),
      updatedAt: cleanString(game.updatedAt),
    };

    if (!cleanGames.some((item) => item.id === cleanGame.id)) {
      cleanGames.push(cleanGame);
    }
  }

  const cleanData = {
    games: cleanGames,
  };
  const store = getStore(STORE_NAME);
  await store.setJSON(GAMES_KEY, cleanData);
  return cleanData;
}

export async function listGames() {
  return getGamesData();
}

export async function updateGameSummary(gameId, config) {
  const id = normalizeGameId(gameId);
  const gamesData = await getGamesData();
  const now = new Date().toISOString();
  const index = gamesData.games.findIndex((game) => game.id === id);
  const nextGame = {
    id,
    title: cleanString(config?.roomConfig?.title, defaultGameConfig.roomConfig.title) || defaultGameConfig.roomConfig.title,
    createdAt: gamesData.games[index]?.createdAt || now,
    updatedAt: now,
  };

  if (index >= 0) {
    gamesData.games[index] = nextGame;
  } else {
    gamesData.games.push(nextGame);
  }

  await saveGamesData(gamesData);
  return nextGame;
}

export async function createGame({ id, title, sourceGameId = null } = {}) {
  const cleanId = normalizeGameId(id);
  const cleanTitleId = normalizeGameId(title);
  const gameId = cleanId !== DEFAULT_GAME_ID ? cleanId : cleanTitleId !== DEFAULT_GAME_ID ? cleanTitleId : `game-${crypto.randomBytes(3).toString("hex")}`;
  const gamesData = await getGamesData();

  if (gamesData.games.some((game) => game.id === gameId)) {
    throw new Error("game_exists");
  }

  const sourceConfig = sourceGameId ? await getGameConfig(sourceGameId) : createBlankGameConfig(title);
  const nextConfig = sanitizeGameConfig({
    ...sourceConfig,
    roomConfig: {
      ...sourceConfig.roomConfig,
      title: cleanString(title, sourceConfig.roomConfig.title) || sourceConfig.roomConfig.title,
    },
  });
  const now = new Date().toISOString();
  const game = {
    id: gameId,
    title: nextConfig.roomConfig.title,
    createdAt: now,
    updatedAt: now,
  };

  gamesData.games.push(game);
  await saveGamesData(gamesData);
  await saveGameConfig(nextConfig, gameId);

  return { game, config: nextConfig };
}

export async function deleteGame(gameId) {
  const id = normalizeGameId(gameId);

  const gamesData = await getGamesData();
  const nextGames = gamesData.games.filter((game) => game.id !== id);

  if (nextGames.length === gamesData.games.length) {
    throw new Error("game_not_found");
  }

  const store = getStore(STORE_NAME);
  const { blobs: playerBlobs } = await store.list({ prefix: getPlayerPrefix(id) });

  await Promise.all([
    saveGamesData({ games: nextGames }),
    store.delete(getConfigKey(id)),
    store.delete(getLegacyPlayersKey(id)),
    ...playerBlobs.map((blob) => store.delete(blob.key)),
  ]);

  return { games: nextGames };
}

export async function getGameConfig(gameId = DEFAULT_GAME_ID) {
  const store = getStore(STORE_NAME);
  const savedConfig = await store.get(getConfigKey(gameId), { type: "json" });
  return sanitizeGameConfig(savedConfig);
}

export async function verifyGamePassword(gameId, password) {
  const config = await getGameConfig(gameId);
  const expectedPassword = cleanString(config.roomConfig.gamePassword).trim();

  if (!expectedPassword) {
    return true;
  }

  return safeCompare(normalizeCode(expectedPassword), normalizeCode(password));
}

export async function saveGameConfig(config, gameId = DEFAULT_GAME_ID) {
  const cleanConfig = sanitizeGameConfig(config);
  const store = getStore(STORE_NAME);
  await store.setJSON(getConfigKey(gameId), cleanConfig);
  await updateGameSummary(gameId, cleanConfig);
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
      gameId: player.gameId ?? DEFAULT_GAME_ID,
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
        gameId: normalizeGameId(player.gameId),
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

async function getPlayersData(gameId = DEFAULT_GAME_ID) {
  const store = getStore(STORE_NAME);
  const id = normalizeGameId(gameId);
  const legacyData = sanitizePlayersData(await store.get(getLegacyPlayersKey(id), { type: "json" }));
  const { blobs } = await store.list({ prefix: getPlayerPrefix(id) });
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

async function savePlayersData(data, gameId = DEFAULT_GAME_ID) {
  const cleanData = sanitizePlayersData(data);
  const store = getStore(STORE_NAME);
  const prefix = getPlayerPrefix(gameId);
  await Promise.all(cleanData.players.map((player) => store.setJSON(`${prefix}${player.id}`, player)));
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

export async function createPlayerSessionForGame({ name, email, gameId = DEFAULT_GAME_ID }) {
  const id = normalizeGameId(gameId);
  const data = await getPlayersData(id);
  const normalizedEmail = normalizeEmail(email);
  const now = new Date().toISOString();
  let player = normalizedEmail ? data.players.find((item) => item.email === normalizedEmail) : null;

  if (!player) {
    player = {
      id: crypto.randomUUID(),
      gameId: id,
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
  player.gameId = id;
  const token = createPlayerToken(player);
  player.tokenHash = hashToken(token);
  player.lastSeenAt = now;
  await savePlayersData(data, id);

  return {
    token,
    player: publicPlayer(player),
  };
}

export async function createPlayerSession({ name, email }) {
  return createPlayerSessionForGame({ name, email, gameId: DEFAULT_GAME_ID });
}

async function getPlayerSession(event, gameId = DEFAULT_GAME_ID) {
  const token = getPlayerTokenFromEvent(event);

  if (!token) {
    return null;
  }

  const id = normalizeGameId(gameId);
  const data = await getPlayersData(id);
  const signedPlayer = readSignedToken(token);
  const tokenDigest = hashToken(token);
  let playerIndex = signedPlayer?.type === "player" && normalizeGameId(signedPlayer.gameId) === id
    ? data.players.findIndex((player) => player.id === signedPlayer.playerId)
    : -1;

  if (playerIndex < 0) {
    playerIndex = data.players.findIndex((player) => player.tokenHash === tokenDigest);
  }

  if (playerIndex < 0 && signedPlayer?.type === "player" && signedPlayer.playerId) {
    data.players.push({
      id: signedPlayer.playerId,
      gameId: id,
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

export async function recordChallengeAttempt(event, challengeId, correct, gameId = DEFAULT_GAME_ID) {
  const session = await getPlayerSession(event, gameId);

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
  await savePlayersData(session.data, gameId);

  return publicPlayer(session.player);
}

export async function recordFinalAttempt(event, correct, gameId = DEFAULT_GAME_ID) {
  const session = await getPlayerSession(event, gameId);

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
  await savePlayersData(session.data, gameId);

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
  const wrongAttempts = Object.values(player.challenges).reduce((total, stats) => {
    return total + (Number(stats.wrongAttempts) || 0);
  }, Number(player.final?.wrongAttempts) || 0);
  const finalSolvedAt = player.final?.solvedAt || "";
  const completed = Boolean(finalSolvedAt);
  const totalMs = completed
    ? msBetween(player.createdAt, finalSolvedAt)
    : msBetween(player.createdAt, player.lastSeenAt);
  const defaultQuestionPoints = Math.max(0, cleanNumber(config.roomConfig.questionPoints, 10));
  const defaultWrongAnswerPenalty = Math.max(0, cleanNumber(config.roomConfig.wrongAnswerPenalty, 1));
  const finalBonusPoints = Math.max(0, cleanNumber(config.roomConfig.finalBonusPoints, 50));
  const challengePoints = solvedChallenges.reduce((total, challenge) => {
    const stats = player.challenges[String(challenge.id)] ?? {};
    const maxPoints = Math.max(0, scoreNumber(challenge.points, defaultQuestionPoints));
    const penalty = Math.max(0, scoreNumber(challenge.wrongAnswerPenalty, defaultWrongAnswerPenalty));
    const wrongCount = Number(stats.wrongAttempts) || 0;

    return total + Math.max(0, maxPoints - wrongCount * penalty);
  }, 0);
  const points = challengePoints + (completed ? finalBonusPoints : 0);

  return {
    id: player.id,
    name: player.name,
    email: player.email,
    level: completed ? "ניצח" : String(solvedChallenges.length),
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

export async function getLeaderboard({ limit = 10, gameId = DEFAULT_GAME_ID } = {}) {
  const [playersData, config] = await Promise.all([getPlayersData(gameId), getGameConfig(gameId)]);

  return playersData.players.map((player) => summarizePlayer(player, config)).sort(sortLeaderboard).slice(0, limit);
}

export async function deletePlayers(ids, gameId = DEFAULT_GAME_ID) {
  const playerIds = new Set((Array.isArray(ids) ? ids : []).map((id) => cleanString(id)).filter(Boolean));

  if (!playerIds.size) {
    return getAnalytics(gameId);
  }

  const store = getStore(STORE_NAME);
  const legacyData = sanitizePlayersData(await store.get(getLegacyPlayersKey(gameId), { type: "json" }));
  await store.setJSON(getLegacyPlayersKey(gameId), {
    players: legacyData.players.filter((player) => !playerIds.has(player.id)),
  });
  const prefix = getPlayerPrefix(gameId);
  await Promise.all([...playerIds].map((id) => store.delete(`${prefix}${id}`)));

  return getAnalytics(gameId);
}

export async function resetPlayers(gameId = DEFAULT_GAME_ID) {
  const store = getStore(STORE_NAME);
  const legacyData = sanitizePlayersData(await store.get(getLegacyPlayersKey(gameId), { type: "json" }));
  const prefix = getPlayerPrefix(gameId);
  const { blobs } = await store.list({ prefix });

  await Promise.all([
    store.setJSON(getLegacyPlayersKey(gameId), { players: [] }),
    ...legacyData.players.map((player) => store.delete(`${prefix}${player.id}`)),
    ...blobs.map((blob) => store.delete(blob.key)),
  ]);

  return getAnalytics(gameId);
}

export async function getAnalytics(gameId = DEFAULT_GAME_ID) {
  const [playersData, config] = await Promise.all([getPlayersData(gameId), getGameConfig(gameId)]);
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
