import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/shared-with-me")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/drive/shared-with-me", search: search as never, replace: true });
  },
});
