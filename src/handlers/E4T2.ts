import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { fetchGeocode } from "../lib/nominatim.js";

const SENTINEL_HUB_TOKEN_URL = "https://services.sentinel-hub.com/oauth/token";
const SENTINEL_HUB_WMS_BASE = "https://services.sentinel-hub.com/ogc/wms";

interface TokenCache {
  access_token: string;
  expires_at: number;
}

let tokenCache: TokenCache | null = null;

async function getSentinelHubToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  if (tokenCache && tokenCache.expires_at > Date.now() + 60_000) {
    return tokenCache.access_token;
  }

  const response = await fetch(SENTINEL_HUB_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Sentinel Hub authentication failed (status ${response.status}).`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return tokenCache.access_token;
}

function resolveWmsLayer(
  compositeType?: string,
  compositeCustomName?: string,
  visOption?: string,
): string {
  if (visOption === "ndvi") return "NDVI-S2L2A";
  if (visOption === "false_color") return "FALSE-COLOR-URBAN-S2L2A";
  if (compositeType === "custom" && compositeCustomName) {
    const upper = compositeCustomName.toUpperCase();
    if (
      upper.includes("NDVI") ||
      upper.includes("VEGETATION") ||
      upper.includes("VEG")
    ) {
      return "NDVI-S2L2A";
    }
    if (
      upper.includes("FALSE") ||
      upper.includes("URBAN") ||
      upper.includes("NIR")
    ) {
      return "FALSE-COLOR-URBAN-S2L2A";
    }
  }
  return "TRUE-COLOR-S2L2A";
}

function resolveMaxCC(cloudCover?: string): number {
  if (cloudCover === "10") return 10;
  if (cloudCover === "20") return 20;
  if (cloudCover === "40") return 40;
  return 20;
}

function resolveTimeRange(
  dateRange?: Ctx["session"]["dateRange"],
): string {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  if (dateRange?.start && dateRange?.end) {
    return `${dateRange.start}/${dateRange.end}`;
  }
  if (dateRange?.type === "last_month") {
    const from = new Date(now);
    from.setMonth(from.getMonth() - 1);
    return `${fmt(from)}/${fmt(now)}`;
  }
  if (dateRange?.type === "last_year") {
    const from = new Date(now);
    from.setFullYear(from.getFullYear() - 1);
    return `${fmt(from)}/${fmt(now)}`;
  }
  const from = new Date(now);
  from.setMonth(from.getMonth() - 3);
  return `${fmt(from)}/${fmt(now)}`;
}

async function fetchPreviewPng(params: {
  instanceId: string;
  clientId: string;
  clientSecret: string;
  place: string;
  compositeType?: string;
  compositeCustomName?: string;
  visOption?: string;
  cloudCover?: string;
  dateRange?: Ctx["session"]["dateRange"];
}): Promise<Buffer> {
  const results = await fetchGeocode(params.place);
  if (!results || results.length === 0) {
    throw new Error(`Could not find coordinates for "${params.place}".`);
  }

  const lat = parseFloat(results[0].lat);
  const lon = parseFloat(results[0].lon);
  const bboxSize = 0.05;
  const bbox = `${lon - bboxSize},${lat - bboxSize},${lon + bboxSize},${lat + bboxSize}`;

  const token = await getSentinelHubToken(
    params.clientId,
    params.clientSecret,
  );

  const layer = resolveWmsLayer(
    params.compositeType,
    params.compositeCustomName,
    params.visOption,
  );
  const maxcc = resolveMaxCC(params.cloudCover);
  const timeRange = resolveTimeRange(params.dateRange);

  const url = new URL(`${SENTINEL_HUB_WMS_BASE}/${params.instanceId}`);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("LAYERS", layer);
  url.searchParams.set("CRS", "EPSG:4326");
  url.searchParams.set("BBOX", bbox);
  url.searchParams.set("WIDTH", "512");
  url.searchParams.set("HEIGHT", "512");
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TIME", timeRange);
  url.searchParams.set("MAXCC", String(maxcc));

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Sentinel Hub WMS request failed (status ${response.status}).`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("xml") || contentType.includes("text")) {
    const body = await response.text();
    throw new Error(`Sentinel Hub returned an error: ${body.slice(0, 200)}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

const composer = new Composer<Ctx>();

composer.command("preview", async (ctx) => {
  const place = ctx.session.place;
  if (!place) {
    await ctx.reply(
      "No search parameters configured. Use /search first.",
    );
    return;
  }

  const clientId = process.env.SENTINEL_HUB_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;
  const instanceId = process.env.SENTINEL_HUB_INSTANCE_ID;

  if (!clientId || !clientSecret || !instanceId) {
    await ctx.reply("Preview is not available right now.");
    return;
  }

  const dateRange = ctx.session.dateRange;
  const datesStr =
    dateRange?.start && dateRange?.end
      ? `${dateRange.start} – ${dateRange.end}`
      : dateRange?.type === "last_month"
        ? "Last month"
        : dateRange?.type === "last_year"
          ? "Last year"
          : "Not set";

  const compositeType = ctx.session.compositeType;
  const compositeCustomName = ctx.session.compositeCustomName;
  const compositeLabel = compositeCustomName || compositeType || "Not set";

  const cc = ctx.session.cloudCover;
  const cloudStr =
    cc === "auto"
      ? "Auto (20%)"
      : cc === "10"
        ? "10%"
        : cc === "20"
          ? "20%"
          : cc === "40"
            ? "40%"
            : "Auto (20%)";

  const caption = `Location: ${place}\nDates: ${datesStr}\nSensor: ${compositeLabel}\nCloud cover: ${cloudStr}`;

  try {
    const png = await fetchPreviewPng({
      instanceId,
      clientId,
      clientSecret,
      place,
      compositeType: ctx.session.compositeType,
      compositeCustomName: ctx.session.compositeCustomName,
      visOption: ctx.session.visOption,
      cloudCover: ctx.session.cloudCover,
      dateRange: ctx.session.dateRange,
    });

    await ctx.replyWithPhoto(new InputFile(png, "preview.png"), {
      caption,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    await ctx.reply(`Could not fetch preview: ${message}`);
  }
});

export default composer;
