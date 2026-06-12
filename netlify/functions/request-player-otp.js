import {
  getGameIdFromEvent,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  requestPlayerOtp,
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
    const result = await requestPlayerOtp({
      name: body.name,
      email: body.email,
      gameId: getGameIdFromEvent(event, body),
    });

    if (!result.configured) {
      return jsonResponse(409, result);
    }

    return jsonResponse(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "otp_failed";

    if (message === "invalid_email") {
      return jsonResponse(400, { error: message });
    }

    if (["email_failed", "email_api_key_invalid", "email_sender_invalid"].includes(message)) {
      return jsonResponse(502, { error: message });
    }

    return jsonResponse(500, { error: message });
  }
};
