import { initBlobContext, jsonResponse, listGames, methodNotAllowed } from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed();
  }

  initBlobContext(event);
  return jsonResponse(200, await listGames());
};
