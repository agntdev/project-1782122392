import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { imageMetaStore, STORAGE_DIR } from "./E7T1.js";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

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

    const age = now - new Date(meta.storedAt).getTime();
    if (age > TTL_MS) {
      deleteFile(meta.id, meta.ext);

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
