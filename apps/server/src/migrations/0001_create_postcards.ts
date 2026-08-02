import { Effect } from "effect"
import { SqlClient } from "effect/unstable/sql"

export const createPostcards = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE postcards (
      sent_at TEXT,
      opened_at TEXT,
      front_image TEXT NOT NULL
    )
  `
})
