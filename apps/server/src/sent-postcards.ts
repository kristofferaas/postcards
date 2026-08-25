import {
  BlobNotFound,
  type SendPostcard,
  SentPostcard
} from "@post-cards/contracts"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as SqlClient from "effect/unstable/sql/SqlClient"
import * as SqlError from "effect/unstable/sql/SqlError"
import { BlobStorage, type BlobStorageUnavailable } from "./blob-storage.ts"

const decodeRows = (rows: ReadonlyArray<unknown>) =>
  Schema.decodeUnknownEffect(Schema.Array(SentPostcard))(rows)

export class SentPostcards extends Context.Service<
  SentPostcards,
  {
    readonly all: (userId: string) => Effect.Effect<
      ReadonlyArray<SentPostcard>,
      SqlError.SqlError | Schema.SchemaError
    >
    readonly send: (userId: string, input: SendPostcard) => Effect.Effect<
      SentPostcard,
      | BlobNotFound
      | BlobStorageUnavailable
      | SqlError.SqlError
      | Schema.SchemaError
    >
  }
>()("@post-cards/server/sent-postcards/SentPostcards") {
  static readonly layer = Layer.effect(
    SentPostcards,
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      const blobStorage = yield* BlobStorage

      const all = Effect.fn("SentPostcards.all")(function*(userId: string) {
        const rows = yield* sql`
          SELECT
            id,
            postcard_design_id AS "postcardDesignId",
            front_image_uri AS "frontImageUri",
            back_image_uri AS "backImageUri",
            sent_at AS "sentAt",
            opened_at AS "openedAt"
          FROM sent_postcards
          WHERE user_id = ${userId}
          ORDER BY sent_at DESC, id DESC
        `

        return yield* decodeRows(rows)
      })

      const send = Effect.fn("SentPostcards.send")(function*(
        userId: string,
        input: SendPostcard
      ) {
        yield* Effect.all([
          blobStorage.require(input.frontImageUri),
          blobStorage.require(input.backImageUri)
        ])

        const sentAt = DateTime.formatIso(yield* DateTime.now)
        const rows = yield* sql`
          INSERT INTO sent_postcards (
            postcard_design_id,
            user_id,
            front_image_uri,
            back_image_uri,
            sent_at,
            opened_at
          )
          VALUES (
            ${input.postcardDesignId},
            ${userId},
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
