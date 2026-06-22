import { Composer } from "grammy";
import type { Ctx } from "../bot.js";

const composer = new Composer<Ctx>();

function buildStatus(ctx: Ctx): string {
  const parts: string[] = ["Status:"];

  const place = ctx.session.place;
  parts.push(
    place
      ? `Location: ${place}`
      : "Location: Not configured — use /search",
  );

  const dateRange = ctx.session.dateRange;
  if (dateRange?.start && dateRange?.end) {
    parts.push(`Date range: ${dateRange.start} to ${dateRange.end}`);
  } else if (dateRange?.type === "last_month") {
    parts.push("Date range: Last month");
  } else if (dateRange?.type === "last_year") {
    parts.push("Date range: Last year");
  } else {
    parts.push("Date range: Not configured — use /daterange");
  }

  const compositeType = ctx.session.compositeType;
  const compositeCustomName = ctx.session.compositeCustomName;
  if (compositeType && compositeType !== "custom") {
    const labels: Record<string, string> = {
      median: "Median composite",
      most_recent: "Most recent",
    };
    parts.push(`Composite: ${labels[compositeType] ?? compositeType}`);
  } else if (compositeType === "custom" && compositeCustomName) {
    parts.push(`Composite: Custom — ${compositeCustomName}`);
  } else {
    parts.push("Composite: Not configured — use /composite");
  }

  parts.push(
    ctx.session.visOption
      ? `Visualization: ${ctx.session.visOption === "true_color" ? "True color (RGB)" : ctx.session.visOption === "false_color" ? "False color (NIR/Red/Green)" : "NDVI"}`
      : "Visualization: Not configured — use /visualization",
  );

  parts.push(
    ctx.session.cloudCover
      ? `Cloud cover: ${ctx.session.cloudCover === "auto" ? "Auto (20%)" : ctx.session.cloudCover + "%"}`
      : "Cloud cover: Not configured — use /cloudcover",
  );

  const hasPlace = !!place;
  const hasDateRange = !!dateRange;
  const hasComposite = !!compositeType;
  const hasVis = !!ctx.session.visOption;
  const hasCloud = !!ctx.session.cloudCover;

  if (hasPlace && hasDateRange && hasComposite && hasVis && hasCloud) {
    parts.push("\nAll parameters are set. Run /preview to see a preview or /download to download your GeoTIFF.");
    return parts.join("\n");
  }

  const missing: string[] = [];
  if (!hasPlace) missing.push("/search to set your target location");
  if (!hasDateRange) missing.push("/daterange to set the date range");
  if (!hasComposite) missing.push("/composite to choose a composite type");
  if (!hasVis) missing.push("/visualization to select a visualization");
  if (!hasCloud) missing.push("/cloudcover to set cloud cover percentage");

  if (missing.length > 0) {
    parts.push(
      `\nMissing: ${missing.join(", ")}. Run these commands to adjust your query.`,
    );
  }

  return parts.join("\n");
}

composer.command("status", async (ctx) => {
  await ctx.reply(buildStatus(ctx));
});

composer.callbackQuery("menu:status", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.reply(buildStatus(ctx));
});

export default composer;