// Tests use Node's built-in runner and assertion library.
// @effect-diagnostics effect/nodeBuiltinImport:off
import assert from "node:assert/strict"
import test from "node:test"
// @effect-diagnostics effect/nodeBuiltinImport:error
import { BlobUri } from "@post-cards/contracts"
import * as Effect from "effect/Effect"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import {
  BlobStorage,
  BlobStorageUnavailable,
  type BlobBucket
} from "./blob-storage.ts"

const makeBucket = () => {
  const objects = new Map<string, Uint8Array>()
  const bucket: BlobBucket = {
    get: (key) => Effect.succeed(objects.get(key) ?? null),
    head: (key) => Effect.succeed(objects.has(key)),
    put: (key, data) =>
      Effect.sync(() => {
        objects.set(key, data)
      })
  }
  return { bucket, objects }
}

test("stores image blobs under a deterministic content-addressed URI", async () => {
  const { bucket, objects } = makeBucket()
  const data = new TextEncoder().encode("postcard")
  const program = Effect.gen(function*() {
    const storage = yield* BlobStorage
    const first = yield* storage.put(data, "image/png; charset=binary")
    const second = yield* storage.put(data, "image/png")
    const loaded = yield* storage.get(first.uri)
    return { first, loaded, second }
  }).pipe(Effect.provide(BlobStorage.layer(bucket)))

  const result = await Effect.runPromise(program)

  assert.equal(result.first.uri, result.second.uri)
  assert.equal(Schema.is(BlobUri)(result.first.uri), true)
  assert.equal(result.loaded.contentType, "image/png")
  assert.deepEqual(result.loaded.data, data)
  assert.equal(objects.size, 1)
})

test("rejects unsupported image types before writing to the bucket", async () => {
  const { bucket, objects } = makeBucket()
  const result = await Effect.runPromise(
    Effect.gen(function*() {
      const storage = yield* BlobStorage
      return yield* storage.put(new Uint8Array([1]), "text/plain")
    }).pipe(Effect.provide(BlobStorage.layer(bucket)), Effect.result)
  )

  assert.equal(Result.isFailure(result), true)
  if (Result.isFailure(result)) {
    assert.equal(result.failure._tag, "UnsupportedImageContentType")
  }
  assert.equal(objects.size, 0)
})

test("surfaces bucket failures without exposing an infrastructure type", async () => {
  const unavailable = new BlobStorageUnavailable({
    cause: "R2 unavailable",
    message: "The bucket operation failed."
  })
  const bucket: BlobBucket = {
    get: () => Effect.fail(unavailable),
    head: () => Effect.fail(unavailable),
    put: () => Effect.fail(unavailable)
  }

  const result = await Effect.runPromise(
    Effect.gen(function*() {
      const storage = yield* BlobStorage
      return yield* storage.get(
        "/blobs/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.jpg" as BlobUri
      )
    }).pipe(Effect.provide(BlobStorage.layer(bucket)), Effect.result)
  )

  assert.equal(Result.isFailure(result), true)
  if (Result.isFailure(result)) {
    assert.equal(result.failure._tag, "BlobStorageUnavailable")
  }
})
