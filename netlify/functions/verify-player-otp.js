import {
  getGameIdFromEvent,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  verifyPlayerOtp,
} from "./game-store.js";

export const handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return methodNotAllowed();
  }

  const body = readJsonBody(event);

  if (!body) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  try {
    initBlobContext(event);
    const session = await verifyPlayerOtp({
      name: body.name,
      email: body.email,
      code: body.code,
      gameId: getGameIdFromEvent(event, body),
    });

    return jsonResponse(200, session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "otp_failed";

    if (["invalid_otp", "otp_expired", "otp_locked"].includes(message)) {
      return jsonResponse(401, { error: message });
    }

    return jsonResponse(500, { error: message });
  }
};
