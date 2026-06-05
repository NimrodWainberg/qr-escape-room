import {
  getGameConfig,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  saveGameConfig,
  toPublicConfig,
  verifyAdminToken,
} from "./game-store.js";

export const handler = async (event) => {
  if (!["GET", "PUT"].includes(event.httpMethod)) {
    return methodNotAllowed();
  }

  if (!verifyAdminToken(event)) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  initBlobContext(event);

  if (event.httpMethod === "GET") {
    const config = await getGameConfig();
    return jsonResponse(200, config);
  }

  const body = readJsonBody(event);

  if (!body) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const savedConfig = await saveGameConfig(body);

  return jsonResponse(200, {
    config: savedConfig,
    publicConfig: toPublicConfig(savedConfig),
  });
};
