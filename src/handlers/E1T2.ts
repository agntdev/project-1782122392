import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { menuKeyboard } from "../toolkit/index.js";
import { fetchGeocode, buildButtons } from "../lib/nominatim.js";

const composer = new Composer<Ctx>();

composer.command("whereis", async (ctx) => {
  ctx.session.step = "awaiting_geocode";
  await ctx.reply("What place would you like to geocode?");
});

composer.on("message:text", async (ctx, next) => {
  if (ctx.session.step !== "awaiting_geocode") return next();

  const place = ctx.message.text.trim();
  ctx.session.step = undefined;

  try {
    const results = await fetchGeocode(place);

    if (!results || results.length === 0) {
      await ctx.reply(`No places found for "${place}".`);
      return;
    }

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
});

export default composer;