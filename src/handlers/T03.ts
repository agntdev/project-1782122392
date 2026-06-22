import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

const helpText = [
  "Available commands:",
  "/start - Welcome message",
  "/t01 - Bot skeleton verification",
  "/help - Show this help message",
].join("\n");

composer.command("help", async (ctx) => {
  await ctx.reply(helpText);
});

export default composer;