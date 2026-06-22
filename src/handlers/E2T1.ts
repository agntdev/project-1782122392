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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(dateStr: string): boolean {
  if (!DATE_RE.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
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
    ctx.session.step = "awaiting_custom_range";
    await ctx.reply("Enter start and end dates (YYYY-MM-DD YYYY-MM-DD):");
    return;
  }

  const range = computeRange(option);
  ctx.session.dateRange = { type: option, start: range.start, end: range.end };
  await ctx.reply(`Date range set: ${range.start} to ${range.end}`);
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_custom_range") return next();

  const text = ctx.message.text.trim();
  const parts = text.split(/\s+/);
  if (parts.length !== 2) {
    await ctx.reply("Please enter two dates separated by a space: YYYY-MM-DD YYYY-MM-DD");
    return;
  }

  if (!DATE_RE.test(parts[0]) || !DATE_RE.test(parts[1])) {
    await ctx.reply("Invalid format. Use YYYY-MM-DD YYYY-MM-DD (e.g. 2024-01-01 2024-06-30)");
    return;
  }

  if (!isValidDate(parts[0]) || !isValidDate(parts[1])) {
    await ctx.reply("Invalid calendar date. Please enter real dates (e.g. 2024-01-01 2024-06-30):");
    return;
  }

  ctx.session.dateRange = { type: "custom", start: parts[0], end: parts[1] };
  ctx.session.step = undefined;
  await ctx.reply(`Date range set: ${parts[0]} to ${parts[1]}`);
});

export default composer;
