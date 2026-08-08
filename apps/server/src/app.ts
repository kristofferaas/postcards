import { Effect, Layer, Schema } from "effect"
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from "effect/unstable/http"
import {
  BlobKey,
  BlobStorage,
  blobUriFromKey
} from "./blob-storage.js"
import {
  CreatePostcardDesign,
  PostcardDesigns
} from "./postcard-designs.js"
import { SendPostcard, SentPostcards } from "./sent-postcards.js"

const blobNotFoundResponse = (uri: string) =>
  HttpServerResponse.jsonUnsafe(
    { error: "BlobNotFound", uri },
    { status: 404 }
  )

const blobReferenceNotFoundResponse = (uri: string) =>
  HttpServerResponse.jsonUnsafe(
    { error: "BlobNotFound", uri },
    { status: 422 }
  )

const RoutesLive = HttpRouter.use((router) =>
  Effect.gen(function*() {
    const blobStorage = yield* BlobStorage
    const postcardDesigns = yield* PostcardDesigns
    const sentPostcards = yield* SentPostcards

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

    yield* router.add(
      "GET",
      "/postcard-designs",
      postcardDesigns.all().pipe(
        Effect.map(HttpServerResponse.jsonUnsafe)
      )
    )

    yield* router.add(
      "POST",
      "/postcard-designs",
      Effect.gen(function*() {
        const input = yield* HttpServerRequest.schemaBodyJson(CreatePostcardDesign)
        const design = yield* postcardDesigns.create(input)
        return yield* HttpServerResponse.json(design, { status: 201 })
      }).pipe(
        Effect.catchTag("BlobNotFound", (error) =>
          Effect.succeed(blobReferenceNotFoundResponse(error.uri))
        )
      )
    )

    yield* router.add(
      "GET",
      "/sent-postcards",
      sentPostcards.all().pipe(
        Effect.map(HttpServerResponse.jsonUnsafe)
      )
    )

    yield* router.add(
      "POST",
      "/sent-postcards",
      Effect.gen(function*() {
        const input = yield* HttpServerRequest.schemaBodyJson(SendPostcard)
        const postcard = yield* sentPostcards.send(input)
        return yield* HttpServerResponse.json(postcard, { status: 201 })
      }).pipe(
        Effect.catchTag("BlobNotFound", (error) =>
          Effect.succeed(blobReferenceNotFoundResponse(error.uri))
        )
      )
    )
  })
)

export const ApiLive = Layer.merge(
  RoutesLive,
  HttpRouter.cors({
    allowedHeaders: ["Content-Type"],
    allowedMethods: ["GET", "POST", "OPTIONS"]
  })
)
