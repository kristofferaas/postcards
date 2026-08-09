import { createServer } from "node:http"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { ApiLive } from "./app.ts"
import { BlobStorage } from "./blob-storage.ts"
import { Database } from "./database.ts"
import { PostcardDesigns } from "./postcard-designs.ts"
import { SentPostcards } from "./sent-postcards.ts"

const ServerLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(PostcardDesigns.layer),
  Layer.provide(SentPostcards.layer),
  Layer.provide(BlobStorage.localLayer),
  Layer.provide(Database.layer),
  Layer.provide(
    NodeHttpServer.layerConfig(createServer, {
      port: Config.port("PORT").pipe(Config.withDefault(3000))
    })
  )
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
