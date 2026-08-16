import {
  POSTCARD_DESIGNS_RPC_METHODS,
  PostcardsRpc,
  SENT_POSTCARDS_RPC_METHODS
} from "@post-cards/contracts"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Test from "alchemy/Test/Vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient"
import * as HttpBody from "effect/unstable/http/HttpBody"
import * as HttpClient from "effect/unstable/http/HttpClient"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import { expect } from "vitest"
import Stack from "../alchemy.run.ts"

const live = process.env.INTEGRATION_LIVE === "true"
const stage = process.env.STAGE ?? (live ? "test" : "local")

const { beforeAll, deploy, test } = Test.make({
  providers: Layer.mergeAll(
    Cloudflare.providers(),
    GitHub.providers()
  ),
  state: Cloudflare.state(),
  stage,
  dev: !live
})

const stack = beforeAll(deploy(Stack))

test(
  "serves the health endpoint",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const response = yield* HttpClient.get(
      new URL("/health", workerUrl).toString()
    )

    expect(response.status).toBe(200)
    expect(yield* response.json).toEqual({
      name: "post-cards-server",
      status: "ok"
    })
  })
)

test.skipIf(stage === "prod")(
  "round-trips an image through R2",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const image = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ])
    const upload = yield* HttpClient.post(
      new URL("/blobs", workerUrl).toString(),
      { body: HttpBody.uint8Array(image, "image/png") }
    )

    expect(upload.status).toBe(201)
    const location = upload.headers.location
    expect(location).toMatch(/^\/blobs\//)

    const download = yield* HttpClient.get(
      new URL(location!, workerUrl).toString()
    )
    expect(download.status).toBe(200)
    expect(new Uint8Array(yield* download.arrayBuffer)).toEqual(image)
  })
)

test(
  "queries both D1-backed RPC collections",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const RpcLive = RpcClient.layerProtocolHttp({
      url: new URL("/rpc", workerUrl).toString()
    }).pipe(
      Layer.provide([
        FetchHttpClient.layer,
        RpcSerialization.layerJson
      ])
    )

    yield* Effect.gen(function*() {
      const client = yield* RpcClient.make(PostcardsRpc)
      const [designs, postcards] = yield* Effect.all([
        client[POSTCARD_DESIGNS_RPC_METHODS.list](),
        client[SENT_POSTCARDS_RPC_METHODS.list]()
      ])

      expect(Array.isArray(designs)).toBe(true)
      expect(Array.isArray(postcards)).toBe(true)
    }).pipe(Effect.scoped, Effect.provide(RpcLive))
  })
)
