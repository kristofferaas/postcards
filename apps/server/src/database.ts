import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import type { SqlClient } from "effect/unstable/sql"
import { databasePath } from "./data-config.ts"
import { createPostcardDesignsAndSentPostcards } from "./migrations/0001_create_postcard_designs_and_sent_postcards.ts"

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
>()("@post-cards/server/database") {
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
