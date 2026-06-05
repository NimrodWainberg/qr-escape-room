import { connectLambda, getStore } from "@netlify/blobs";
import crypto from "node:crypto";

const STORE_NAME = "qr-escape-room";
const CONFIG_KEY = "game-config-v1";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const defaultGameConfig = {
  roomConfig: {
    title: "חדר בריחה",
    subtitle: "",
    finalPrompt: "הקלידו את הקוד שנוצר מכל החלקים שאספתם בדרך.",
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

export function createAdminToken() {
  const now = Date.now();
  const payload = Buffer.from(JSON.stringify({ iat: now, exp: now + TOKEN_TTL_MS })).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(event) {
  const authorizationHeader = event.headers.authorization ?? event.headers.Authorization ?? "";
  const token = authorizationHeader.replace(/^Bearer\s+/i, "");
  const [payload, signature] = token.split(".");

  if (!payload || !signature || !getTokenSecret()) {
    return false;
  }

  if (!safeCompare(sign(payload), signature)) {
    return false;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return Number(data.exp) > Date.now();
  } catch {
    return false;
  }
}
