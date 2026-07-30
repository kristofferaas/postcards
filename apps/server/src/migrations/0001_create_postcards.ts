import { Effect } from "effect"
import { SqlClient } from "effect/unstable/sql"

export const createPostcards = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE postcards (
      "to" TEXT NOT NULL,
      "from" TEXT NOT NULL,
      sent_at TEXT,
      opened_at TEXT,
      content TEXT NOT NULL
    )
  `
})
