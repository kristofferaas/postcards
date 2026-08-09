import { Effect, Layer, Schema } from "effect"
import * as Context from "effect/Context"
import type * as PlatformError from "effect/PlatformError"
import * as SqlError from "effect/unstable/sql/SqlError"
import { BlobNotFound, BlobStorage, BlobUri } from "./blob-storage.ts"
import { Database } from "./database.ts"

export class SentPostcard extends Schema.Class<SentPostcard>("SentPostcard")({
  id: Schema.Int,
  postcardDesignId: Schema.Int,
  frontImageUri: BlobUri,
  backImageUri: BlobUri,
  sentAt: Schema.String,
  openedAt: Schema.NullOr(Schema.String)
}) {}

export class SendPostcard extends Schema.Class<SendPostcard>("SendPostcard")({
  postcardDesignId: Schema.Int,
  frontImageUri: BlobUri,
  backImageUri: BlobUri
}) {}

const decodeRows = (rows: ReadonlyArray<unknown>) =>
  Schema.decodeUnknownEffect(Schema.Array(SentPostcard))(rows)

export class SentPostcards extends Context.Service<
  SentPostcards,
  {
    readonly all: () => Effect.Effect<
      ReadonlyArray<SentPostcard>,
      SqlError.SqlError | Schema.SchemaError
    >
    readonly send: (input: SendPostcard) => Effect.Effect<
      SentPostcard,
      | BlobNotFound
      | PlatformError.PlatformError
      | SqlError.SqlError
      | Schema.SchemaError
    >
  }
>()("@post-cards/server/SentPostcards") {
  static readonly layer = Layer.effect(
    SentPostcards,
    Effect.gen(function*() {
      const database = yield* Database
      const blobStorage = yield* BlobStorage

      const all = Effect.fn("SentPostcards.all")(function*() {
        const rows = yield* database.sql`
          SELECT
            id,
            postcard_design_id AS "postcardDesignId",
            front_image_uri AS "frontImageUri",
            back_image_uri AS "backImageUri",
            sent_at AS "sentAt",
            opened_at AS "openedAt"
          FROM sent_postcards
          ORDER BY sent_at DESC, id DESC
        `

        return yield* decodeRows(rows)
      })

      const send = Effect.fn("SentPostcards.send")(function*(
        input: SendPostcard
      ) {
        yield* Effect.all([
          blobStorage.require(input.frontImageUri),
          blobStorage.require(input.backImageUri)
        ])

        const sentAt = new Date().toISOString()
        const rows = yield* database.sql`
          INSERT INTO sent_postcards (
            postcard_design_id,
            front_image_uri,
            back_image_uri,
            sent_at,
            opened_at
          )
          VALUES (
            ${input.postcardDesignId},
            ${input.frontImageUri},
            ${input.backImageUri},
            ${sentAt},
            ${null}
          )
          RETURNING
            id,
            postcard_design_id AS "postcardDesignId",
            front_image_uri AS "frontImageUri",
            back_image_uri AS "backImageUri",
            sent_at AS "sentAt",
            opened_at AS "openedAt"
        `

        const postcards = yield* decodeRows(rows)
        return postcards[0]!
      })

      return { all, send }
    })
  )
}
