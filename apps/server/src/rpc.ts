import {
  BlobNotFound,
  POSTCARD_DESIGNS_RPC_METHODS,
  PostcardDesignsUnavailable,
  PostcardsRpc,
  SENT_POSTCARDS_RPC_METHODS,
  SentPostcardsUnavailable
} from "@post-cards/contracts"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import * as RpcServer from "effect/unstable/rpc/RpcServer"
import { PostcardDesigns } from "./postcard-designs.ts"
import { SentPostcards } from "./sent-postcards.ts"

const isBlobNotFound = Schema.is(BlobNotFound)

const postcardDesignsUnavailable = (operation: "create" | "list") =>
  new PostcardDesignsUnavailable({
    message: `Unable to ${operation} postcard designs.`
  })

const sentPostcardsUnavailable = (operation: "list" | "send") =>
  new SentPostcardsUnavailable({
    message: `Unable to ${operation} sent postcards.`
  })

const PostcardsRpcHandlers = PostcardsRpc.toLayer(
  Effect.gen(function*() {
    const postcardDesigns = yield* PostcardDesigns
    const sentPostcards = yield* SentPostcards

    return PostcardsRpc.of({
      [POSTCARD_DESIGNS_RPC_METHODS.list]: () =>
        postcardDesigns.all().pipe(
          Effect.mapError(() => postcardDesignsUnavailable("list"))
        ),
      [POSTCARD_DESIGNS_RPC_METHODS.create]: (input) =>
        postcardDesigns.create(input).pipe(
          Effect.mapError((error) =>
            isBlobNotFound(error)
              ? error
              : postcardDesignsUnavailable("create")
          )
        ),
      [SENT_POSTCARDS_RPC_METHODS.list]: () =>
        sentPostcards.all().pipe(
          Effect.mapError(() => sentPostcardsUnavailable("list"))
        ),
      [SENT_POSTCARDS_RPC_METHODS.send]: (input) =>
        sentPostcards.send(input).pipe(
          Effect.mapError((error) =>
            isBlobNotFound(error) ? error : sentPostcardsUnavailable("send")
          )
        )
    })
  })
)

export const PostcardsRpcRouteLive = RpcServer.layerHttp({
  group: PostcardsRpc,
  path: "/rpc",
  protocol: "http"
}).pipe(
  Layer.provide(PostcardsRpcHandlers),
  Layer.provide(RpcSerialization.layerJson)
)
