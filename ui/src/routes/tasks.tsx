import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks")({
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/drive/tasks", search: search as never, replace: true });
  },
});
