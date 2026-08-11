import { createHash } from "node:crypto"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import {
  BlobKey,
  BlobNotFound,
  type BlobUri,
  BlobTooLarge,
  StoredBlob,
  UnsupportedImageContentType
} from "@post-cards/contracts"
import * as Config from "effect/Config"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import type * as PlatformError from "effect/PlatformError"
import { blobStoragePath } from "./data-config.ts"

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

export const blobUriFromKey = (key: BlobKey): BlobUri =>
  `/blobs/${key}` as BlobUri

export const blobKeyFromUri = (uri: BlobUri): BlobKey =>
  uri.slice("/blobs/".length) as BlobKey

export interface BlobObject {
  readonly contentType: string
  readonly data: Uint8Array
}

export class BlobStorage extends Context.Service<
  BlobStorage,
  {
    readonly get: (
      uri: BlobUri
    ) => Effect.Effect<BlobObject, BlobNotFound | PlatformError.PlatformError>
    readonly put: (
      data: Uint8Array,
      contentType: string
    ) => Effect.Effect<
      StoredBlob,
      | BlobTooLarge
      | PlatformError.PlatformError
      | UnsupportedImageContentType
    >
    readonly require: (
      uri: BlobUri
    ) => Effect.Effect<void, BlobNotFound | PlatformError.PlatformError>
  }
>()("@post-cards/server/blob-storage/BlobStorage") {
  static readonly localLayer = Layer.effect(
    BlobStorage,
    Effect.gen(function*() {
      const root = yield* blobStoragePath
      const maximumBytes = yield* Config.int("BLOB_MAX_BYTES").pipe(
        Config.withDefault(20 * 1024 * 1024)
      )
      const fileSystem = yield* FileSystem.FileSystem
      const path = yield* Path.Path

      yield* fileSystem.makeDirectory(root, { recursive: true })

      const require = Effect.fn("BlobStorage.require")(function*(uri: BlobUri) {
        const exists = yield* fileSystem.exists(
          path.join(root, blobKeyFromUri(uri))
        )

        if (!exists) {
          return yield* new BlobNotFound({ uri })
        }
      })

      const get = Effect.fn("BlobStorage.get")(function*(uri: BlobUri) {
        const key = blobKeyFromUri(uri)
        yield* require(uri)

        return {
          contentType: contentTypeFor(key),
          data: yield* fileSystem.readFile(path.join(root, key))
        }
      })

      const put = Effect.fn("BlobStorage.put")(function*(
        data: Uint8Array,
        contentType: string
      ) {
        const extension = extensionFor(contentType)
        if (extension === undefined) {
          return yield* new UnsupportedImageContentType({ contentType })
        }

        if (data.byteLength > maximumBytes) {
          return yield* new BlobTooLarge({
            actualBytes: data.byteLength,
            maximumBytes
          })
        }

        const digest = createHash("sha256").update(data).digest("hex")
        const key = `${digest}.${extension}` as BlobKey
        const destination = path.join(root, key)

        if (!(yield* fileSystem.exists(destination))) {
          yield* fileSystem.writeFile(destination, data)
        }

        return new StoredBlob({ uri: blobUriFromKey(key) })
      })

      return { get, put, require }
    })
  ).pipe(Layer.provide([NodeFileSystem.layer, NodePath.layer]))
}
