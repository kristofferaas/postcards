import { Effect, Layer, Schema } from "effect"
import * as Context from "effect/Context"
import * as SqlError from "effect/unstable/sql/SqlError"
import { Database } from "./database.js"

export class Postcard extends Schema.Class<Postcard>("Postcard")({
  id: Schema.Int,
  sentAt: Schema.NullOr(Schema.String),
  openedAt: Schema.NullOr(Schema.String),
  frontImage: Schema.String
}) {}

export class CreatePostcard extends Schema.Class<CreatePostcard>("CreatePostcard")({
  frontImage: Schema.String
}) {}

const decodeRows = (rows: ReadonlyArray<unknown>) =>
  Schema.decodeUnknownEffect(Schema.Array(Postcard))(rows)

export class Postcards extends Context.Service<
  Postcards,
  {
    readonly all: () => Effect.Effect<
      ReadonlyArray<Postcard>,
      SqlError.SqlError | Schema.SchemaError
    >
    readonly create: (input: CreatePostcard) => Effect.Effect<
      Postcard,
      SqlError.SqlError | Schema.SchemaError
    >
  }
>()("@post-cards/server/Postcards") {
  static readonly layer = Layer.effect(
    Postcards,
    Effect.gen(function*() {
      const database = yield* Database

      const all = Effect.fn("Postcards.all")(function*() {
        const rows = yield* database.sql`
          SELECT
            rowid AS id,
            sent_at AS "sentAt",
            opened_at AS "openedAt",
            front_image AS "frontImage"
          FROM postcards
          ORDER BY COALESCE(sent_at, '') DESC, rowid DESC
        `

        return yield* decodeRows(rows)
      })

      const create = Effect.fn("Postcards.create")(function*(input: CreatePostcard) {
        const sentAt = new Date().toISOString()
        const rows = yield* database.sql`
          INSERT INTO postcards (
            sent_at,
            opened_at,
            front_image
          )
          VALUES (
            ${sentAt},
            ${null},
            ${input.frontImage}
          )
          RETURNING
            rowid AS id,
            sent_at AS "sentAt",
            opened_at AS "openedAt",
            front_image AS "frontImage"
        `

        const postcards = yield* decodeRows(rows)
        return postcards[0]!
      })

      return { all, create }
    })
  )
}
