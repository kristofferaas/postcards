import * as Config from "effect/Config"
import * as Schema from "effect/Schema"

export const blobStoragePath = Config.string("BLOB_STORAGE_PATH").pipe(
  Config.withDefault("./data/blobs")
)

export const databasePath = Config.string("DATABASE_PATH").pipe(
  Config.withDefault("./data/post-cards.sqlite")
)

export const nodeEnvironment = Config.schema(
  Schema.Literals(["development", "test", "production"]),
  "NODE_ENV"
).pipe(Config.withDefault("development"))
