import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import {
  getSharedRedisClient,
  MemorySessionStorage,
  RedisSessionStorage,
} from "../toolkit/index.js";

export interface ProcessingJob {
  userId: number;
  chatId: number;
  place?: string;
  dateRange?: {
    type: "last_month" | "last_year" | "custom";
    start?: string;
    end?: string;
  };
  compositeType?: string;
  compositeCustomName?: string;
  visOption?: string;
  cloudCover?: string;
  status: "pending";
  createdAt: number;
}

function resolveQueueStorage() {
  if (process.env.REDIS_URL) {
    const client = getSharedRedisClient(process.env.REDIS_URL);
    return new RedisSessionStorage<ProcessingJob>(client, "queue:");
  }
  return new MemorySessionStorage<ProcessingJob>();
}

const queueStore = resolveQueueStorage();

const composer = new Composer<Ctx>();

composer.command("process", async (ctx) => {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  if (!userId || !chatId) {
    await ctx.reply("Could not identify your user account.");
    return;
  }

  const job: ProcessingJob = {
    userId,
    chatId,
    place: ctx.session.place,
    dateRange: ctx.session.dateRange,
    compositeType: ctx.session.compositeType,
    compositeCustomName: ctx.session.compositeCustomName,
    visOption: ctx.session.visOption,
    cloudCover: ctx.session.cloudCover,
    status: "pending",
    createdAt: Date.now(),
  };

  const jobId = `${userId}_${Date.now()}`;
  await queueStore.write(jobId, job);

  await ctx.reply("Processing your request...");
});

export default composer;
