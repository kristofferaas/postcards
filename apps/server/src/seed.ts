import { NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Schema } from "effect"
import { Database } from "./database.js"

class ProductionSeedError extends Schema.TaggedErrorClass<ProductionSeedError>()(
  "ProductionSeedError",
  {
    message: Schema.String
  }
) {}

const environment = Config.schema(
  Schema.Literals(["development", "test", "production"]),
  "NODE_ENV"
).pipe(Config.withDefault("development"))

const seed = Effect.gen(function*() {
  const nodeEnvironment = yield* environment

  if (nodeEnvironment === "production") {
    return yield* new ProductionSeedError({
      message: "Refusing to seed postcards when NODE_ENV is production."
    })
  }

  const database = yield* Database

  yield* database.sql.withTransaction(
    Effect.gen(function*() {
      yield* database.sql`DELETE FROM postcards`

      yield* database.sql`
        INSERT INTO postcards (
          "to",
          "from",
          sent_at,
          opened_at,
          content,
          caption,
          caption_style,
          accent_color,
          stamp,
          stickers
        )
        VALUES
          (
            ${"Maya"},
            ${"Jonas"},
            ${"2026-07-18T09:15:00.000Z"},
            ${"2026-07-18T11:42:00.000Z"},
            ${"The midnight sun is still glowing over the harbor. Wish you were here!"},
            ${"MIDNIGHT SUN"},
            ${"bold"},
            ${"#ff6b4a"},
            ${"🌊"},
            ${JSON.stringify(["✨", "☀️"])}
          ),
          (
            ${"Noah"},
            ${"Sofia"},
            ${"2026-07-21T14:30:00.000Z"},
            ${null},
            ${"Found a tiny bookshop tucked between two cafés. I saved you a postcard from it."},
            ${"wish you were here"},
            ${"script"},
            ${"#7157d9"},
            ${"✈️"},
            ${JSON.stringify(["📚"])}
          ),
          (
            ${"Liv"},
            ${"Erik"},
            ${"2026-07-24T07:05:00.000Z"},
            ${"2026-07-25T16:20:00.000Z"},
            ${"Greetings from the fjords — cold water, warm waffles, and an unforgettable view."},
            ${"NORWAY, WITH LOVE"},
            ${"classic"},
            ${"#0b7a75"},
            ${"🏔️"},
            ${JSON.stringify(["💙", "🌿"])}
          ),
          (
            ${"Aksel"},
            ${"Nora"},
            ${null},
            ${null},
            ${"A little note for your next adventure. This one is still waiting to be sent."},
            ${"Next adventure →"},
            ${"bold"},
            ${"#d94b35"},
            ${"🍒"},
            ${JSON.stringify(["🧡"])}
          )
      `
    })
  )

  yield* Effect.logInfo(`Seeded postcards in ${database.filename}`)
}).pipe(Effect.provide(Database.layer))

NodeRuntime.runMain(seed)
