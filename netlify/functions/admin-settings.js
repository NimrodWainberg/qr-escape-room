import {
  getGlobalSettings,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  saveGlobalSettings,
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
    return jsonResponse(200, await getGlobalSettings());
  }

  const body = readJsonBody(event);

  if (!body) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  return jsonResponse(200, await saveGlobalSettings(body));
};
