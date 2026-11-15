import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({
      to: "/drive/files",
      search: { path: "/", query: "", view: "list" },
      replace: true,
    });
  },
});
