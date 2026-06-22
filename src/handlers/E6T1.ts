import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  getSharedRedisClient,
  MemorySessionStorage,
  RedisSessionStorage,
} from "../toolkit/index.js";

export interface UserPreferences {
  defaultVisualization?: string;
  lastPlace?: string;
}

function resolvePrefsStorage() {
  if (process.env.REDIS_URL) {
    const client = getSharedRedisClient(process.env.REDIS_URL);
    return new RedisSessionStorage<UserPreferences>(client, "prefs:");
  }
  return new MemorySessionStorage<UserPreferences>();
}

const prefsStore = resolvePrefsStorage();

export async function getPrefs(userId: number): Promise<UserPreferences> {
  return (await prefsStore.read(String(userId))) ?? {};
}

export async function setPrefs(
  userId: number,
  prefs: UserPreferences,
): Promise<void> {
  await prefsStore.update(String(userId), (existing) => ({
    ...(existing ?? {}),
    ...prefs,
  }));
}

function formatPrefs(prefs: UserPreferences): string {
  const viz = prefs.defaultVisualization ?? "(not set)";
  const place = prefs.lastPlace ?? "(not set)";
  return `Your preferences:\n- Default visualization: ${viz}\n- Last place: ${place}`;
}

const composer = new Composer<Ctx>();

composer.command("getprefs", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not identify your user account.");
    return;
  }
  const prefs = await getPrefs(userId);
  await ctx.reply(formatPrefs(prefs));
});

composer.command("setprefs", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
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

  await setPrefs(userId, updates);
  await ctx.reply(formatPrefs(await getPrefs(userId)));
});

export default composer;