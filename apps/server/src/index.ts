// NodeHttpServer requires the native server constructor at the platform boundary.
// @effect-diagnostics effect/nodeBuiltinImport:off
import { createServer } from "node:http"
// @effect-diagnostics effect/nodeBuiltinImport:error
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Config from "effect/Config"
import * as Layer from "effect/Layer"
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
