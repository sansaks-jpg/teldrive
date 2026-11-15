import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/files")({
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: ({ search }) => {
    throw redirect({
      to: "/drive/files",
      search: {
        path: typeof search.path === "string" && search.path ? search.path : "/",
        parentId: typeof search.parentId === "string" ? search.parentId : undefined,
        query: typeof search.query === "string" ? search.query : "",
        view: search.view === "grid" ? "grid" : "list",
        bookmarked: search.bookmarked === true || search.bookmarked === "true" ? true : undefined,
        recent: search.recent === true || search.recent === "true" ? true : undefined,
      },
      replace: true,
    });
  },
});
