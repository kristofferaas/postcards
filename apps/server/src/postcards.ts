import { Effect, Layer, Schema } from "effect"
import * as Context from "effect/Context"
import * as SqlError from "effect/unstable/sql/SqlError"
import { Database } from "./database.js"

export class Postcard extends Schema.Class<Postcard>("Postcard")({
  id: Schema.Int,
  to: Schema.String,
  from: Schema.String,
  sentAt: Schema.NullOr(Schema.String),
  openedAt: Schema.NullOr(Schema.String),
  content: Schema.String,
  frontImage: Schema.String,
  caption: Schema.String,
  captionStyle: Schema.String,
  accentColor: Schema.String,
  stamp: Schema.String,
  stickers: Schema.Array(Schema.String)
}) {}

export class CreatePostcard extends Schema.Class<CreatePostcard>("CreatePostcard")({
  to: Schema.String,
  from: Schema.String,
  content: Schema.String,
  frontImage: Schema.String,
  caption: Schema.String,
  captionStyle: Schema.String,
  accentColor: Schema.String,
  stamp: Schema.String,
  stickers: Schema.Array(Schema.String)
}) {}

const decodeRows = (rows: ReadonlyArray<unknown>) =>
  Schema.decodeUnknownEffect(Schema.Array(Postcard))(
    rows.map((row) => {
      if (typeof row !== "object" || row === null) {
        return row
      }

      const record = row as Record<string, unknown>
      const stickers = typeof record.stickers === "string"
        ? JSON.parse(record.stickers)
        : record.stickers

      return { ...record, stickers }
    })
  )

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
            "to",
            "from",
            sent_at AS "sentAt",
            opened_at AS "openedAt",
            content,
            front_image AS "frontImage",
            caption,
            caption_style AS "captionStyle",
            accent_color AS "accentColor",
            stamp,
            stickers
          FROM postcards
          ORDER BY COALESCE(sent_at, '') DESC, rowid DESC
        `

        return yield* decodeRows(rows)
      })

      const create = Effect.fn("Postcards.create")(function*(input: CreatePostcard) {
        const sentAt = new Date().toISOString()
        const rows = yield* database.sql`
          INSERT INTO postcards (
            "to",
            "from",
            sent_at,
            opened_at,
            content,
            front_image,
            caption,
            caption_style,
            accent_color,
            stamp,
            stickers
          )
          VALUES (
            ${input.to.trim()},
            ${input.from.trim()},
            ${sentAt},
            ${null},
            ${input.content.trim()},
            ${input.frontImage},
            ${input.caption.trim()},
            ${input.captionStyle},
            ${input.accentColor},
            ${input.stamp},
            ${JSON.stringify(input.stickers)}
          )
          RETURNING
            rowid AS id,
            "to",
            "from",
            sent_at AS "sentAt",
            opened_at AS "openedAt",
            content,
            front_image AS "frontImage",
            caption,
            caption_style AS "captionStyle",
            accent_color AS "accentColor",
            stamp,
            stickers
        `

        const postcards = yield* decodeRows(rows)
        return postcards[0]!
      })

      return { all, create }
    })
  )
}
