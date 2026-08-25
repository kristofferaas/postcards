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
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"

const apiUrlArgument = process.argv
  .slice(2)
  .find((argument) => argument !== "--")
if (apiUrlArgument === undefined) {
  throw new Error(
    "Usage: POSTCARDS_SESSION_COOKIE='better-auth.session_token=...' " +
      "pnpm data:seed -- https://your-worker.workers.dev"
  )
}

const apiUrl = new URL(apiUrlArgument)
const sessionCookie = process.env.POSTCARDS_SESSION_COOKIE
if (sessionCookie === undefined || sessionCookie.trim() === "") {
  throw new Error("POSTCARDS_SESSION_COOKIE is required to seed the API.")
}

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

class SeedUploadFailed extends Schema.TaggedError<SeedUploadFailed>()(
  "SeedUploadFailed",
  { status: Schema.Number }
) {}

const upload = Effect.fn("Seed.upload")(function*(fixture: ImageFixture) {
  const data = yield* Effect.tryPromise(() => readFile(fixture.url))
  const response = yield* HttpClient.execute(
    HttpClientRequest.post(
      new URL("/blobs", apiUrl).toString()
    ).pipe(
      HttpClientRequest.setHeader("cookie", sessionCookie),
      HttpClientRequest.setBody(
        HttpBody.uint8Array(data, fixture.contentType)
      )
    )
  )

  if (response.status < 200 || response.status >= 300) {
    return yield* new SeedUploadFailed({ status: response.status })
  }

  const payload = yield* response.json
  return yield* Schema.decodeUnknownEffect(StoredBlob)(payload)
})

const RpcLive = RpcClient.layerProtocolHttp({
  url: new URL("/rpc", apiUrl).toString(),
  transformClient: HttpClient.mapRequest(
    HttpClientRequest.setHeader("cookie", sessionCookie)
  )
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
}).pipe(Effect.provide([RpcLive, NodeHttpClient.layerUndici]))

NodeRuntime.runMain(Effect.scoped(seed))
