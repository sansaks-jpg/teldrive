import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/storage")({
  beforeLoad: () => {
    throw redirect({ to: "/drive/storage", replace: true });
  },
});
