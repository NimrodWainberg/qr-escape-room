import {
  getGameConfig,
  getGameIdFromEvent,
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
  const gameId = getGameIdFromEvent(event, body);
  const config = await getGameConfig(gameId);
  const challenge = config.challenges.find((item) => item.id === Number(body.id));

  if (!challenge) {
    return jsonResponse(404, { error: "challenge_not_found" });
  }

  const correct = isChallengeAnswerCorrect(challenge, body);
  const player = await recordChallengeAttempt(event, challenge.id, correct, gameId);

  return jsonResponse(200, {
    correct,
    reward: correct ? challenge.reward : undefined,
    player,
  });
};

function isChallengeAnswerCorrect(challenge, body) {
  if (challenge.answerType === "choice") {
    const selectedId = String(body.choiceId ?? "");
    return challenge.choiceOptions.some((option) => option.correct && option.id === selectedId);
  }

  if (challenge.answerFields.length > 0) {
    const answers = Array.isArray(body.answers) ? body.answers : [];
    return challenge.answerFields.every((field, index) => normalizeCode(answers[index]) === normalizeCode(field.answer));
  }

  return normalizeCode(body.answer) === normalizeCode(challenge.answer);
}
