import { createFileRoute, redirect } from "@tanstack/react-router";
import { currentUserQueryOptions } from "@/auth/queries";

export const Route = createFileRoute("/_settings/settings/periodic-jobs")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions());
    if (!user.capabilities.includes("system.manageUsers")) {
      throw redirect({
        to: "/drive/files",
        search: { path: "/", query: "", view: "list" },
        replace: true,
      });
    }
    throw redirect({ to: "/one", search: { tab: "jobs" }, replace: true });
  },
  component: () => null,
});
