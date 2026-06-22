import { Composer } from "grammy";
import { createRequire } from "node:module";
import type { StorageAdapter } from "grammy";
import type { Ctx } from "../bot.js";
import { MemorySessionStorage, RedisSessionStorage } from "../toolkit/index.js";
import type { RedisLike } from "../toolkit/session/redis.js";

interface RecentQueries {
  queries: string[];
}

let queriesStore: StorageAdapter<RecentQueries>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let queriesRedisClient: any | null = null;
const QUERIES_PREFIX = "queries:";

function initQueriesStorage(): void {
  if (process.env.REDIS_URL) {
    const require = createRequire(import.meta.url);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ioredis: any = require("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    queriesRedisClient = client;
    queriesStore = new RedisSessionStorage<RecentQueries>(client as RedisLike, QUERIES_PREFIX);
  } else {
    queriesStore = new MemorySessionStorage<RecentQueries>();
  }
}
initQueriesStorage();

async function getQueries(userId: number): Promise<RecentQueries> {
  return (await queriesStore.read(String(userId))) ?? { queries: [] };
}

async function prependQuery(userId: number, queryText: string): Promise<void> {
  const key = String(userId);
  if (queriesRedisClient) {
    const redisKey = QUERIES_PREFIX + key;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await queriesRedisClient.watch(redisKey);
      const raw = await queriesRedisClient.get(redisKey);
      const current: RecentQueries = raw ? JSON.parse(raw) : { queries: [] };
      const updated = [queryText, ...current.queries].slice(0, MAX_QUERIES);
      const result = await queriesRedisClient.multi().set(redisKey, JSON.stringify({ queries: updated })).exec();
      if (result !== null) return;
    }
  }
  const current = await getQueries(userId);
  const updated = [queryText, ...current.queries].slice(0, MAX_QUERIES);
  await queriesStore.write(key, { queries: updated });
}

const MAX_QUERIES = 10;

const composer = new Composer<Ctx>();

composer.command("query", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not identify your user account.");
    return;
  }
  const text = ctx.message?.text ?? "";
  const args = text.split(/\s+/).slice(1);
  if (args.length === 0) {
    await ctx.reply(
      "Usage: /query <search text>\nExample: /query weather in London",
    );
    return;
  }
  const queryText = args.join(" ");
  await prependQuery(userId, queryText);
  await ctx.reply(`Query saved: "${queryText}"`);
});

composer.command("recent", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not identify your user account.");
    return;
  }
  const current = await getQueries(userId);
  if (current.queries.length === 0) {
    await ctx.reply("You have no recent queries.");
    return;
  }
  const lines = current.queries.map(
    (q, i) => `${i + 1}. ${q}`,
  );
  await ctx.reply(`Recent queries:\n${lines.join("\n")}`);
});

export default composer;