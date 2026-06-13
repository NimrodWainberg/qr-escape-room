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
const PRESERVE_IMAGE_VALUE = "__qr_escape_room_preserve_image__";

function resolvePreservedImages(nextConfig, savedConfig) {
  if (!nextConfig || !savedConfig) {
    return nextConfig;
  }

  return {
    ...nextConfig,
    roomConfig: {
      ...nextConfig.roomConfig,
      puzzleImageUrl:
        nextConfig.roomConfig?.puzzleImageUrl === PRESERVE_IMAGE_VALUE
          ? savedConfig.roomConfig?.puzzleImageUrl ?? ""
          : nextConfig.roomConfig?.puzzleImageUrl,
    },
    challenges: (nextConfig.challenges ?? []).map((challenge, index) => {
      const savedChallenge =
        savedConfig.challenges?.find((item) => String(item.id) === String(challenge.id)) ??
        savedConfig.challenges?.[index];

      return {
        ...challenge,
        questionImageUrl:
          challenge.questionImageUrl === PRESERVE_IMAGE_VALUE ? savedChallenge?.questionImageUrl ?? "" : challenge.questionImageUrl,
      };
    }),
  };
}

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

    const existingConfig = await getGameConfig(gameId);
    const configToSave = resolvePreservedImages(body, existingConfig);
    const [savedConfig, globalSettings] = await Promise.all([saveGameConfig(configToSave, gameId), getGlobalSettings()]);

    return jsonResponse(200, {
      config: savedConfig,
      publicConfig: toPublicConfig(savedConfig, globalSettings),
    });
  } catch (error) {
    console.error("admin-config failed", error);
    return jsonResponse(500, { error: "admin_config_failed", message: "שמירת ההגדרות נכשלה בשרת." });
  }
};
