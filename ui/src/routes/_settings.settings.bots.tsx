import { createFileRoute, redirect } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/auth/queries";

export const Route = createFileRoute("/_settings/settings/bots")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions());
    if (!user.capabilities.includes("system.manageUsers")) {
      throw redirect({
        to: "/files",
        search: { path: "/", query: "", view: "list" },
        replace: true,
      });
    }
    throw redirect({ to: "/one", search: { tab: "bots" }, replace: true });
  },
  component: () => null,
});
