import { EnvironmentHttpApi } from "@t3tools/contracts";
import * as Layer from "effect/Layer";
import * as HttpApiScalar from "effect/unstable/httpapi/HttpApiScalar";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";
import * as Effect from "effect/Effect";
import * as OpenApi from "effect/unstable/httpapi/OpenApi";

/**
 * Serves the environment API's machine-readable description. Both routes are
 * unauthenticated, like the /.well-known descriptor: the document describes
 * the API shape and carries no environment state, and external clients need
 * it before they have paired. Under /api so the dev proxy forwards it and the
 * SPA catch-all never shadows it.
 */
export const apiDocsRouteLayer = Layer.mergeAll(
  HttpRouter.use(
    Effect.fnUntraced(function* (router) {
      // Built on first request: the document is static for a server version.
      let response: HttpServerResponse.HttpServerResponse | undefined;
      yield* router.add(
        "GET",
        "/api/openapi.json",
        Effect.sync(() => {
          response ??= HttpServerResponse.jsonUnsafe(OpenApi.fromApi(EnvironmentHttpApi));
          return response;
        }),
      );
    }),
  ),
  HttpApiScalar.layer(EnvironmentHttpApi, { path: "/api/docs" }),
);
