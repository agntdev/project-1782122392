import { Composer } from "grammy";
import { createRequire } from "node:module";
import type { StorageAdapter } from "grammy";
import type { Ctx } from "../bot.js";
import { MemorySessionStorage, RedisSessionStorage, menuKeyboard } from "../toolkit/index.js";
import type { RedisLike } from "../toolkit/session/redis.js";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface NominatimResult {
  place_id: number;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

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

function truncate(name: string, max: number): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 3) + "...";
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
    const top = cached.results.slice(0, 3);
    const buttons = top.map((r) => ({
      text: truncate(r.display_name, 50),
      data: `geocode:${r.lat}:${r.lon}`,
    }));
    await ctx.reply(`(cached) Top matches for "${place}":`, {
      reply_markup: menuKeyboard(buttons),
    });
    return;
  }

  const url = new URL(NOMINATIM_BASE);
  url.searchParams.set("q", place);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "3");
  url.searchParams.set("addressdetails", "0");

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "AGNTDEV-Bot/1.0" },
    });

    if (!response.ok) {
      await ctx.reply(
        `Geocoding failed: Nominatim returned status ${response.status}.`,
      );
      return;
    }

    const results = (await response.json()) as NominatimResult[];

    if (!results || results.length === 0) {
      await ctx.reply(`No places found for "${place}".`);
      return;
    }

    await setCache(place, results);

    const top = results.slice(0, 3);
    const buttons = top.map((r) => ({
      text: truncate(r.display_name, 50),
      data: `geocode:${r.lat}:${r.lon}`,
    }));

    await ctx.reply(`Top matches for "${place}":`, {
      reply_markup: menuKeyboard(buttons),
    });
  } catch (_err) {
    await ctx.reply("Failed to reach the geocoding service. Please try again.");
  }
}

export default composer;
