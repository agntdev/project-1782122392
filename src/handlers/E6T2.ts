import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  getSharedRedisClient,
  MemorySessionStorage,
  RedisSessionStorage,
} from "../toolkit/index.js";

interface RecentQueries {
  queries: string[];
}

function resolveQueriesStorage() {
  if (process.env.REDIS_URL) {
    const client = getSharedRedisClient(process.env.REDIS_URL);
    return new RedisSessionStorage<RecentQueries>(client, "queries:");
  }
  return new MemorySessionStorage<RecentQueries>();
}

const queriesStore = resolveQueriesStorage();

async function getQueries(userId: number): Promise<RecentQueries> {
  return (await queriesStore.read(String(userId))) ?? { queries: [] };
}

async function setQueries(
  userId: number,
  data: RecentQueries,
): Promise<void> {
  await queriesStore.write(String(userId), data);
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
  const current = await getQueries(userId);
  const updated = [queryText, ...current.queries].slice(0, MAX_QUERIES);
  await setQueries(userId, { queries: updated });
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