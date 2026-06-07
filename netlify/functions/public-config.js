import {
  getGameConfig,
  getGameIdFromEvent,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  toPublicConfig,
} from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed();
  }

  initBlobContext(event);
  const gameId = getGameIdFromEvent(event);
  const config = await getGameConfig(gameId);

  return jsonResponse(200, { ...toPublicConfig(config), gameId });
};
