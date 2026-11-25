import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("App routing", () => {
  const routes = [
    "/",
    "/register",
    "/admin-login",
    "/portal",
    "/portal/info",
    "/portal/courses",
    "/portal/registration",
    "/portal/grades",
    "/portal/documents",
    "/portal/events",
    "/admin",
    "/admin/students",
    "/admin/academic",
    "/admin/documents",
    "/admin/events",
    "/admin/logs",
  ];

  for (const path of routes) {
    it(`matches route ${path} without falling back to root`, () => {
      const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
      const matches = router.matchRoutes(path);
      expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
    });
  }
});
