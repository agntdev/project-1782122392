import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

export interface UserPreferences {
  defaultVisualization?: string;
  lastPlace?: string;
}

declare module "../bot.js" {
  interface Session {
    prefs?: UserPreferences;
  }
}

function getPrefs(ctx: Ctx): UserPreferences {
  return ctx.session.prefs ?? {};
}

function setPrefs(ctx: Ctx, updates: UserPreferences): void {
  const existing = ctx.session.prefs ?? {};
  ctx.session.prefs = { ...existing, ...updates };
}

function formatPrefs(prefs: UserPreferences): string {
  const viz = prefs.defaultVisualization ?? "(not set)";
  const place = prefs.lastPlace ?? "(not set)";
  return `Your preferences:\n- Default visualization: ${viz}\n- Last place: ${place}`;
}

const composer = new Composer<Ctx>();

composer.command("getprefs", async (ctx) => {
  if (!ctx.from?.id) {
    await ctx.reply("Could not identify your user account.");
    return;
  }
  await ctx.reply(formatPrefs(getPrefs(ctx)));
});

composer.command("setprefs", async (ctx) => {
  if (!ctx.from?.id) {
    await ctx.reply("Could not identify your user account.");
    return;
  }
  const text = ctx.message?.text ?? "";
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    await ctx.reply(
      "Usage: /setprefs <key> <value> [<key> <value> ...]\nKeys: defaultVisualization, lastPlace\nExample: /setprefs defaultVisualization chart lastPlace London",
    );
    return;
  }

  if (args.length % 2 !== 0) {
    await ctx.reply(
      "Each key must have a value. Use: /setprefs <key> <value> [<key> <value> ...]",
    );
    return;
  }

  const updates: UserPreferences = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i];
    const value = args[i + 1];
    if (key !== "defaultVisualization" && key !== "lastPlace") {
      await ctx.reply(
        `Unknown preference key "${key}". Valid keys: defaultVisualization, lastPlace`,
      );
      return;
    }
    (updates as Record<string, string>)[key] = value;
  }

  setPrefs(ctx, updates);
  await ctx.reply(formatPrefs(getPrefs(ctx)));
});

export default composer;