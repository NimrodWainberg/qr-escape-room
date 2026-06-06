import {
  getGameConfig,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  normalizeCode,
  recordChallengeAttempt,
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
  const challenge = config.challenges.find((item) => item.id === Number(body.id));

  if (!challenge) {
    return jsonResponse(404, { error: "challenge_not_found" });
  }

  const correct = normalizeCode(body.answer) === normalizeCode(challenge.answer);
  const player = await recordChallengeAttempt(event, challenge.id, correct);

  return jsonResponse(200, {
    correct,
    reward: correct ? challenge.reward : undefined,
    player,
  });
};
