import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as NodePath from "@effect/platform-node/NodePath"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Path from "effect/Path"
import * as Schema from "effect/Schema"
import {
  blobStoragePath,
  databasePath,
  nodeEnvironment
} from "./data-config.ts"
import { seedPostcardsLive } from "./seed-program.ts"

class DataResetRefused extends Schema.TaggedErrorClass<DataResetRefused>()(
  "DataResetRefused",
  {
    message: Schema.String
  }
) {}

const resetLocalData = Effect.gen(function*() {
  const environment = yield* nodeEnvironment
  if (environment === "production") {
    return yield* new DataResetRefused({
      message: "Refusing to reset postcard data when NODE_ENV is production."
    })
  }

  const fileSystem = yield* FileSystem.FileSystem
  const path = yield* Path.Path
  const workingDirectory = path.resolve(".")
  const databaseFilename = path.resolve(yield* databasePath)
  const blobRoot = path.resolve(yield* blobStoragePath)
  const localPrefix = `${workingDirectory}${path.sep}`

  if (
    !databaseFilename.startsWith(localPrefix) ||
    !blobRoot.startsWith(localPrefix)
  ) {
    return yield* new DataResetRefused({
      message:
        "Refusing to reset data outside the server package directory. Check DATABASE_PATH and BLOB_STORAGE_PATH."
    })
  }

  yield* Effect.all([
    fileSystem.remove(databaseFilename, { force: true }),
    fileSystem.remove(`${databaseFilename}-shm`, { force: true }),
    fileSystem.remove(`${databaseFilename}-wal`, { force: true }),
    fileSystem.remove(blobRoot, { force: true, recursive: true })
  ])

  yield* Effect.logInfo(
    `Reset local postcard data in ${databaseFilename} and ${blobRoot}`
  )
  yield* seedPostcardsLive
}).pipe(Effect.provide([NodeFileSystem.layer, NodePath.layer]))

NodeRuntime.runMain(resetLocalData)
