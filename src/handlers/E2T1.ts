import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const RANGE_KEYBOARD = inlineKeyboard([
  [
    inlineButton("Last month", "dr:last_month"),
    inlineButton("Last year", "dr:last_year"),
  ],
  [inlineButton("Custom range", "dr:custom")],
]);

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeRange(type: "last_month" | "last_year"): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  if (type === "last_month") {
    start.setMonth(start.getMonth() - 1);
  } else {
    start.setFullYear(start.getFullYear() - 1);
  }
  return { start: formatDate(start), end: formatDate(end) };
}

composer.command("daterange", async (ctx) => {
  await ctx.reply("Select a date range:", {
    reply_markup: RANGE_KEYBOARD,
  });
});

composer.callbackQuery(/^dr:(last_month|last_year|custom)$/, async (ctx) => {
  const option = ctx.match[1] as "last_month" | "last_year" | "custom";
  await ctx.answerCallbackQuery();

  if (option === "custom") {
    ctx.session.dateRange = { type: "custom" };
    ctx.session.customDateStep = "awaiting_start";
    await ctx.reply("Enter the start date (YYYY-MM-DD):");
    return;
  }

  const range = computeRange(option);
  ctx.session.dateRange = { type: option, start: range.start, end: range.end };
  await ctx.reply(`Date range set: ${range.start} to ${range.end}`);
});

export default composer;
