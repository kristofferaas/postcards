import {
  BlobKey,
  BlobNotFound,
  type BlobUri,
  BlobTooLarge,
  StoredBlob,
  UnsupportedImageContentType
} from "@post-cards/contracts"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

const extensionsByContentType = {
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const

const contentTypesByExtension = {
  heic: "image/heic",
  heif: "image/heif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
} as const

type SupportedImageContentType = keyof typeof extensionsByContentType

const normalizeContentType = (contentType: string) =>
  contentType.split(";", 1)[0]!.trim().toLowerCase()

const extensionFor = (contentType: string) => {
  const normalized = normalizeContentType(contentType)
  return normalized in extensionsByContentType
    ? extensionsByContentType[normalized as SupportedImageContentType]
    : undefined
}

const contentTypeFor = (key: BlobKey) => {
  const extension = key.slice(key.lastIndexOf(".") + 1)
  return contentTypesByExtension[
    extension as keyof typeof contentTypesByExtension
  ]
}

const sha256 = (data: Uint8Array) =>
  Effect.tryPromise({
    try: () => crypto.subtle.digest("SHA-256", data as BufferSource),
    catch: (cause) =>
      new BlobStorageUnavailable({
        cause: String(cause),
        message: "Unable to hash the uploaded image."
      })
  }).pipe(
    Effect.map((digest) =>
      Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0")
      ).join("")
    )
  )

export const blobUriFromKey = (key: BlobKey): BlobUri =>
  `/blobs/${key}` as BlobUri

export const blobKeyFromUri = (uri: BlobUri): BlobKey =>
  uri.slice("/blobs/".length) as BlobKey

export interface BlobObject {
  readonly contentType: string
  readonly data: Uint8Array
}

export class BlobStorageUnavailable extends Schema.TaggedError<BlobStorageUnavailable>()(
  "BlobStorageUnavailable",
  {
    cause: Schema.String,
    message: Schema.String
  }
) {}

export interface BlobBucket {
  readonly get: (
    key: string
  ) => Effect.Effect<Uint8Array | null, BlobStorageUnavailable>
  readonly head: (
    key: string
  ) => Effect.Effect<boolean, BlobStorageUnavailable>
  readonly put: (
    key: string,
    data: Uint8Array
  ) => Effect.Effect<void, BlobStorageUnavailable>
}

export class BlobStorage extends Context.Service<
  BlobStorage,
  {
    readonly get: (
      uri: BlobUri
    ) => Effect.Effect<BlobObject, BlobNotFound | BlobStorageUnavailable>
    readonly put: (
      data: Uint8Array,
      contentType: string
    ) => Effect.Effect<
      StoredBlob,
      BlobStorageUnavailable | BlobTooLarge | UnsupportedImageContentType
    >
    readonly require: (
      uri: BlobUri
    ) => Effect.Effect<void, BlobNotFound | BlobStorageUnavailable>
  }
>()("@post-cards/server/blob-storage/BlobStorage") {
  static readonly layer = (
    bucket: BlobBucket,
    options?: { readonly maximumBytes?: number }
  ) =>
    Layer.effect(
      BlobStorage,
      Effect.gen(function*() {
        const maximumBytes = options?.maximumBytes ?? 20 * 1024 * 1024

        const require = Effect.fn("BlobStorage.require")(function*(
          uri: BlobUri
        ) {
          const exists = yield* bucket.head(blobKeyFromUri(uri))
          if (!exists) {
            return yield* Effect.fail(new BlobNotFound({ uri }))
          }
        })

        const get = Effect.fn("BlobStorage.get")(function*(uri: BlobUri) {
          const key = blobKeyFromUri(uri)
          const data = yield* bucket.get(key)
          if (data === null) {
            return yield* Effect.fail(new BlobNotFound({ uri }))
          }

          return {
            contentType: contentTypeFor(key),
            data
          }
        })

        const put = Effect.fn("BlobStorage.put")(function*(
          data: Uint8Array,
          contentType: string
        ) {
          const extension = extensionFor(contentType)
          if (extension === undefined) {
            return yield* Effect.fail(
              new UnsupportedImageContentType({ contentType })
            )
          }

          if (data.byteLength > maximumBytes) {
            return yield* Effect.fail(
              new BlobTooLarge({
                actualBytes: data.byteLength,
                maximumBytes
              })
            )
          }

          const digest = yield* sha256(data)
          const key = `${digest}.${extension}` as BlobKey
          if (!(yield* bucket.head(key))) {
            yield* bucket.put(key, data)
          }

          return new StoredBlob({ uri: blobUriFromKey(key) })
        })

        return BlobStorage.of({ get, put, require })
      })
    )
}
