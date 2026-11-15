import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tasks_/$id")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/drive/tasks/$id", params, replace: true });
  },
});
