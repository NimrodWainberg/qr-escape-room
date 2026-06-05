import { createAdminToken, jsonResponse, methodNotAllowed, readJsonBody } from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  const body = readJsonBody(event);

  if (!body) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPassword || !process.env.ADMIN_TOKEN_SECRET) {
    return jsonResponse(500, { error: "admin_is_not_configured" });
  }

  if (String(body.password ?? "") !== expectedPassword) {
    return jsonResponse(401, { error: "invalid_password" });
  }

  return jsonResponse(200, { token: createAdminToken() });
};
