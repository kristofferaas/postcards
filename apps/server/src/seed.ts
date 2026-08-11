import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { seedPostcardsLive } from "./seed-program.ts"

NodeRuntime.runMain(seedPostcardsLive)
