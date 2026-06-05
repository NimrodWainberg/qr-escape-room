import { getGameConfig, initBlobContext, jsonResponse, methodNotAllowed, toPublicConfig } from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed();
  }

  initBlobContext(event);
  const config = await getGameConfig();

  return jsonResponse(200, toPublicConfig(config));
};
