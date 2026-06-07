import {
  createGame,
  deleteGame,
  initBlobContext,
  jsonResponse,
  listGames,
  methodNotAllowed,
  readJsonBody,
  verifyAdminToken,
} from "./game-store.js";

export const handler = async (event) => {
  if (!["GET", "POST", "DELETE"].includes(event.httpMethod)) {
    return methodNotAllowed();
  }

  const admin = verifyAdminToken(event);

  if (!admin) {
    return jsonResponse(401, { error: "unauthorized" });
  }

  initBlobContext(event);

  if (event.httpMethod === "GET") {
    return jsonResponse(200, await listGames());
  }

  const body = readJsonBody(event);

  if (!body) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  try {
    if (event.httpMethod === "POST") {
      const created = await createGame({
        id: body.id,
        title: body.title,
        sourceGameId: body.sourceGameId,
      });

      return jsonResponse(200, created);
    }

    return jsonResponse(200, await deleteGame(body.id ?? body.gameId));
  } catch (error) {
    return jsonResponse(400, { error: error instanceof Error ? error.message : "game_action_failed" });
  }
};
