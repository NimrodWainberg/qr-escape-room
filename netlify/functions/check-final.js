import {
  getGameConfig,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  normalizeCode,
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
  const config = await getGameConfig();
  const correct = normalizeCode(body.code) === normalizeCode(config.roomConfig.finalCode);

  return jsonResponse(200, { correct });
};
