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
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest"
import * as RpcClient from "effect/unstable/rpc/RpcClient"
import * as RpcSerialization from "effect/unstable/rpc/RpcSerialization"
import { expect } from "vitest"
import Stack from "../alchemy.run.ts"
import { APPLE_TEAM_ID } from "../src/auth.ts"

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

const sessionCookie = Effect.fn("Integration.sessionCookie")(
  function*(workerUrl: string) {
    const response = yield* HttpClient.post(
      new URL("/api/auth/auth-test/session", workerUrl).toString(),
      { body: HttpBody.jsonUnsafe({ name: "Integration Test" }) }
    )
    expect(response.status).toBe(200)

    const cookie = response.headers["set-cookie"]?.split(";")[0]
    expect(cookie).toBeTruthy()
    return cookie!
  }
)

const authUserCount = Effect.fn("Integration.authUserCount")(
  function*(workerUrl: string) {
    const response = yield* HttpClient.get(
      new URL("/api/auth/auth-test/user-count", workerUrl).toString()
    )
    expect(response.status).toBe(200)
    const payload = (yield* response.json) as { count: number }
    return payload.count
  }
)

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

test(
  "serves the Apple passkey association",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const response = yield* HttpClient.get(
      new URL(
        "/.well-known/apple-app-site-association",
        workerUrl
      ).toString()
    )

    expect(response.status).toBe(200)
    expect(yield* response.json).toEqual({
      webcredentials: {
        apps: [
          `${APPLE_TEAM_ID}.com.kristofferaas.postcards`
        ]
      }
    })
  })
)

test(
  "rejects protected API requests without a session",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const image = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ])
    const upload = yield* Test.executeWhenReady(
      HttpClientRequest.post(new URL("/blobs", workerUrl).toString()).pipe(
        HttpClientRequest.setBody(
          HttpBody.uint8Array(image, "image/png")
        )
      )
    )

    expect(upload.status).toBe(401)

    const rpc = yield* Test.executeWhenReady(
      HttpClientRequest.post(new URL("/rpc", workerUrl).toString()).pipe(
        HttpClientRequest.setBody(HttpBody.jsonUnsafe({}))
      )
    )
    expect(rpc.status).toBe(401)
  })
)

test(
  "starts a passwordless passkey registration ceremony",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const workerOrigin = workerUrl!
    const usersBefore =
      stage === "prod" ? undefined : yield* authUserCount(workerOrigin)
    const start = yield* Test.executeWhenReady(
      HttpClientRequest.post(
        new URL(
          "/api/auth/passkey-registration/start",
          workerOrigin
        ).toString()
      ).pipe(
        HttpClientRequest.setBody(
          HttpBody.jsonUnsafe({ name: "Integration Test" })
        )
      )
    )
    expect(start.status).toBe(200)

    const { context } = (yield* start.json) as { context: string }
    expect(context).toBeTruthy()

    const optionsUrl = new URL(
      "/api/auth/passkey/generate-register-options",
      workerOrigin
    )
    optionsUrl.searchParams.set("context", context)
    optionsUrl.searchParams.set("name", "Primary passkey")
    const options = yield* Test.executeWhenReady(
      HttpClientRequest.get(optionsUrl.toString())
    )

    expect(options.status).toBe(200)
    expect(options.headers["set-cookie"]).toContain(
      "better-auth.better-auth-passkey"
    )
    expect(yield* options.json).toMatchObject({
      rp: {
        id: new URL(workerOrigin).hostname,
        name: "Post Cards"
      },
      user: { displayName: "Integration Test" }
    })

    const prematureCompletion = yield* Test.executeWhenReady(
      HttpClientRequest.post(
        new URL(
          "/api/auth/passkey-registration/complete",
          workerOrigin
        ).toString()
      ).pipe(
        HttpClientRequest.setBody(
          HttpBody.jsonUnsafe({ context })
        )
      )
    )
    expect(prematureCompletion.status).toBe(400)

    if (usersBefore !== undefined) {
      expect(yield* authUserCount(workerOrigin)).toBe(usersBefore)
    }
  })
)

test.skipIf(stage === "prod")(
  "round-trips an authenticated image through R2",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const workerOrigin = workerUrl!
    const cookie = yield* sessionCookie(workerOrigin)
    const image = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    ])
    const upload = yield* HttpClient.execute(
      HttpClientRequest.post(
        new URL("/blobs", workerOrigin).toString()
      ).pipe(
        HttpClientRequest.setHeader("cookie", cookie),
        HttpClientRequest.setBody(
          HttpBody.uint8Array(image, "image/png")
        )
      )
    )

    expect(upload.status).toBe(201)
    const location = upload.headers.location
    expect(location).toMatch(/^\/blobs\//)

    const download = yield* HttpClient.get(
      new URL(location!, workerOrigin).toString()
    )
    expect(download.status).toBe(200)
    expect(new Uint8Array(yield* download.arrayBuffer)).toEqual(image)
  })
)

test.skipIf(stage === "prod")(
  "queries both authenticated D1-backed RPC collections",
  Effect.gen(function*() {
    const { workerUrl } = yield* stack
    const workerOrigin = workerUrl!
    const cookie = yield* sessionCookie(workerOrigin)
    const RpcLive = RpcClient.layerProtocolHttp({
      url: new URL("/rpc", workerOrigin).toString(),
      transformClient: HttpClient.mapRequest(
        HttpClientRequest.setHeader("cookie", cookie)
      )
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
