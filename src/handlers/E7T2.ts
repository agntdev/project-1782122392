import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { imageMetaStore, STORAGE_DIR, isStale } from "./E7T1.js";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const composer = new Composer<Ctx>();

composer.command("cleanupcache", async (ctx) => {
  const now = Date.now();
  let cleaned = 0;
  let freedBytes = 0;

  for await (const key of imageMetaStore.readAllKeys()) {
    const meta = await imageMetaStore.read(key);
    if (!meta) continue;

    if (isStale(meta, now)) {
      const ext = extFromMime(meta.mimeType);
      deleteFile(meta.id, ext);
      if (ext === "jpeg") deleteFile(meta.id, "jpg");

      await imageMetaStore.delete(meta.id);
      freedBytes += meta.sizeBytes;
      cleaned++;
    }
  }

  await ctx.reply(
    `Cache cleanup complete. Removed ${cleaned} expired image(s), freed ${formatBytes(freedBytes)}.`,
  );
});

export default composer;
