import * as Effect from "effect/Effect"
import { SqlClient } from "effect/unstable/sql"

export const createPostcardDesignsAndSentPostcards = Effect.gen(function*() {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE postcard_designs (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      front_image_uri TEXT NOT NULL,
      back_image_uri TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `

  yield* sql`
    CREATE TABLE sent_postcards (
      id INTEGER PRIMARY KEY,
      postcard_design_id INTEGER NOT NULL,
      front_image_uri TEXT NOT NULL,
      back_image_uri TEXT NOT NULL,
      sent_at TEXT NOT NULL,
      opened_at TEXT,
      FOREIGN KEY (postcard_design_id) REFERENCES postcard_designs(id)
    )
  `

  yield* sql`
    CREATE INDEX sent_postcards_postcard_design_id_idx
    ON sent_postcards(postcard_design_id)
  `
})
