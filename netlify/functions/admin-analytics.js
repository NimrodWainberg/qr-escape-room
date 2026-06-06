import { getAnalytics, initBlobContext, jsonResponse, methodNotAllowed, verifyAdminToken } from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed();
  }

  if (!verifyAdminToken(event)) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  initBlobContext(event);
  const analytics = await getAnalytics();

  return jsonResponse(200, analytics);
};
