import {
  createAdminUser,
  deleteAdminUser,
  initBlobContext,
  jsonResponse,
  listPublicAdminUsers,
  methodNotAllowed,
  readJsonBody,
  verifyAdminToken,
} from "./game-store.js";

export const handler = async (event) => {
  if (!["GET", "POST", "DELETE"].includes(event.httpMethod)) {
    return methodNotAllowed();
  }

  const admin = verifyAdminToken(event);

  if (!admin || admin.role !== "master") {
    return jsonResponse(401, { error: "master_required" });
  }

  initBlobContext(event);

  if (event.httpMethod === "GET") {
    return jsonResponse(200, { users: await listPublicAdminUsers() });
  }

  const body = readJsonBody(event);

  if (!body) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  if (event.httpMethod === "POST") {
    try {
      const created = await createAdminUser({ email: body.email, name: body.name });
      return jsonResponse(200, created);
    } catch (error) {
      return jsonResponse(400, { error: error.message });
    }
  }

  return jsonResponse(200, { users: await deleteAdminUser(body.id) });
};
