import { AsyncLocalStorage } from "node:async_hooks";
import { Composer } from "grammy";
import { createRequire } from "node:module";
import type { StorageAdapter } from "grammy";
import type { Ctx } from "../bot.js";
import { MemorySessionStorage, RedisSessionStorage } from "../toolkit/index.js";
import type { RedisLike } from "../toolkit/session/redis.js";

export type Lang = "en" | "ru";

export interface UserLang {
  lang: Lang;
}

function resolveLangStorage(): StorageAdapter<UserLang> {
  if (process.env.REDIS_URL) {
    const require = createRequire(import.meta.url);
    const ioredis: any = require("ioredis");
    const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
    const client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      lazyConnect: false,
    });
    return new RedisSessionStorage<UserLang>(client as RedisLike, "lang:");
  }
  return new MemorySessionStorage<UserLang>();
}

const langStore = resolveLangStorage();

export async function getLang(userId: number): Promise<Lang> {
  const stored = await langStore.read(String(userId));
  return stored?.lang ?? "en";
}

export async function setLang(userId: number, lang: Lang): Promise<void> {
  await langStore.write(String(userId), { lang });
}

export const translations: Record<string, string> = {
  // start.ts
  "Welcome! I am ready to help.": "Добро пожаловать! Я готов помочь.",
  Status: "Статус",
  Settings: "Настройки",
  Help: "Помощь",

  // T01.ts
  "T01: Bot skeleton verified.": "T01: Скелет бота проверен.",

  // T03.ts
  "Available commands:": "Доступные команды:",
  "/start - Welcome message": "/start - Приветственное сообщение",
  "/t01 - Bot skeleton verification": "/t01 - Проверка скелета бота",
  "/help - Show this help message": "/help - Показать это сообщение справки",

  // E1T1.ts
  "What place would you like to search for?":
    "Какое место вы хотите найти?",

  // E6T1.ts / E6T2.ts
  "Could not identify your user account.":
    "Не удалось идентифицировать вашу учётную запись.",
  "Usage: /setprefs <key> <value> [<key> <value> ...]\nKeys: defaultVisualization, lastPlace\nExample: /setprefs defaultVisualization chart lastPlace London":
    "Использование: /setprefs <ключ> <значение> [<ключ> <значение> ...]\nКлючи: defaultVisualization, lastPlace\nПример: /setprefs defaultVisualization chart lastPlace London",
  "Each key must have a value. Use: /setprefs <key> <value> [<key> <value> ...]":
    "Каждый ключ должен иметь значение. Используйте: /setprefs <ключ> <значение> [<ключ> <значение> ...]",
  "Your preferences:": "Ваши настройки:",
  "- Default visualization: ": "- Визуализация по умолчанию: ",
  "- Last place: ": "- Последнее место: ",
  "(not set)": "(не задано)",

  // E6T2.ts
  "Usage: /query <search text>\nExample: /query weather in London":
    "Использование: /query <текст поиска>\nПример: /query погода в Лондоне",
  "You have no recent queries.": "У вас нет недавних запросов.",
  "Recent queries:": "Недавние запросы:",

  // bot.ts fallback
  "Sorry, I didn't understand that. Try /help.":
    "Извините, я не понял. Попробуйте /help.",
};

export function translate(text: string, lang: Lang): string {
  if (lang === "en") return text;
  if (translations[text]) return translations[text];

  // Dynamic message patterns
  const patterns: Array<{ regex: RegExp; replace: (match: RegExpMatchArray) => string }> = [
    {
      regex: /^Place saved: (.+)$/,
      replace: (m) => `Место сохранено: ${m[1]}`,
    },
    {
      regex: /^Unknown preference key "(.+)"\. Valid keys: (.+)$/,
      replace: (m) =>
        `Неизвестный ключ настроек "${m[1]}". Допустимые ключи: ${m[2]}`,
    },
    {
      regex: /^Query saved: "(.+)"$/,
      replace: (m) => `Запрос сохранён: "${m[1]}"`,
    },
    {
      regex: /^Your preferences:\n/,
      replace: () => "Ваши настройки:\n",
    },
  ];

  for (const { regex, replace } of patterns) {
    const match = text.match(regex);
    if (match) return replace(match);
  }

  return text;
}

const composer = new Composer<Ctx>();

export const langStorage = new AsyncLocalStorage<Lang>();

composer.command("lang", async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) {
    await ctx.reply("Could not identify your user account.");
    return;
  }

  const text = ctx.message?.text ?? "";
  const args = text.split(/\s+/).slice(1);

  if (args.length === 0) {
    const lang = await getLang(userId);
    if (lang === "ru") {
      await ctx.reply(
        "Текущий язык: Русский. Используйте /lang <ru|en> для переключения.",
      );
    } else {
      await ctx.reply(
        "Current language: English. Use /lang <ru|en> to switch.",
      );
    }
    return;
  }

  const newLang = args[0].toLowerCase();
  if (newLang !== "en" && newLang !== "ru") {
    await ctx.reply("Unknown language. Available: en, ru");
    return;
  }

  await setLang(userId, newLang as Lang);
  if (newLang === "ru") {
    await ctx.reply("Язык изменён на Русский.");
  } else {
    await ctx.reply("Language set to English.");
  }
});

export default composer;