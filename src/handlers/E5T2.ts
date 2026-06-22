import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

const FALLBACK_MESSAGE = "An unexpected error occurred. Please try again or use /help for assistance.";

composer.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error("[E5T2] Unhandled error in downstream handler:", err);
    try {
      await ctx.reply(FALLBACK_MESSAGE);
    } catch (replyErr) {
      console.error("[E5T2] Failed to send fallback message:", replyErr);
    }
  }
});

export default composer;
