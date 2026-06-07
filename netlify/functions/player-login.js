import {
  createPlayerSessionForGame,
  getGameIdFromEvent,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
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
  const session = await createPlayerSessionForGame({
    name: body.name,
    email: body.email,
    gameId: getGameIdFromEvent(event, body),
  });

  return jsonResponse(200, session);
};
