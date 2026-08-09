import { NodeRuntime } from "@effect/platform-node"
import { Config, Effect, Schema } from "effect"
import { Database } from "./database.ts"

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
      yield* database.sql`DELETE FROM sent_postcards`
      yield* database.sql`DELETE FROM postcard_designs`
    })
  )

  yield* Effect.logInfo(`Seeded postcards in ${database.filename}`)
}).pipe(Effect.provide(Database.layer))

NodeRuntime.runMain(seed)
