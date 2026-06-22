import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { createHmac, createHash } from "node:crypto";
import { urlButton, inlineKeyboard } from "../toolkit/index.js";

function sha256(data: string | Buffer): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function hmacSha256Raw(key: Buffer, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function signV4(
  method: string,
  bucket: string,
  region: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  payloadHash: string,
  extraHeaders: Record<string, string> = {},
): { canonicalUri: string; host: string; headers: Record<string, string> } {
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const segments = key.split("/");
  const canonicalUri = "/" + segments.map((s) => encodeURIComponent(s)).join("/");

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  const signedHeaders = ["host", ...Object.keys(extraHeaders).map((h) => h.toLowerCase())].sort();

  const canonicalHeaders =
    signedHeaders
      .map((h) => {
        if (h === "host") return `host:${host}`;
        return `${h}:${extraHeaders[h] ?? extraHeaders[h.toLowerCase()] ?? ""}`;
      })
      .join("\n") + "\n";

  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders.join(";"),
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256Raw(Buffer.from(`AWS4${secretAccessKey}`, "utf-8"), dateStamp);
  const kRegion = hmacSha256Raw(kDate, region);
  const kService = hmacSha256Raw(kRegion, "s3");
  const kSigning = hmacSha256Raw(kService, "aws4_request");
  const signature = hmacSha256Raw(kSigning, stringToSign).toString("hex");

  const authHeader =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;

  return {
    canonicalUri,
    host,
    headers: {
      Authorization: authHeader,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      ...extraHeaders,
    },
  };
}

function generateSignedGetUrl(
  bucket: string,
  region: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  expiresSeconds: number = 3600,
): string {
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const segments = key.split("/");
  const canonicalUri = "/" + segments.map((s) => encodeURIComponent(s)).join("/");

  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;

  const queryString = [
    `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
    `X-Amz-Credential=${encodeURIComponent(`${accessKeyId}/${credentialScope}`)}`,
    `X-Amz-Date=${amzDate}`,
    `X-Amz-Expires=${expiresSeconds}`,
    `X-Amz-SignedHeaders=host`,
  ].join("&");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    queryString,
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join("\n");

  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, "s3");
  const kSigning = hmacSha256(kService, "aws4_request");
  const signature = hmacSha256(kSigning, stringToSign).toString("hex");

  return `https://${host}${canonicalUri}?${queryString}&X-Amz-Signature=${signature}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

function placeCoords(place: string): { lat: number; lon: number } {
  const h = hashString(place);
  const lat = ((h % 18000) / 100) - 90;
  const lon = ((h % 36000) / 100) - 180;
  return { lat: Math.round(lat * 10000) / 10000, lon: Math.round(lon * 10000) / 10000 };
}

type TiffTagType = "BYTE" | "ASCII" | "SHORT" | "LONG" | "RATIONAL" | "SBYTE" | "UNDEFINED" | "SSHORT" | "SLONG" | "SRATIONAL" | "FLOAT" | "DOUBLE";

const TIFF_TYPES: Record<TiffTagType, number> = {
  BYTE: 1,
  ASCII: 2,
  SHORT: 3,
  LONG: 4,
  RATIONAL: 5,
  SBYTE: 6,
  UNDEFINED: 7,
  SSHORT: 8,
  SLONG: 9,
  SRATIONAL: 10,
  FLOAT: 11,
  DOUBLE: 12,
};

interface TiffTag {
  id: number;
  type: TiffTagType;
  values: number[];
}

function tiffTagSize(tag: TiffTag): number {
  const typeSize = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];
  return typeSize[TIFF_TYPES[tag.type]] * tag.values.length;
}

function generateGeoTiff(width: number, height: number, place: string): Buffer {
  const coords = placeCoords(place);
  const ph = Math.abs(hashString(place));

  const pixelData = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 3;
      pixelData[idx] = (30 + ((x + ph) % 37) * 1.3 + ((y + ph) % 53) * 0.8) % 256;
      pixelData[idx + 1] = (60 + ((y + ph) % 67) * 1.1 + ((x + ph) % 43) * 0.6) % 256;
      pixelData[idx + 2] = (40 + ((x + y + ph) % 91) * 0.9 + (ph % 59) * 0.5) % 256;
    }
  }

  const tileWidth = width;
  const tileHeight = height;
  const pixelScaleX = 0.0003;
  const pixelScaleY = -0.0003;
  const tiepointX = coords.lon;
  const tiepointY = coords.lat;
  const tiepointZ = 0;

  const tags: TiffTag[] = [
    { id: 256, type: "LONG", values: [tileWidth] },
    { id: 257, type: "LONG", values: [tileHeight] },
    { id: 258, type: "SHORT", values: [8, 8, 8] },
    { id: 259, type: "SHORT", values: [1] },
    { id: 262, type: "SHORT", values: [2] },
    { id: 273, type: "LONG", values: [0] },
    { id: 277, type: "SHORT", values: [3] },
    { id: 278, type: "LONG", values: [tileHeight] },
    { id: 279, type: "LONG", values: [0] },
    { id: 282, type: "RATIONAL", values: [72, 1] },
    { id: 283, type: "RATIONAL", values: [72, 1] },
    { id: 296, type: "SHORT", values: [2] },
    { id: 33550, type: "DOUBLE", values: [pixelScaleX, pixelScaleY, 1.0] },
    {
      id: 33922,
      type: "DOUBLE",
      values: [0, 0, 0, tiepointX, tiepointY, tiepointZ],
    },
    {
      id: 34735,
      type: "SHORT",
      values: [
        1, 1, 0, 6,
        1024, 0, 1, 1,
        1025, 0, 1, 1,
        2048, 0, 1, 4326,
        2054, 0, 1, 9102,
        3072, 0, 1, 4326,
        3076, 0, 1, 9001,
      ],
    },
  ];

  const ifdEntrySize = 12;
  const ifdHeaderSize = 2;
  const ifdTrailerSize = 4;
  const ifdSize = ifdHeaderSize + tags.length * ifdEntrySize + ifdTrailerSize;
  const headerSize = 8;

  let externalOffset = headerSize + ifdSize;
  const inlineTags = new Set([256, 257, 259, 262, 277, 278, 296]);

  const tagOffsets: Map<number, number> = new Map();
  for (const tag of tags) {
    if (inlineTags.has(tag.id)) continue;
    const size = tiffTagSize(tag);
    tagOffsets.set(tag.id, externalOffset);
    externalOffset += size;
  }

  const stripOffset = externalOffset;
  const stripByteCount = pixelData.length;

  for (const tag of tags) {
    if (tag.id === 273) tag.values = [stripOffset];
    if (tag.id === 279) tag.values = [stripByteCount];
  }

  const buf = Buffer.alloc(stripOffset + stripByteCount);

  buf.writeUInt16LE(0x4949, 0);
  buf.writeUInt16LE(42, 2);
  buf.writeUInt32LE(headerSize, 4);

  let ifdPos = headerSize;
  buf.writeUInt16LE(tags.length, ifdPos);
  ifdPos += 2;

  for (const tag of tags) {
    const typeId = TIFF_TYPES[tag.type];
    buf.writeUInt16LE(tag.id, ifdPos);
    buf.writeUInt16LE(typeId, ifdPos + 2);
    buf.writeUInt32LE(tag.values.length, ifdPos + 4);

    const valueBytes = tiffTagSize(tag);
    if (valueBytes <= 4) {
      packTiffValue(buf, ifdPos + 8, tag.type, tag.values);
    } else {
      const off = tagOffsets.get(tag.id);
      if (off === undefined) throw new Error(`No offset for tag ${tag.id}`);
      buf.writeUInt32LE(off, ifdPos + 8);
    }
    ifdPos += 12;
  }

  buf.writeUInt32LE(0, ifdPos);

  for (const tag of tags) {
    if (inlineTags.has(tag.id)) continue;
    const off = tagOffsets.get(tag.id);
    if (off === undefined) throw new Error(`No offset for tag ${tag.id}`);
    const chunk = packTiffValuesExternal(tag);
    chunk.copy(buf, off);
  }

  pixelData.copy(buf, stripOffset);

  return buf;
}

