import { getGameIdFromEvent, getLeaderboard, initBlobContext, jsonResponse, methodNotAllowed } from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return methodNotAllowed();
  }

  initBlobContext(event);
  const leaderboard = await getLeaderboard({ limit: 20, gameId: getGameIdFromEvent(event) });

  return jsonResponse(200, { leaderboard });
};
