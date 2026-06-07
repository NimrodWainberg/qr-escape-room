import {
  getGameIdFromEvent,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  verifyGamePassword,
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
  const unlocked = await verifyGamePassword(gameId, body.password);

  return jsonResponse(unlocked ? 200 : 401, { unlocked });
};
