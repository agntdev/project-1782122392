import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("search", async (ctx) => {
  ctx.session.step = "awaiting_place";
  await ctx.reply("What place would you like to search for?");
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_place") return next();
  const place = ctx.message.text.trim();
  ctx.session.place = place;
  ctx.session.step = undefined;
  await ctx.reply(`Place saved: ${place}`);
});

export default composer;
