import {
  getGameConfig,
  getGameIdFromEvent,
  getGlobalSettings,
  initBlobContext,
  jsonResponse,
  methodNotAllowed,
  readJsonBody,
  saveGameConfig,
  toPublicConfig,
  verifyAdminToken,
} from "./game-store.js";

const MAX_CONFIG_BODY_BYTES = 4_500_000;

export const handler = async (event) => {
  try {
    if (!["GET", "PUT"].includes(event.httpMethod)) {
      return methodNotAllowed();
    }

    if (!verifyAdminToken(event)) {
      return jsonResponse(401, { error: "unauthorized" });
    }

    initBlobContext(event);
    const gameId = getGameIdFromEvent(event);

    if (event.httpMethod === "GET") {
      const config = await getGameConfig(gameId);
      return jsonResponse(200, config);
    }

    if (Buffer.byteLength(event.body ?? "", event.isBase64Encoded ? "base64" : "utf8") > MAX_CONFIG_BODY_BYTES) {
      return jsonResponse(413, {
        error: "payload_too_large",
        message: "התמונה או ההגדרות גדולות מדי. העלו תמונה קטנה יותר או השתמשו בקישור לתמונה.",
      });
    }

    const body = readJsonBody(event);

    if (!body) {
      return jsonResponse(400, { error: "invalid_json" });
    }

    const [savedConfig, globalSettings] = await Promise.all([saveGameConfig(body, gameId), getGlobalSettings()]);

    return jsonResponse(200, {
      config: savedConfig,
      publicConfig: toPublicConfig(savedConfig, globalSettings),
    });
  } catch (error) {
    console.error("admin-config failed", error);
    return jsonResponse(500, { error: "admin_config_failed", message: "שמירת ההגדרות נכשלה בשרת." });
  }
};
