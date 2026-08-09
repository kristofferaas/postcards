import { NodeFileSystem, NodePath } from "@effect/platform-node"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { Config, Effect, FileSystem, Layer, Path } from "effect"
import * as Context from "effect/Context"
import type { SqlClient } from "effect/unstable/sql"
import { createPostcardDesignsAndSentPostcards } from "./migrations/0001_create_postcard_designs_and_sent_postcards.ts"

const databasePath = Config.string("DATABASE_PATH").pipe(
  Config.withDefault("./data/post-cards.sqlite")
)

const sqliteLayer = Layer.unwrap(
  Effect.gen(function*() {
    const filename = yield* databasePath
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path

    yield* fileSystem.makeDirectory(path.dirname(filename), {
      recursive: true
    })

    return SqliteClient.layer({ filename })
  })
).pipe(Layer.provide([NodeFileSystem.layer, NodePath.layer]))

export class Database extends Context.Service<
  Database,
  {
    readonly filename: string
    readonly sql: SqlClient.SqlClient
  }
>()("@post-cards/server/Database") {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function*() {
      const sql = yield* SqliteClient.SqliteClient

      yield* sql`PRAGMA foreign_keys = ON`

      yield* SqliteMigrator.run({
        loader: SqliteMigrator.fromRecord({
          "0001_create_postcard_designs_and_sent_postcards":
            createPostcardDesignsAndSentPostcards
        })
      })

      return {
        filename: sql.config.filename,
        sql
      }
    })
  ).pipe(Layer.provideMerge(sqliteLayer))
}
