import { createFileRoute } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { Route as LegacyDashboardRoute } from "./app/index";

const LegacyDashboard = LegacyDashboardRoute.options.component as ComponentType;

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Visitor Flow" }] }),
  component: DashboardRoute,
});

function DashboardRoute() {
  return <LegacyDashboard />;
}
