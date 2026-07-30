import { Effect } from "effect"
import { SqlClient } from "effect/unstable/sql"

export const addPostcardDesign = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient

  yield* sql`ALTER TABLE postcards ADD COLUMN front_image TEXT NOT NULL DEFAULT 'fjord'`
  yield* sql`ALTER TABLE postcards ADD COLUMN caption TEXT NOT NULL DEFAULT ''`
  yield* sql`ALTER TABLE postcards ADD COLUMN caption_style TEXT NOT NULL DEFAULT 'classic'`
  yield* sql`ALTER TABLE postcards ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#ff6b4a'`
  yield* sql`ALTER TABLE postcards ADD COLUMN stamp TEXT NOT NULL DEFAULT '🌊'`
  yield* sql`ALTER TABLE postcards ADD COLUMN stickers TEXT NOT NULL DEFAULT '[]'`
})
