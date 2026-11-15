import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shared")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/drive/shared", search: search as never, replace: true });
  },
});
