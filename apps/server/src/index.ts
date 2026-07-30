import { createServer } from "node:http"
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { ApiLive } from "./app.js"
import { Database } from "./database.js"
import { Postcards } from "./postcards.js"

const ServerLive = HttpRouter.serve(ApiLive).pipe(
  Layer.provide(Postcards.layer),
  Layer.provide(Database.layer),
  Layer.provide(
    NodeHttpServer.layerConfig(createServer, {
      port: Config.port("PORT").pipe(Config.withDefault(3000))
    })
  )
)

Layer.launch(ServerLive).pipe(NodeRuntime.runMain)
