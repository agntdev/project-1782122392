import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

declare module "../bot.js" {
  interface Session {
    customDateStep?: "awaiting_start" | "awaiting_end";
  }
}

const composer = new Composer<Ctx>();

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

composer.command("customrange", async (ctx) => {
  ctx.session.customDateStep = "awaiting_start";
  await ctx.reply("Enter the start date (YYYY-MM-DD):");
});

composer.on("message:text", async (ctx, next) => {
  const step = ctx.session.customDateStep;
  if (!step) return next();

  const text = ctx.message.text.trim();

  if (step === "awaiting_start") {
    if (!isValidDate(text)) {
      await ctx.reply("Invalid date. Enter the start date as YYYY-MM-DD (e.g. 2024-01-15):");
      return;
    }
    ctx.session.dateRange = { type: "custom", start: text };
    ctx.session.customDateStep = "awaiting_end";
    await ctx.reply("Enter the end date (YYYY-MM-DD):");
    return;
  }

  if (step === "awaiting_end") {
    const start = ctx.session.dateRange?.start;
    if (!start) {
      ctx.session.customDateStep = undefined;
      await ctx.reply("Session expired. Please use /customrange to start over.");
      return;
    }
    if (!isValidDate(text)) {
      await ctx.reply("Invalid date. Enter the end date as YYYY-MM-DD (e.g. 2024-06-30):");
      return;
    }
    if (text < start) {
      await ctx.reply("End date must be on or after the start date. Please enter a valid end date:");
      return;
    }
    ctx.session.dateRange = { type: "custom", start, end: text };
    ctx.session.customDateStep = undefined;
    await ctx.reply(`Date range set: ${start} to ${text}`);
    return;
  }
});

export default composer;
