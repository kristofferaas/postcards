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
          sent_at,
          opened_at,
          front_image
        )
        VALUES
          (
            ${"2026-07-18T09:15:00.000Z"},
            ${"2026-07-18T11:42:00.000Z"},
            ${"fjord"}
          ),
          (
            ${"2026-07-21T14:30:00.000Z"},
            ${null},
            ${"fjord"}
          ),
          (
            ${"2026-07-24T07:05:00.000Z"},
            ${"2026-07-25T16:20:00.000Z"},
            ${"fjord"}
          ),
          (
            ${null},
            ${null},
            ${"fjord"}
          )
      `
    })
  )

  yield* Effect.logInfo(`Seeded postcards in ${database.filename}`)
}).pipe(Effect.provide(Database.layer))

NodeRuntime.runMain(seed)
