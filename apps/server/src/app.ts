import { Effect, Layer } from "effect"
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse
} from "effect/unstable/http"
import { CreatePostcard, Postcards } from "./postcards.js"

const RoutesLive = HttpRouter.use((router) =>
  Effect.gen(function*() {
    const postcards = yield* Postcards

    yield* router.add(
      "GET",
      "/health",
      HttpServerResponse.jsonUnsafe({
        name: "post-cards-server",
        status: "ok"
      })
    )

    yield* router.add(
      "GET",
      "/postcards",
      postcards.all().pipe(
        Effect.map(HttpServerResponse.jsonUnsafe)
      )
    )

    yield* router.add(
      "POST",
      "/postcards",
      Effect.gen(function*() {
        const input = yield* HttpServerRequest.schemaBodyJson(CreatePostcard)
        const postcard = yield* postcards.create(input)
        return yield* HttpServerResponse.json(postcard, { status: 201 })
      })
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
