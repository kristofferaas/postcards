import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import { BlobStorage } from "./blob-storage.ts"
import { Database } from "./database.ts"
import { nodeEnvironment } from "./data-config.ts"
import { PostcardDesigns } from "./postcard-designs.ts"
import { SentPostcards } from "./sent-postcards.ts"

class ProductionSeedError extends Schema.TaggedErrorClass<ProductionSeedError>()(
  "ProductionSeedError",
  {
    message: Schema.String
  }
) {}

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

const seedPostcard = Effect.fn("Seed.seedPostcard")(function*(
  fixture: PostcardFixture
) {
  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const blobStorage = yield* BlobStorage
  const postcardDesigns = yield* PostcardDesigns
  const sentPostcards = yield* SentPostcards

  const [frontPath, backPath] = yield* Effect.all([
    path.fromFileUrl(fixture.front.url),
    path.fromFileUrl(fixture.back.url)
  ])
  const [frontData, backData] = yield* Effect.all([
    fileSystem.readFile(frontPath),
    fileSystem.readFile(backPath)
  ])
  const [frontBlob, backBlob] = yield* Effect.all([
    blobStorage.put(frontData, fixture.front.contentType),
    blobStorage.put(backData, fixture.back.contentType)
  ])

  const designs = yield* postcardDesigns.all()
  const design = designs.find(
    (candidate) =>
      candidate.name === fixture.name &&
      candidate.frontImageUri === frontBlob.uri &&
      candidate.backImageUri === backBlob.uri
  ) ??
    (yield* postcardDesigns.create({
      name: fixture.name,
      frontImageUri: frontBlob.uri,
      backImageUri: backBlob.uri
    }))

  const postcards = yield* sentPostcards.all()
  if (
    !postcards.some(
      (postcard) =>
        postcard.postcardDesignId === design.id &&
        postcard.frontImageUri === frontBlob.uri &&
        postcard.backImageUri === backBlob.uri
    )
  ) {
    yield* sentPostcards.send({
      postcardDesignId: design.id,
      frontImageUri: frontBlob.uri,
      backImageUri: backBlob.uri
    })
  }
})

const seedPostcards = Effect.gen(function*() {
  const environment = yield* nodeEnvironment

  if (environment === "production") {
    return yield* new ProductionSeedError({
      message: "Refusing to seed postcards when NODE_ENV is production."
    })
  }

  yield* Effect.forEach(postcardFixtures, seedPostcard, {
    concurrency: 1,
    discard: true
  })

  const database = yield* Database
  yield* Effect.logInfo(`Seeded postcard fixtures in ${database.filename}`)
})

const InfrastructureLive = Layer.mergeAll(
  BlobStorage.localLayer,
  Database.layer
)

const SeedServicesLive = Layer.mergeAll(
  PostcardDesigns.layer,
  SentPostcards.layer
).pipe(Layer.provideMerge(InfrastructureLive))

const SeedLive = Layer.mergeAll(
  SeedServicesLive,
  NodeFileSystem.layer,
  NodePath.layer
)

export const seedPostcardsLive = seedPostcards.pipe(Effect.provide(SeedLive))
