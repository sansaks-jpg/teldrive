import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/trash")({
  beforeLoad: () => {
    throw redirect({ to: "/drive/trash", replace: true });
  },
});
