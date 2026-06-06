import {
  deletePlayers,
  getAnalytics,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
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
  if (event.httpMethod === "DELETE") {
    const body = readJsonBody(event);

    if (!body) {
      return jsonResponse(400, { error: "invalid_json" });
    }

    return jsonResponse(200, await deletePlayers(body.ids));
  }

  const analytics = await getAnalytics();

  return jsonResponse(200, analytics);
};
