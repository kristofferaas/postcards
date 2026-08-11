import { BlobKey } from "@post-cards/contracts"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from "effect/unstable/http"
import { BlobStorage, blobUriFromKey } from "./blob-storage.ts"
import { PostcardsRpcRouteLive } from "./rpc.ts"

const blobNotFoundResponse = (uri: string) =>
  HttpServerResponse.jsonUnsafe(
    { error: "BlobNotFound", uri },
    { status: 404 }
  )

const RoutesLive = HttpRouter.use((router) =>
  Effect.gen(function*() {
    const blobStorage = yield* BlobStorage

    yield* router.add(
      "GET",
      "/health",
      HttpServerResponse.jsonUnsafe({
        name: "post-cards-server",
        status: "ok"
      })
    )

    yield* router.add(
      "POST",
      "/blobs",
      Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const contentType = request.headers["content-type"] ?? ""
        const data = new Uint8Array(yield* request.arrayBuffer)
        const blob = yield* blobStorage.put(data, contentType)

        return yield* HttpServerResponse.json(blob, {
          headers: { location: blob.uri },
          status: 201
        })
      }).pipe(
        Effect.catchTag("UnsupportedImageContentType", (error) =>
          Effect.succeed(
            HttpServerResponse.jsonUnsafe(
              {
                contentType: error.contentType,
                error: "UnsupportedImageContentType"
              },
              { status: 415 }
            )
          )
        ),
        Effect.catchTag("BlobTooLarge", (error) =>
          Effect.succeed(
            HttpServerResponse.jsonUnsafe(
              {
                actualBytes: error.actualBytes,
                error: "BlobTooLarge",
                maximumBytes: error.maximumBytes
              },
              { status: 413 }
            )
          )
        )
      )
    )

    yield* router.add(
      "GET",
      "/blobs/:key",
      Effect.gen(function*() {
        const { key } = yield* HttpRouter.schemaPathParams(
          Schema.Struct({ key: BlobKey })
        )
        const uri = blobUriFromKey(key)
        const blob = yield* blobStorage.get(uri)

        return HttpServerResponse.uint8Array(blob.data, {
          contentType: blob.contentType,
          headers: {
            "cache-control": "public, max-age=31536000, immutable"
          }
        })
      }).pipe(
        Effect.catchTag("BlobNotFound", (error) =>
          Effect.succeed(blobNotFoundResponse(error.uri))
        )
      )
    )

  })
)

export const ApiLive = Layer.mergeAll(
  RoutesLive,
  PostcardsRpcRouteLive,
  HttpRouter.cors({
    allowedHeaders: ["Content-Type"],
    allowedMethods: ["GET", "POST", "OPTIONS"]
  })
)
