import {
  deletePlayers,
  getAnalytics,
  getGameIdFromEvent,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  resetPlayers,
  verifyAdminToken,
} from "./game-store.js";

export const handler = async (event) => {
  if (!["GET", "DELETE"].includes(event.httpMethod)) {
    return methodNotAllowed();
  }

  if (!verifyAdminToken(event)) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  initBlobContext(event);
  const body = event.httpMethod === "DELETE" ? readJsonBody(event) : {};
  const gameId = getGameIdFromEvent(event, body);

  if (event.httpMethod === "DELETE") {
    if (!body) {
      return jsonResponse(400, { error: "invalid_json" });
    }

    if (body.reset) {
      return jsonResponse(200, await resetPlayers(gameId));
    }

    return jsonResponse(200, await deletePlayers(body.ids, gameId));
  }

  const analytics = await getAnalytics(gameId);

  return jsonResponse(200, analytics);
};
