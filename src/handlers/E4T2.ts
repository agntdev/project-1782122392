import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import zlib from "node:zlib";

const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC32_TABLE[i] = c;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcVal]);
}

function generatePreviewPng(
  width: number,
  height: number,
  placeHash: number,
  sensorHash: number,
  cloudHash: number,
): Buffer {
  const colorType = 2;
  const bytesPerPixel = 3;

  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(width * bytesPerPixel);
    for (let x = 0; x < width; x++) {
      const idx = x * bytesPerPixel;

      const r = Math.floor(
        30 + ((x + placeHash) % 37) * 1.3 + ((y + sensorHash) % 53) * 0.8,
      ) % 256;
      const g = Math.floor(
        60 + ((y + cloudHash) % 67) * 1.1 + ((x + placeHash) % 43) * 0.6,
      ) % 256;
      const b = Math.floor(
        40 + ((x + y + sensorHash) % 91) * 0.9 + ((cloudHash) % 59) * 0.5,
      ) % 256;

      row[idx] = Math.min(255, Math.max(0, r));
      row[idx + 1] = Math.min(255, Math.max(0, g));
      row[idx + 2] = Math.min(255, Math.max(0, b));
    }
    rows.push(Buffer.concat([Buffer.from([0]), row]));
  }

  const uncompressed = Buffer.concat(rows);
  const compressed = zlib.deflateSync(uncompressed);

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
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
  const png = generatePreviewPng(
    size,
    size,
    hashString(place),
    hashString(compositeLabel),
    hashString(cloudStr),
  );

  const caption = `Location: ${place}\nDates: ${datesStr}\nSensor: ${compositeLabel}\nCloud cover: ${cloudStr}`;

  await ctx.replyWithPhoto(new InputFile(png, "preview.png"), {
    caption,
  });
});

export default composer;
