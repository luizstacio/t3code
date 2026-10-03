import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  // IF NOT EXISTS preserves state created by the original workspace fork's
  // colliding migration 55 while allowing upstream V2 migrations to run.
  yield* sql`
    CREATE TABLE IF NOT EXISTS projection_organization (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `;
  yield* sql`
    CREATE INDEX IF NOT EXISTS idx_orchestration_events_application_high_water_v2
    ON orchestration_events(sequence)
    WHERE aggregate_kind = 'organization'
      OR aggregate_kind = 'project'
      OR (application_event_version = 2 AND aggregate_kind = 'thread')
  `;
});
