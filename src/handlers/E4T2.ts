import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";

interface GeoCoords {
  lat: number;
  lon: number;
  west: number;
  south: number;
  east: number;
  north: number;
}

async function geocodePlace(place: string): Promise<GeoCoords | null> {
  const apiKey = process.env.GEOCODE_API_KEY;
  let url: string;
  let headers: Record<string, string> = {};

  if (apiKey) {
    url = `https://geocode.maps.co/search?q=${encodeURIComponent(place)}&api_key=${apiKey}`;
  } else {
    url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(place)}&format=json&limit=1&bounded=1`;
    headers["User-Agent"] = "AGNTDEV-Bot/1.0";
  }

  try {
    const response = await fetch(url, { headers });
    if (!response.ok) return null;
    const data = (await response.json()) as Record<string, unknown>[];
    if (!data.length) return null;
    const r = data[0];
    let west: number, south: number, east: number, north: number;
    if (r.boundingbox && Array.isArray(r.boundingbox) && r.boundingbox.length >= 4) {
      const bbox = r.boundingbox as string[];
      south = parseFloat(bbox[0]);
      north = parseFloat(bbox[1]);
      west = parseFloat(bbox[2]);
      east = parseFloat(bbox[3]);
    } else {
      const lat = parseFloat(String(r.lat));
      const lon = parseFloat(String(r.lon));
      const pad = 0.05;
      west = lon - pad;
      south = lat - pad;
      east = lon + pad;
      north = lat + pad;
    }
    return {
      lat: parseFloat(String(r.lat)),
      lon: parseFloat(String(r.lon)),
      west,
      south,
      east,
      north,
    };
  } catch {
    return null;
  }
}

function lonLatToTile(
  lon: number,
  lat: number,
  zoom: number,
): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { x, y };
}

async function fetchNASAGibsTile(
  lat: number,
  lon: number,
): Promise<Buffer | null> {
  const zoom = 6;
  const { x, y } = lonLatToTile(lon, lat, zoom);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "-");
  const today = new Date();
  const oneWeekAgo = new Date(today.getTime() - 7 * 86400000);
  const date = oneWeekAgo.toISOString().slice(0, 10);

  const template = process.env.NASA_GIBS_TEMPLATE ??
    "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/{date}/GoogleMapsCompatible_Level{zoom}/{y}/{x}.jpg";

  const url = template
    .replace("{date}", date)
    .replace(/\{zoom\}/g, String(zoom))
    .replace(/\{y\}/g, String(y))
    .replace(/\{x\}/g, String(x));

  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function fetchSentinelHubPreview(
  coords: GeoCoords,
  width: number,
  height: number,
  composite: string,
  cloudCover: string,
): Promise<Buffer | null> {
  const instanceId = process.env.SENTINEL_HUB_INSTANCE_ID;
  const clientId = process.env.SENTINEL_HUB_CLIENT_ID;
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET;
  if (!instanceId && !(clientId && clientSecret)) return null;

  const bbox = `${coords.west},${coords.south},${coords.east},${coords.north}`;

  let layer: string;
  if (composite === "custom" || composite === "median") {
    layer = "TRUE-COLOR";
  } else if (composite === "most_recent") {
    layer = "TRUE-COLOR";
  } else {
    layer = "TRUE-COLOR";
  }

  const maxCC = cloudCover === "auto" || cloudCover === "20"
    ? 20
    : parseInt(cloudCover, 10) || 20;

  let requestUrl: string;
  let authHeaders: Record<string, string> = {};

  if (clientId && clientSecret) {
    const tokenUrl = "https://services.sentinel-hub.com/oauth/token";
    try {
      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });
      if (!tokenResponse.ok) return null;
      const tokenData = (await tokenResponse.json()) as { access_token: string };
      authHeaders["Authorization"] = `Bearer ${tokenData.access_token}`;
      requestUrl = `https://services.sentinel-hub.com/ogc/wms/${instanceId || "default"}`;
    } catch {
      return null;
    }
  } else {
    requestUrl = `https://services.sentinel-hub.com/ogc/wms/${instanceId}`;
  }

  const params = new URLSearchParams({
    REQUEST: "GetMap",
    CRS: "EPSG:4326",
    BBOX: bbox,
    WIDTH: String(width),
    HEIGHT: String(height),
    LAYERS: layer,
    FORMAT: "image/jpeg",
    MAXCC: String(maxCC),
  });

  try {
    const response = await fetch(`${requestUrl}?${params.toString()}`, {
      headers: authHeaders,
    });
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

async function fetchSatellitePreview(
  place: string,
  width: number,
  height: number,
  composite: string,
  cloudCover: string,
): Promise<Buffer | null> {
  const coords = await geocodePlace(place);
  if (!coords) return null;

  const sentinelImage = await fetchSentinelHubPreview(
    coords, width, height, composite, cloudCover,
  );
  if (sentinelImage) return sentinelImage;

  return fetchNASAGibsTile(coords.lat, coords.lon);
}

const MAX_DIM = 1024;
const DEFAULT_SIZE = 512;

const composer = new Composer<Ctx>();

composer.command("preview", async (ctx) => {
  const place = ctx.session.place;
  if (!place) {
    await ctx.reply(
      "No search parameters configured. Use /search first.",
    );
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

  const size = Math.min(MAX_DIM, DEFAULT_SIZE);
  const caption = `Location: ${place}\nDates: ${datesStr}\nSensor: ${compositeLabel}\nCloud cover: ${cloudStr}`;

  const image = await fetchSatellitePreview(
    place, size, size, compositeLabel, cloudStr,
  );

  if (image) {
    await ctx.replyWithPhoto(new InputFile(image, "preview.jpg"), {
      caption,
    });
  } else {
    await ctx.reply(
      "Preview images are not available right now. Please try again later.",
    );
  }
});

export default composer;
