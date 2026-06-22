import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineKeyboard, inlineButton } from "../toolkit/index.js";

const composer = new Composer<Ctx>();

const COMPOSITE_KEYBOARD = inlineKeyboard([
  [
    inlineButton("Median composite", "comp:median"),
    inlineButton("Most recent", "comp:most_recent"),
  ],
  [inlineButton("Custom", "comp:custom")],
]);

composer.command("composite", async (ctx) => {
  await ctx.reply("Select a composite type:", {
    reply_markup: COMPOSITE_KEYBOARD,
  });
});

composer.callbackQuery(/^comp:(median|most_recent)$/, async (ctx) => {
  const option = ctx.match[1] as "median" | "most_recent";
  await ctx.answerCallbackQuery();

  const labels: Record<"median" | "most_recent", string> = {
    median: "Median composite",
    most_recent: "Most recent",
  };

  ctx.session.compositeType = option;
  ctx.session.compositeCustomName = undefined;
  ctx.session.step = undefined;
  await ctx.reply(`Composite type: ${labels[option]}`);
});

composer.callbackQuery("comp:custom", async (ctx) => {
  await ctx.answerCallbackQuery();
  ctx.session.compositeType = "custom";
  ctx.session.compositeCustomName = undefined;
  ctx.session.step = "awaiting_composite_custom";
  await ctx.reply("Enter your custom composite type:");
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_composite_custom") return next();

  const name = ctx.message.text.trim();
  if (!name) {
    await ctx.reply("Please enter a value for the custom composite type:");
    return;
  }

  ctx.session.compositeType = "custom";
  ctx.session.compositeCustomName = name;
  ctx.session.step = undefined;
  await ctx.reply(`Composite type: Custom — ${name}`);
});

export default composer;