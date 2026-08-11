import {
  BlobNotFound,
  type CreatePostcardDesign,
  PostcardDesign
} from "@post-cards/contracts"
import * as Context from "effect/Context"
import * as DateTime from "effect/DateTime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import type * as PlatformError from "effect/PlatformError"
import * as Schema from "effect/Schema"
import * as SqlError from "effect/unstable/sql/SqlError"
import { BlobStorage } from "./blob-storage.ts"
import { Database } from "./database.ts"

const decodeRows = (rows: ReadonlyArray<unknown>) =>
  Schema.decodeUnknownEffect(Schema.Array(PostcardDesign))(rows)

export class PostcardDesigns extends Context.Service<
  PostcardDesigns,
  {
    readonly all: () => Effect.Effect<
      ReadonlyArray<PostcardDesign>,
      SqlError.SqlError | Schema.SchemaError
    >
    readonly create: (input: CreatePostcardDesign) => Effect.Effect<
      PostcardDesign,
      | BlobNotFound
      | PlatformError.PlatformError
      | SqlError.SqlError
      | Schema.SchemaError
    >
  }
>()("@post-cards/server/postcard-designs/PostcardDesigns") {
  static readonly layer = Layer.effect(
    PostcardDesigns,
    Effect.gen(function*() {
      const database = yield* Database
      const blobStorage = yield* BlobStorage

      const all = Effect.fn("PostcardDesigns.all")(function*() {
        const rows = yield* database.sql`
          SELECT
            id,
            name,
            front_image_uri AS "frontImageUri",
            back_image_uri AS "backImageUri",
            created_at AS "createdAt"
          FROM postcard_designs
          ORDER BY id DESC
        `

        return yield* decodeRows(rows)
      })

      const create = Effect.fn("PostcardDesigns.create")(function*(
        input: CreatePostcardDesign
      ) {
        yield* Effect.all([
          blobStorage.require(input.frontImageUri),
          blobStorage.require(input.backImageUri)
        ])

        const createdAt = DateTime.formatIso(yield* DateTime.now)
        const rows = yield* database.sql`
          INSERT INTO postcard_designs (
            name,
            front_image_uri,
            back_image_uri,
            created_at
          )
          VALUES (
            ${input.name},
            ${input.frontImageUri},
            ${input.backImageUri},
            ${createdAt}
          )
          RETURNING
            id,
            name,
            front_image_uri AS "frontImageUri",
            back_image_uri AS "backImageUri",
            created_at AS "createdAt"
        `

        const designs = yield* decodeRows(rows)
        return designs[0]!
      })

      return { all, create }
    })
  )
}
