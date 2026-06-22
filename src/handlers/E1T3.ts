import { Composer } from "grammy";
import { createRequire } from "node:module";
import type { StorageAdapter } from "grammy";
import type { Ctx } from "../bot.js";
import { MemorySessionStorage, RedisSessionStorage, menuKeyboard } from "../toolkit/index.js";
import type { RedisLike } from "../toolkit/session/redis.js";
import { type NominatimResult, fetchGeocode, buildButtons } from "../lib/nominatim.js";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface CachedGeocode {
  results: NominatimResult[];
  cachedAt: number;
}

function resolveCacheStorage(): StorageAdapter<CachedGeocode> {
  if (process.env.REDIS_URL) {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis: any = require("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    return new RedisSessionStorage<CachedGeocode>(client as RedisLike, "gc:");
  }
  return new MemorySessionStorage<CachedGeocode>();
}

const cacheStore = resolveCacheStorage();

function normalize(place: string): string {
  return place.toLowerCase().trim();
}

async function getCached(place: string): Promise<CachedGeocode | null> {
  const entry = await cacheStore.read(normalize(place));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > TTL_MS) {
    await cacheStore.delete(normalize(place));
    return null;
  }
  return entry;
}

async function setCache(place: string, results: NominatimResult[]): Promise<void> {
  await cacheStore.write(normalize(place), { results, cachedAt: Date.now() });
}

const composer = new Composer<Ctx>();

composer.command("geocode", async (ctx) => {
  const text = ctx.message?.text ?? "";
  const args = text.split(/\s+/).slice(1);
  const place = args.join(" ").trim();

  if (!place) {
    ctx.session.step = "awaiting_geocode_cached";
    await ctx.reply("What place would you like to geocode (with cache)?");
    return;
  }

  await geocodeAndReply(ctx, place);
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_geocode_cached") return next();

  const place = ctx.message.text.trim();
  ctx.session.step = undefined;

  await geocodeAndReply(ctx, place);
});

async function geocodeAndReply(ctx: Ctx, place: string): Promise<void> {
  const cached = await getCached(place);
  if (cached) {
    await ctx.reply(`(cached) Top matches for "${place}":`, {
      reply_markup: menuKeyboard(buildButtons(cached.results)),
    });
    return;
  }

  try {
    const results = await fetchGeocode(place);

    if (!results || results.length === 0) {
      await ctx.reply(`No places found for "${place}".`);
      return;
    }

    await setCache(place, results);

    await ctx.reply(`Top matches for "${place}":`, {
      reply_markup: menuKeyboard(buildButtons(results)),
    });
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Geocoding failed:")) {
      await ctx.reply(err.message);
    } else {
      await ctx.reply("Failed to reach the geocoding service. Please try again.");
    }
  }
}

export default composer;
