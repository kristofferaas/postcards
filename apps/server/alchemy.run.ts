import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as GitHub from "alchemy/GitHub"
import * as Output from "alchemy/Output"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { Bucket } from "./src/cloudflare/bucket.ts"
import { Database } from "./src/cloudflare/database.ts"
import Worker from "./src/cloudflare/worker.ts"

export default Alchemy.Stack(
  "Postcards",
  {
    providers: Layer.mergeAll(
      Cloudflare.providers(),
      GitHub.providers()
    ),
    state: Cloudflare.state()
  },
  Effect.gen(function*() {
    const stage = yield* Alchemy.Stage
    const retainData = stage === "prod"
    const bucket = yield* Bucket.pipe(
      Alchemy.RemovalPolicy.retain(retainData)
    )
    const database = yield* Database.pipe(
      Alchemy.RemovalPolicy.retain(retainData)
    )
    const worker = yield* Worker

    const pullRequest = process.env.PULL_REQUEST
    if (pullRequest !== undefined) {
      const issueNumber = Number(pullRequest)
      if (!Number.isSafeInteger(issueNumber) || issueNumber <= 0) {
        return yield* Effect.die(
          `Invalid PULL_REQUEST value: ${pullRequest}`
        )
      }

      yield* GitHub.Comment("PreviewComment", {
        owner: "kristofferaas",
        repository: "postcards",
        issueNumber,
        body: Output.interpolate`
          ## Cloudflare preview deployed

          **API:** ${worker.url}

          Built from commit ${process.env.GITHUB_SHA?.slice(0, 7) ?? "unknown"}.

          _This comment updates automatically when the pull request changes._
        `
      })
    }

    return {
      bucketName: bucket.bucketName,
      databaseName: database.databaseName,
      workerUrl: worker.url
    }
  })
)
