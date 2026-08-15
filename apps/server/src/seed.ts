// This script is the Node boundary for reading local fixture files.
// @effect-diagnostics effect/nodeBuiltinImport:off
import { readFile } from "node:fs/promises"
// @effect-diagnostics effect/nodeBuiltinImport:error
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import {
  POSTCARD_DESIGNS_RPC_METHODS,
  PostcardsRpc,
  SENT_POSTCARDS_RPC_METHODS,
  StoredBlob
} from "@post-cards/contracts"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"

const apiUrlArgument = process.argv
  .slice(2)
  .find((argument) => argument !== "--")
if (apiUrlArgument === undefined) {
  throw new Error(
    "Usage: pnpm data:seed -- https://your-worker.workers.dev"
  )
}

const apiUrl = new URL(apiUrlArgument)

interface ImageFixture {
  readonly contentType: "image/jpeg" | "image/png"
  readonly url: URL
}

interface PostcardFixture {
  readonly back: ImageFixture
  readonly front: ImageFixture
  readonly name: string
}

const postcardFixtures = [
  {
    name: "Norway Fjord",
    front: {
      contentType: "image/jpeg",
      url: new URL("../fixtures/postcards/norway-fjord.jpg", import.meta.url)
    },
    back: {
      contentType: "image/png",
      url: new URL("../fixtures/postcards/norway-fjord.png", import.meta.url)
    }
  }
] as const satisfies ReadonlyArray<PostcardFixture>

const upload = Effect.fn("Seed.upload")(function*(fixture: ImageFixture) {
  const data = yield* Effect.tryPromise(() => readFile(fixture.url))
  // The Node CLI uses the native Fetch implementation at its HTTP boundary.
  // @effect-diagnostics effect/globalFetch:off
  const response = yield* Effect.tryPromise(() =>
    fetch(new URL("/blobs", apiUrl), {
      method: "POST",
      headers: { "content-type": fixture.contentType },
      body: data
    })
  )
  // @effect-diagnostics effect/globalFetch:error

  if (!response.ok) {
    return yield* Effect.fail(
      new Error(`Blob upload failed with HTTP ${response.status}.`)
    )
  }

  const payload = yield* Effect.tryPromise(() => response.json())
  return yield* Schema.decodeUnknownEffect(StoredBlob)(payload)
})

const RpcLive = RpcClient.layerProtocolHttp({
  url: new URL("/rpc", apiUrl).toString()
}).pipe(
  Layer.provide([NodeHttpClient.layerUndici, RpcSerialization.layerJson])
)

const seed = Effect.gen(function*() {
  const client = yield* RpcClient.make(PostcardsRpc)

  yield* Effect.forEach(
    postcardFixtures,
    (fixture) =>
      Effect.gen(function*() {
        const [frontBlob, backBlob] = yield* Effect.all([
          upload(fixture.front),
          upload(fixture.back)
        ])
        const designs = yield* client[POSTCARD_DESIGNS_RPC_METHODS.list]()
        const design = designs.find(
          (candidate) =>
            candidate.name === fixture.name &&
            candidate.frontImageUri === frontBlob.uri &&
            candidate.backImageUri === backBlob.uri
        ) ??
          (yield* client[POSTCARD_DESIGNS_RPC_METHODS.create]({
            name: fixture.name,
            frontImageUri: frontBlob.uri,
            backImageUri: backBlob.uri
          }))

        const postcards = yield* client[SENT_POSTCARDS_RPC_METHODS.list]()
        if (
          !postcards.some(
            (postcard) =>
              postcard.postcardDesignId === design.id &&
              postcard.frontImageUri === frontBlob.uri &&
              postcard.backImageUri === backBlob.uri
          )
        ) {
          yield* client[SENT_POSTCARDS_RPC_METHODS.send]({
            postcardDesignId: design.id,
            frontImageUri: frontBlob.uri,
            backImageUri: backBlob.uri
          })
        }
      }),
    { concurrency: 1, discard: true }
  )

  yield* Effect.logInfo(`Seeded postcard fixtures at ${apiUrl.origin}`)
}).pipe(Effect.provide(RpcLive))

NodeRuntime.runMain(Effect.scoped(seed))
