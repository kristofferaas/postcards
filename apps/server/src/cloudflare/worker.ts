import * as Cloudflare from "alchemy/Cloudflare"
import * as SQL from "alchemy/SQL/D1"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse"
import { ApiLive } from "../app.ts"
import {
  BlobStorage,
  BlobStorageUnavailable
} from "../blob-storage.ts"
import { PostcardDesigns } from "../postcard-designs.ts"
import { SentPostcards } from "../sent-postcards.ts"
import { Bucket } from "./bucket.ts"
import { Database } from "./database.ts"

const unavailable = (cause: unknown) =>
  new BlobStorageUnavailable({
    cause: String(cause),
    message: "The R2 bucket operation failed."
  })

export default Cloudflare.Worker(
  "Worker",
  {
    dev: { port: 3000 },
    main: import.meta.url
  },
  Effect.gen(function*() {
    const bucket = yield* Cloudflare.R2.ReadWriteBucket(Bucket)
    const database = yield* Cloudflare.D1.QueryDatabase(Database)

    return {
      fetch: Effect.gen(function*() {
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

        const AppLive = ApiLive.pipe(
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
      Cloudflare.D1.QueryDatabaseBinding,
      Cloudflare.R2.ReadWriteBucketBinding
    ])
  )
)
