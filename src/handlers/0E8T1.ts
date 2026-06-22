import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

composer.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    if (ADMIN_CHAT_ID) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      const chatId = ctx.chat?.id;
      const updateId = ctx.update.update_id;

      let notification = `Bot Error\n`;
      notification += `Message: ${errorMsg}\n`;
      if (stack) {
        notification += `Stack: ${stack.slice(0, 500)}\n`;
      }
      notification += `Chat: ${chatId ?? "unknown"}\n`;
      notification += `Update: ${updateId}`;

      await ctx.api.sendMessage(ADMIN_CHAT_ID, notification).catch(() => {});
    }
    throw err;
  }
});

export default composer;