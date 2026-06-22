import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { createHmac, createHash } from "node:crypto";
import { urlButton, inlineKeyboard } from "../toolkit/index.js";

function sha256(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data).digest();
}

function generateSignedS3Url(
  bucket: string,
  region: string,
  key: string,
  accessKeyId: string,
  secretAccessKey: string,
  expiresSeconds: number = 3600,
): string {
  const method = "GET";
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
    method,
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
  const key = `outputs/${filename}`;

  const signedUrl = generateSignedS3Url(
    bucket,
    region,
    key,
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