import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

declare module "../bot.js" {
  interface Session {
    cloudCover?: "auto" | "10" | "20" | "40";
  }
}

const composer = new Composer<Ctx>();

const CLOUD_KEYBOARD = inlineKeyboard([
  [
    inlineButton("Auto (20%)", "cc:auto"),
    inlineButton("10%", "cc:10"),
  ],
  [
    inlineButton("20%", "cc:20"),
    inlineButton("40%", "cc:40"),
  ],
]);

composer.command("cloudcover", async (ctx) => {
  await ctx.reply("Select cloud cover:", {
    reply_markup: CLOUD_KEYBOARD,
  });
});

composer.callbackQuery(/^cc:(auto|10|20|40)$/, async (ctx) => {
  const option = ctx.match[1] as "auto" | "10" | "20" | "40";
  await ctx.answerCallbackQuery();

  const labels: Record<"auto" | "10" | "20" | "40", string> = {
    auto: "Auto (20%)",
    "10": "10%",
    "20": "20%",
    "40": "40%",
  };

  ctx.session.cloudCover = option;
  await ctx.reply(`Cloud cover: ${labels[option]}`);
});

export default composer;