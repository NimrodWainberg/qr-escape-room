import {
  getGameConfig,
  getGameIdFromEvent,
  getGlobalSettings,
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
  const [config, globalSettings] = await Promise.all([getGameConfig(gameId), getGlobalSettings()]);

  return jsonResponse(200, { ...toPublicConfig(config, globalSettings), gameId });
};
