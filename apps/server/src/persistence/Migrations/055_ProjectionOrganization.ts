import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_organization (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
});
