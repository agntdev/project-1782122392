import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  getSharedRedisClient,
  MemorySessionStorage,
  RedisSessionStorage,
} from "../toolkit/index.js";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, statSync, readdirSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";

export interface ImageMetadata {
  id: string;
  label: string;
  mimeType: string;
  sizeBytes: number;
  storedAt: string;
  width: number;
  height: number;
}

function resolveImageMetaStorage() {
  if (process.env.REDIS_URL) {
    const client = getSharedRedisClient(process.env.REDIS_URL);
    return new RedisSessionStorage<ImageMetadata>(client, "imgmeta:");
  }
  return new MemorySessionStorage<ImageMetadata>();
}

export const imageMetaStore = resolveImageMetaStorage();

export const STORAGE_DIR = join(
  process.env.IMAGE_STORAGE_DIR ?? "/tmp/agntdev-images",
);

export const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function extFromMime(mimeType: string): string {
  const parts = mimeType.split("/");
  return parts[1] ?? "jpg";
}

function deleteFile(hash: string, ext: string): void {
  const p = join(STORAGE_DIR, `${hash}.${ext}`);
  try {
    if (existsSync(p)) unlinkSync(p);
  } catch {
    // file already gone
  }
}

export function isStale(meta: ImageMetadata, now?: number): boolean {
  const age = (now ?? Date.now()) - new Date(meta.storedAt).getTime();
  return age > TTL_MS;
}

function ensureStorageDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

async function storeImageMeta(meta: ImageMetadata): Promise<void> {
  await imageMetaStore.write(meta.id, meta);
}

async function getImageMeta(id: string): Promise<ImageMetadata | undefined> {
  const meta = await imageMetaStore.read(id);
  if (!meta) return undefined;
  if (isStale(meta)) {
    const ext = extFromMime(meta.mimeType);
    deleteFile(meta.id, ext);
    if (ext === "jpeg") deleteFile(meta.id, "jpg");
    await imageMetaStore.delete(meta.id);
    return undefined;
  }
  return meta;
}

async function listAllImageMeta(): Promise<ImageMetadata[]> {
  const now = Date.now();
  const metas: ImageMetadata[] = [];
  for await (const key of imageMetaStore.readAllKeys()) {
    const meta = await imageMetaStore.read(key);
    if (!meta) continue;
    if (isStale(meta, now)) {
      const ext = extFromMime(meta.mimeType);
      deleteFile(meta.id, ext);
      if (ext === "jpeg") deleteFile(meta.id, "jpg");
      await imageMetaStore.delete(meta.id);
      continue;
    }
    metas.push(meta);
  }
  metas.sort(
    (a, b) => new Date(b.storedAt).getTime() - new Date(a.storedAt).getTime(),
  );
  return metas;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const composer = new Composer<Ctx>();

composer.command("storeimage", async (ctx) => {
  const text = ctx.message?.text ?? "";
  const args = text.split(/\s+/).slice(1);
  if (args.length === 0) {
    await ctx.reply(
      "Usage: send a photo with caption /storeimage <label>, or reply to a photo with /storeimage <label>",
    );
    return;
  }
  const label = args.join(" ");
  const repliedMsg = ctx.message?.reply_to_message;
  const photo = repliedMsg?.photo ?? ctx.message?.photo;

  if (!photo || photo.length === 0) {
    await ctx.reply(
      "No photo found. Send a photo with caption /storeimage <label>, or reply to a photo with /storeimage <label>.",
    );
    return;
  }

  const largest = photo.reduce((a, b) =>
    (b.width ?? 0) * (b.height ?? 0) > (a.width ?? 0) * (a.height ?? 0) ? b : a,
  );
  const fileId = largest.file_id ?? photo[photo.length - 1].file_id;

  try {
    const fileInfo = await ctx.api.getFile(fileId);
    const filePath = fileInfo.file_path;
    if (!filePath) {
      await ctx.reply("Failed to retrieve file path from Telegram.");
      return;
    }

    const url = `https://api.telegram.org/file/bot${ctx.api.token}/${filePath}`;
    ensureStorageDir();

    const response = await fetch(url);
    if (!response.ok) {
      await ctx.reply(
        `Failed to download image from Telegram: HTTP ${response.status}`,
      );
      return;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
    const ext = filePath.split(".").pop() ?? "jpg";
    const filename = `${hash}.${ext}`;
    const destPath = join(STORAGE_DIR, filename);
    writeFileSync(destPath, buffer);

    const sizeBytes = statSync(destPath).size;
    const meta: ImageMetadata = {
      id: hash,
      label,
      mimeType: `image/${ext === "png" ? "png" : ext === "gif" ? "gif" : "jpeg"}`,
      sizeBytes,
      storedAt: new Date().toISOString(),
      width: largest.width ?? 0,
      height: largest.height ?? 0,
    };
    await storeImageMeta(meta);

    await ctx.reply(
      `Image stored "${label}" (${largest.width}x${largest.height}, ${formatBytes(sizeBytes)}, id: ${hash})`,
    );
  } catch (err) {
    await ctx.reply(
      `Failed to store image: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
});

composer.command("imagestatus", async (ctx) => {
  ensureStorageDir();
  const files = readdirSync(STORAGE_DIR).filter((f) => f !== "." && f !== "..");
  const metas = await listAllImageMeta();
  const totalBytes = metas.reduce((sum, m) => sum + m.sizeBytes, 0);

  let status = `Image cache status:\n`;
  status += `- Stored images: ${metas.length}\n`;
  status += `- Files on disk: ${files.length}\n`;
  status += `- Total size: ${formatBytes(totalBytes)}`;
  await ctx.reply(status);
});

composer.command("listimages", async (ctx) => {
  const metas = await listAllImageMeta();
  if (metas.length === 0) {
    await ctx.reply("No images stored in the cache.");
    return;
  }

  const lines = metas.map((m, i) => {
    const date = new Date(m.storedAt).toLocaleString("en-US", {
      timeZone: "UTC",
    });
    return `${i + 1}. "${m.label}" — ${m.width}x${m.height}, ${formatBytes(m.sizeBytes)}, ${date} UTC (${m.id})`;
  });
  await ctx.reply(`Stored images:\n${lines.join("\n")}`);
});

export default composer;