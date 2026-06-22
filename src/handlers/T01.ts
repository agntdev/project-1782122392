import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

composer.command("t01", async (ctx) => {
  await ctx.reply("T01: Bot skeleton verified.");
});

export default composer;
