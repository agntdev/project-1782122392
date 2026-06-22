# fix-bf90c0c2cd9ac3ea — E9T1 translation never works for any feature handler

**Weight:** 0.0000 (share of project budget)
**Reward:** 0 SATB

The translation transformer is installed globally via `ctx.api.config.use()`, but `langStorage.run(lang, next)` in E9T1's `composer.use()` middleware only sets the `AsyncLocalStorage` context **within the E9T1 composer's own middleware chain**. All handlers loaded before E9T1 (E1T1–E8T1) run before the ALS context is set; handlers loaded after (T01, T03, start, and the global fallback) run after the ALS context has already exited. When their `ctx.reply()` calls trigger the transformer, `langStorage.getStore()` returns `undefined`, which defaults to `"en"`. Translation only works for E9T1's own `/lang` command — every other feature handler's output is never translated.

**Fix:** Move the transformer installation and `langStorage.run()` to a `bot.use()` middleware that wraps the entire update pipeline (before all composers), not inside a single composer's `.use()`.

## Dialog tests

This is a FIX task: the behavior it repairs is already covered by an existing spec under `tests/specs/`. Fix the code to make that existing spec pass — do NOT author a new `tests/specs/fix-bf90c0c2cd9ac3ea.json` (a duplicate spec for the same behavior makes the tests-gate count it twice and it can never go green). Add a new spec file ONLY if you are introducing genuinely new user-facing behavior that no existing spec covers; if so, name it `tests/specs/fix-bf90c0c2cd9ac3ea.json` (and any new command `tests/commands/fix-bf90c0c2cd9ac3ea.json`).


## Handler module

This is a FIX task. Find the EXISTING handler under `src/handlers/` that implements the affected command/behavior and EDIT it in place. Do NOT create a new `src/handlers/fix-bf90c0c2cd9ac3ea.ts` — a second `Composer` binding the same command conflicts with the original and breaks the bot. Create a new handler file ONLY if the affected command does not exist anywhere yet (then name it `src/handlers/fix-bf90c0c2cd9ac3ea.ts` and default-export a grammY `Composer`; `buildBot()` auto-loads it). NEVER edit `src/bot.ts`; the global error boundary + unknown-command fallback already live in `buildBot()`.


## Implementation contract

Ship a COMPLETE, working implementation — not a stub. A task is INCOMPLETE (and will be rejected) even if it compiles and the dialog tests pass when it does any of these:
- **Stubbed code:** empty bodies, `TODO`/`FIXME`, commented-out logic, or `throw new Error("not implemented")`.
- **Fabricated data:** `Math.random()`, hardcoded sample arrays, or canned responses standing in for real computed or fetched values.
- **No in-memory data store:** a `Map`/array/module-level variable used as a database is a defect. Anything that must survive a restart (records, subscriptions, balances, schedules, settings) MUST use the toolkit's persistent storage (Redis-backed), not process memory. (The toolkit's auto-selected session storage is only for ephemeral conversation state.)
- **Broken integrations:** call external APIs against their real contract — correct endpoints, ids and params (e.g. a coin *id* like `the-open-network`, not a ticker like `TON`) — with credentials read from env. Do not invent endpoints or fake responses.
- **Dead code:** the feature's command/handler must be registered via its default-exported `Composer` in `src/handlers/<slug>.ts` (auto-loaded) and reachable from the bot's command surface.
If the spec is genuinely under-specified, implement the smallest REAL slice you can verify and note the gap — never fake behavior to make the PR look complete.
