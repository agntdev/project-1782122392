import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

declare module "../bot.js" {
  interface Session {
    visOption?: "true_color" | "false_color" | "ndvi";
  }
}

const composer = new Composer<Ctx>();

const VIS_KEYBOARD = inlineKeyboard([
  [
    inlineButton("True color (RGB)", "vis:true_color"),
    inlineButton("False color (NIR/Red/Green)", "vis:false_color"),
  ],
  [inlineButton("NDVI", "vis:ndvi")],
]);

composer.command("visualization", async (ctx) => {
  await ctx.reply("Select a visualization:", {
    reply_markup: VIS_KEYBOARD,
  });
});

composer.callbackQuery(/^vis:(true_color|false_color|ndvi)$/, async (ctx) => {
  const option = ctx.match[1] as "true_color" | "false_color" | "ndvi";
  await ctx.answerCallbackQuery();

  const labels: Record<"true_color" | "false_color" | "ndvi", string> = {
    true_color: "True color (RGB)",
    false_color: "False color (NIR/Red/Green)",
    ndvi: "NDVI",
  };

  ctx.session.visOption = option;
  await ctx.reply(`Visualization: ${labels[option]}`);
});

export default composer;