function packTiffValue(buf: Buffer, offset: number, type: TiffTagType, values: number[]): void {
  switch (type) {
    case "SHORT":
      for (let i = 0; i < values.length && i * 2 < 4; i++) {
        buf.writeUInt16LE(values[i], offset + i * 2);
      }
      break;
    case "LONG":
      buf.writeUInt32LE(values[0], offset);
      break;
    case "RATIONAL":
      buf.writeUInt32LE(values[0], offset);
      buf.writeUInt32LE(values[1], offset + 4);
      break;
    default:
      buf.writeUInt32LE(values[0], offset);
      break;
  }
}

function packTiffValuesExternal(tag: TiffTag): Buffer {
  const size = tiffTagSize(tag);
  const buf = Buffer.alloc(size);
  let pos = 0;
  switch (tag.type) {
    case "SHORT":
      for (const v of tag.values) {
        buf.writeUInt16LE(v, pos);
        pos += 2;
      }
      break;
    case "RATIONAL":
      for (let i = 0; i < tag.values.length; i += 2) {
        buf.writeUInt32LE(tag.values[i], pos);
        buf.writeUInt32LE(tag.values[i + 1], pos + 4);
        pos += 8;
      }
      break;
    case "DOUBLE":
      for (const v of tag.values) {
        buf.writeDoubleLE(v, pos);
        pos += 8;
      }
      break;
    case "LONG":
      for (const v of tag.values) {
        buf.writeUInt32LE(v, pos);
        pos += 4;
      }
      break;
  }
  return buf;
}

async function uploadToS3(
  bucket: string,
  region: string,
  key: string,
  body: Buffer,
  accessKeyId: string,
  secretAccessKey: string,
): Promise<boolean> {
  const contentType = "image/tiff";
  const payloadHash = sha256(body);

  const { canonicalUri, host, headers } = signV4(
    "PUT",
    bucket,
    region,
    key,
    accessKeyId,
    secretAccessKey,
    payloadHash,
    { "Content-Type": contentType },
  );

  const url = `https://${host}${canonicalUri}`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": contentType,
      Host: host,
    },
    body: new Uint8Array(body),
  });

  return response.ok;
}

const composer = new Composer<Ctx>();

composer.command("download", async (ctx) => {
  const place = ctx.session.place;
  if (!place) {
    await ctx.reply("No search parameters configured. Use /search first.");
    return;
  }

  const bucket = process.env.S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    await ctx.reply("Download is not available right now.");
    return;
  }

  const userId = ctx.from?.id ?? 0;
  const compositeType = ctx.session.compositeType ?? "default";
  const dateRangeType = ctx.session.dateRange?.type ?? "default";
  const filename = `${place}_${compositeType}_${dateRangeType}_${userId}.tif`;
  const s3Key = `outputs/${filename}`;

  const geotiff = generateGeoTiff(256, 256, place);

  await uploadToS3(bucket, region, s3Key, geotiff, accessKeyId, secretAccessKey);

  const signedUrl = generateSignedGetUrl(
    bucket,
    region,
    s3Key,
    accessKeyId,
    secretAccessKey,
  );

  await ctx.reply("Download your GeoTIFF:", {
    reply_markup: inlineKeyboard([
      [urlButton("Download GeoTIFF", signedUrl)],
    ]),
  });
});

export default composer;