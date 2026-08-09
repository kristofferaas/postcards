import { Effect, Layer, Schema } from "effect"
import * as Context from "effect/Context"
import type * as PlatformError from "effect/PlatformError"
import * as SqlError from "effect/unstable/sql/SqlError"
import { BlobNotFound, BlobStorage, BlobUri } from "./blob-storage.ts"
import { Database } from "./database.ts"

export class PostcardDesign extends Schema.Class<PostcardDesign>(
  "PostcardDesign"
)({
  id: Schema.Int,
  name: Schema.String,
  frontImageUri: BlobUri,
  backImageUri: BlobUri,
  createdAt: Schema.String
}) {}

export class CreatePostcardDesign extends Schema.Class<CreatePostcardDesign>(
  "CreatePostcardDesign"
)({
  name: Schema.String,
  frontImageUri: BlobUri,
  backImageUri: BlobUri
}) {}

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
>()("@post-cards/server/PostcardDesigns") {
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

        const createdAt = new Date().toISOString()
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
