import { Composer } from "grammy";
import { readdirSync } from "node:fs";
import { createBot, type BotContext } from "./toolkit/index.js";
import type { Lang } from "./handlers/E9T1.js";
import {
  getLang,
  langStorage,
  translate,
} from "./handlers/E9T1.js";

// The per-chat session shape (ephemeral conversation state only). Extend as the
// bot grows. Durable domain data must NOT live here — use the toolkit's
// persistent storage (see AGENTS.md).
export interface DateRange {
  type: "last_month" | "last_year" | "custom";
  start?: string;
  end?: string;
}

export interface Session {
  step?: "awaiting_place" | "awaiting_geocode" | "awaiting_geocode_cached" | "awaiting_custom_range" | "awaiting_composite_custom";
  place?: string;
  dateRange?: DateRange;
  compositeType?: "median" | "most_recent" | "custom";
  compositeCustomName?: string;
}

export type Ctx = BotContext<Session>;

/**
 * buildBot — assembles the bot, AUTO-LOADS every feature handler from
 * src/handlers/, then registers the global fallback. Does NOT start the bot.
 * Add a feature by creating src/handlers/<name>.ts that default-exports a grammY
 * Composer — NEVER edit this file (concurrent feature PRs would conflict).
 */
export async function buildBot(token: string) {
  const bot = createBot<Session>(token, {
    initial: () => ({}),
  });

  // Install translation transformer globally so every handler's output is
  // translated when the user has set a non-English language.
  bot.api.config.use((prev, method, payload, signal) => {
    const currentLang: Lang = langStorage.getStore() ?? "en";
    const translatableMethods = new Set([
      "sendMessage",
      "editMessageText",
      "answerCallbackQuery",
    ]);

    let updated = payload;
    if (
      typeof (updated as any).text === "string" &&
      translatableMethods.has(method)
    ) {
      updated = {
        ...updated,
        text: translate((updated as any).text, currentLang),
      };
    }
    if ((updated as any).reply_markup?.inline_keyboard) {
      updated = {
        ...updated,
        reply_markup: {
          inline_keyboard: (updated as any).reply_markup.inline_keyboard.map(
            (row: any[]) =>
              row.map((btn: any) => ({
                ...btn,
                text: translate(btn.text, currentLang),
              })),
          ),
        },
      };
    }

    return prev(method, updated, signal);
  });

  // Set the user's language in an AsyncLocalStorage context so the transformer
  // above can read it. This middleware wraps the ENTIRE update pipeline (all
  // feature composers + the fallback), guaranteeing every handler's output is
  // translated — not just E9T1's own /lang command.
  bot.use(async (ctx, next) => {
    const rawLang = await getLang(ctx.from?.id ?? 0);
    const lang: Lang = rawLang === "ru" ? "ru" : "en";
    await langStorage.run(lang, next);
  });

  const dir = new URL("./handlers/", import.meta.url);
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter(
      (f) =>
        (f.endsWith(".js") || f.endsWith(".ts")) &&
        !f.endsWith(".d.ts") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    files = []; // no handlers/ dir yet → nothing to load
  }
  for (const file of files.sort()) {
    const mod = (await import(new URL(file, dir).href)) as { default?: Composer<Ctx> };
    if (!mod.default) {
      throw new Error(`handler ${file} must default-export a grammY Composer`);
    }
    bot.use(mod.default);
  }

  bot.on("message", (ctx) => ctx.reply("Sorry, I didn't understand that. Try /help."));

  return bot;
}
