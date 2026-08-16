import * as Schema from "effect/Schema"

const blobKeyPattern = /^[a-f0-9]{64}\.(?:heic|heif|jpg|png|webp)$/

export const BlobKey = Schema.String.check(Schema.isPattern(blobKeyPattern)).pipe(
  Schema.brand("BlobKey")
)
export type BlobKey = typeof BlobKey.Type

export const BlobUri = Schema.String.check(
  Schema.isPattern(/^\/blobs\/[a-f0-9]{64}\.(?:heic|heif|jpg|png|webp)$/)
).pipe(Schema.brand("BlobUri"))
export type BlobUri = typeof BlobUri.Type

export class StoredBlob extends Schema.Class<StoredBlob>("StoredBlob")({
  uri: BlobUri
}) {}

export class BlobNotFound extends Schema.TaggedError<BlobNotFound>()(
  "BlobNotFound",
  { uri: BlobUri }
) {}

export class UnsupportedImageContentType extends Schema.TaggedError<UnsupportedImageContentType>()(
  "UnsupportedImageContentType",
  { contentType: Schema.String }
) {}

export class BlobTooLarge extends Schema.TaggedError<BlobTooLarge>()(
  "BlobTooLarge",
  {
    actualBytes: Schema.Number,
    maximumBytes: Schema.Number
  }
) {}
