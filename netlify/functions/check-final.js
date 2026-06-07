import {
  getGameConfig,
  getGameIdFromEvent,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  normalizeCode,
  recordFinalAttempt,
  readJsonBody,
} from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  const body = readJsonBody(event);

  if (!body) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  initBlobContext(event);
  const gameId = getGameIdFromEvent(event, body);
  const config = await getGameConfig(gameId);
  const correct = normalizeCode(body.code) === normalizeCode(config.roomConfig.finalCode);
  const player = await recordFinalAttempt(event, correct, gameId);

  return jsonResponse(200, { correct, player });
};
