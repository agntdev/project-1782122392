import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { menuKeyboard } from "../toolkit/index.js";

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

interface NominatimResult {
  place_id: number;
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

function truncate(name: string, max: number): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 3) + "...";
}

const composer = new Composer<Ctx>();

composer.command("whereis", async (ctx) => {
  ctx.session.step = "awaiting_geocode";
  await ctx.reply("What place would you like to geocode?");
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_geocode") return next();

  const place = ctx.message.text.trim();
  ctx.session.step = undefined;

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
});

composer.callbackQuery(/^geocode:(-?\d+\.?\d*):(-?\d+\.?\d*)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const lat = ctx.match[1];
  const lon = ctx.match[2];
  await ctx.reply(`Coordinates: ${lat}, ${lon}`);
});

export default composer;