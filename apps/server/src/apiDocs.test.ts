import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";

import { apiDocsRouteLayer } from "./apiDocs.ts";

const withHandler = <A>(use: (handler: (request: Request) => Promise<Response>) => Promise<A>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => HttpRouter.toWebHandler(apiDocsRouteLayer, { disableLogger: true })),
    (web) => Effect.tryPromise(() => use((request) => web.handler(request))),
    (web) => Effect.promise(() => web.dispose()),
  );

it.effect("serves the generated OpenAPI document without authentication", () =>
  withHandler(async (handler) => {
    const response = await handler(new Request("http://127.0.0.1/api/openapi.json"));
    expect(response.status).toBe(200);
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, unknown>;
    };
    expect(document.openapi).toMatch(/^3\./);
    expect(Object.keys(document.paths)).toEqual(
      expect.arrayContaining([
        "/api/orchestration/shell",
        "/api/orchestration/threads/launch",
        "/oauth/token",
      ]),
    );
  }),
);

it.effect("serves the API reference page without authentication", () =>
  withHandler(async (handler) => {
    const response = await handler(new Request("http://127.0.0.1/api/docs"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
  }),
);
