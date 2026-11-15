import { useEffect } from "react";
import { readPhotosSettings } from "@/lib/app-settings";
import { useUploadStore } from "./store";

// Shows one desktop notification when the upload queue drains, if the user enabled
// browser notifications in Photos settings and granted permission.
export function useUploadNotifications() {
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    let wasBusy = false;
    let completedAtStart = new Set<string>();
    return useUploadStore.subscribe((state) => {
      const busy = state.tasks.some(
        (task) => task.status === "queued" || task.status === "running",
      );
      if (busy && !wasBusy) {
        completedAtStart = new Set(
          state.tasks.filter((task) => task.status === "completed").map((task) => task.id),
        );
      }
      if (!busy && wasBusy) {
        const finished = state.tasks.filter(
          (task) => task.status === "completed" && !completedAtStart.has(task.id),
        );
        const failed = state.tasks.filter((task) => task.status === "failed").length;
        if (
          (finished.length > 0 || failed > 0) &&
          readPhotosSettings().browserNotifications &&
          Notification.permission === "granted"
        ) {
          const title = failed > 0 ? "Uploads finished with errors" : "Uploads finished";
          const body =
            finished.length === 1 && failed === 0
              ? finished[0].name
              : `${finished.length} uploaded${failed > 0 ? `, ${failed} failed` : ""}`;
          try {
            new Notification(title, { body, tag: "teldrive-uploads" });
          } catch {
            // Some browsers only allow notifications from a service worker.
          }
        }
      }
      wasBusy = busy;
    });
  }, []);
}
