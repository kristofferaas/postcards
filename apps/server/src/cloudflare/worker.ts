import { BetterAuth } from "@alchemy.run/better-auth"
import { CloudflareD1 } from "@alchemy.run/better-auth/CloudflareD1"
import * as Cloudflare from "alchemy/Cloudflare"
import * as SQL from "alchemy/SQL/D1"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { ApiLive } from "../app.ts"
import {
  DEVELOPMENT_APPLE_TEAM_ID,
  androidAssetLinks,
  appleAppId,
  authOptions
} from "../auth.ts"
import {
  BlobStorage,
  BlobStorageUnavailable
} from "../blob-storage.ts"
import { PostcardDesigns } from "../postcard-designs.ts"
import { SentPostcards } from "../sent-postcards.ts"
import { Bucket } from "./bucket.ts"
import { Database } from "./database.ts"

const isProduction = process.env.STAGE === "prod"
const authTestMode =
  !isProduction &&
  (process.env.ALCHEMY_DEV === "true" ||
    process.env.INTEGRATION_LIVE === "true")
const testAndroidCertFingerprint = Array.from(
  { length: 32 },
  () => "00"
).join(":")

if (isProduction && !process.env.APPLE_TEAM_ID?.trim()) {
  throw new Error("APPLE_TEAM_ID is required for production deploys.")
}

if (
  isProduction &&
  !process.env.ANDROID_CERT_FINGERPRINTS?.trim()
) {
  throw new Error(
    "ANDROID_CERT_FINGERPRINTS is required for production deploys."
  )
}

const unavailable = (cause: unknown) =>
  new BlobStorageUnavailable({
    cause: String(cause),
    message: "The R2 bucket operation failed."
  })

export default Cloudflare.Worker(
  "Worker",
  {
    dev: { port: 3000 },
    main: import.meta.url,
    compatibility: { flags: ["nodejs_compat"] },
    env: {
      PUBLIC_URL: Cloudflare.Worker.URL,
      APPLE_TEAM_ID:
        process.env.APPLE_TEAM_ID?.trim() || DEVELOPMENT_APPLE_TEAM_ID,
      ANDROID_CERT_FINGERPRINTS:
        process.env.ANDROID_CERT_FINGERPRINTS?.trim() ||
        (authTestMode ? testAndroidCertFingerprint : ""),
      AUTH_TEST_MODE: authTestMode ? "true" : "false"
    }
  },
  Effect.gen(function*() {
    const bucket = yield* Cloudflare.R2.ReadWriteBucket(Bucket)
    const database = yield* Cloudflare.D1.QueryDatabase(Database)
    const auth = yield* BetterAuth(authOptions)

    return {
      fetch: Effect.gen(function*() {
        const request = yield* HttpServerRequest.HttpServerRequest
        const pathname = new URL(request.url, "http://localhost").pathname

        if (
          pathname === "/.well-known/apple-app-site-association" ||
          pathname === "/apple-app-site-association"
        ) {
          return HttpServerResponse.jsonUnsafe(
            { webcredentials: { apps: [appleAppId] } },
            {
              headers: { "cache-control": "public, max-age=3600" }
            }
          )
        }

        if (pathname === "/.well-known/assetlinks.json") {
          if (androidAssetLinks.length === 0) {
            return HttpServerResponse.jsonUnsafe(
              { error: "AndroidAppAssociationNotConfigured" },
              { status: 503 }
            )
          }

          return HttpServerResponse.jsonUnsafe(androidAssetLinks, {
            headers: { "cache-control": "public, max-age=3600" }
          })
        }

        if (pathname.startsWith("/api/auth")) {
          return yield* auth.fetch
        }

        const session = yield* auth.getSession().pipe(
          Effect.catchTag("BetterAuthApiError", () => Effect.succeed(null))
        )
        const isProtected =
          pathname === "/rpc" ||
          (pathname === "/blobs" && request.method === "POST")

        if (isProtected && session === null) {
          return HttpServerResponse.jsonUnsafe(
            { error: "Unauthorized" },
            { status: 401 }
          )
        }

        const rawBucket = yield* bucket.raw
        const rawDatabase = yield* database.raw
        const BlobStorageLive = BlobStorage.layer({
          get: (key) =>
            Effect.tryPromise({
              try: async () => {
                const object = await rawBucket.get(key)
                return object === null
                  ? null
                  : new Uint8Array(await object.arrayBuffer())
              },
              catch: unavailable
            }),
          head: (key) =>
            Effect.tryPromise({
              try: async () => (await rawBucket.head(key)) !== null,
              catch: unavailable
            }),
          put: (key, data) =>
            Effect.tryPromise({
              try: async () => {
                await rawBucket.put(key, data)
              },
              catch: unavailable
            })
        })

        const AppLive = ApiLive(session?.user.id ?? "").pipe(
          Layer.provide(PostcardDesigns.layer),
          Layer.provide(SentPostcards.layer),
          Layer.provide(BlobStorageLive),
          Layer.provide(SQL.D1Layer(Effect.succeed(rawDatabase)))
        )
        const handler = yield* HttpRouter.toHttpEffect(AppLive)
        return yield* handler.pipe(
          Effect.catchTag("SchemaError", () =>
            Effect.succeed(
              HttpServerResponse.jsonUnsafe(
                { error: "InvalidRequest" },
                { status: 400 }
              )
            )
          )
        )
      })
    }
  }).pipe(
    Effect.provide([
      CloudflareD1(Database),
      Cloudflare.D1.QueryDatabaseBinding,
      Cloudflare.R2.ReadWriteBucketBinding
    ])
  )
)
