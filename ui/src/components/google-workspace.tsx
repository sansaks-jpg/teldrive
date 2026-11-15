import { cn } from "@heroui/react";

export type WorkspaceAppId = "drive" | "photos" | "one" | "docs";

export type WorkspaceAction =
  | "drive:new-folder"
  | "drive:upload-files"
  | "drive:upload-folder"
  | "drive:background-upload"
  | "photos:new-album"
  | "photos:upload";

const WORKSPACE_ACTION_EVENT = "teldrive:workspace-action";

export function dispatchWorkspaceAction(action: WorkspaceAction) {
  window.dispatchEvent(
    new CustomEvent<WorkspaceAction>(WORKSPACE_ACTION_EVENT, { detail: action }),
  );
}

export function subscribeWorkspaceAction(handler: (action: WorkspaceAction) => void) {
  const listener = (event: Event) => {
    const custom = event as CustomEvent<WorkspaceAction>;
    if (custom.detail) handler(custom.detail);
  };
  window.addEventListener(WORKSPACE_ACTION_EVENT, listener);
  return () => window.removeEventListener(WORKSPACE_ACTION_EVENT, listener);
}

export function normalizeAppPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

export function getWorkspaceApp(pathname: string): WorkspaceAppId {
  const normalized = normalizeAppPath(pathname);
  if (normalized === "/photos" || normalized.startsWith("/photos/")) return "photos";
  if (normalized === "/docs" || normalized.startsWith("/docs/")) return "docs";
  if (
    normalized === "/one" ||
    normalized.startsWith("/one/") ||
    normalized === "/admin" ||
    normalized.startsWith("/admin/")
  ) {
    return "one";
  }
  if (normalized === "/drive" || normalized.startsWith("/drive/")) return "drive";
  return "drive";
}

export function WaffleGridIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-5", className)}
    >
      <circle cx="5" cy="5" r="1.8" />
      <circle cx="12" cy="5" r="1.8" />
      <circle cx="19" cy="5" r="1.8" />
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
      <circle cx="5" cy="19" r="1.8" />
      <circle cx="12" cy="19" r="1.8" />
      <circle cx="19" cy="19" r="1.8" />
    </svg>
  );
}

export function GoogleDriveBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <path
        fill="#0066DA"
        d="M4.3 18.8 1.9 14.6a1.5 1.5 0 0 1 0-1.5L7.6 3.3a1.5 1.5 0 0 1 1.3-.8h3.3l-5.8 10L4.3 18.8Z"
      />
      <path fill="#00AC47" d="M12.2 2.5h2.9a1.5 1.5 0 0 1 1.3.8l5.7 9.8-3.6 2-6.3-11.1V2.5Z" />
      <path
        fill="#FFBA00"
        d="M22.1 13.1c.2.5.2 1.1-.1 1.6l-2.3 4a1.5 1.5 0 0 1-1.3.8h-9l2.4-4.2h7.9l2.4-2.2Z"
      />
      <path fill="#00832D" d="M8.9 2.5 14.8 13l-2.8 2.3H6.4L1.9 13.8l7-11.3Z" opacity="0.22" />
      <path fill="#2684FC" d="M4.3 18.8a1.5 1.5 0 0 0 1.3.7h5l1.6-4.2H6.4l-2.1 3.5Z" />
      <path fill="#EA4335" d="m17.5 15.3 4.6-2.2c.2.5.2 1.1-.1 1.6l-1 1.8-3.5-1.2Z" />
    </svg>
  );
}

export function GooglePhotosBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <path fill="#EA4335" d="M12 12V3.5a4.5 4.5 0 0 0-4.5 4.5V12H12Z" />
      <path fill="#FBBC04" d="M12 12h8.5A4.5 4.5 0 0 0 16 7.5H12V12Z" />
      <path fill="#34A853" d="M12 12v8.5a4.5 4.5 0 0 0 4.5-4.5V12H12Z" />
      <path fill="#4285F4" d="M12 12H3.5A4.5 4.5 0 0 0 8 16.5H12V12Z" />
    </svg>
  );
}

export function GoogleOneBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <path
        fill="#EA4335"
        d="M12.2 3.4a2.2 2.2 0 0 1 2.2 2.2V9.5l-4.4 3.1V6.6l-.8.6a2 2 0 1 1-2.4-3.2l4-3a2.2 2.2 0 0 1 1.4-.4Z"
        transform="translate(0 1)"
      />
      <path fill="#4285F4" d="M10 13.6V19a2.2 2.2 0 0 0 4.4 0v-8.5L10 13.6Z" />
      <path
        fill="#FBBC04"
        d="M5.6 10.1a2.1 2.1 0 0 0 2.9.5L10 9.5v4.1l-4.4 2.1v-5.6Z"
        opacity="0.9"
      />
      <path fill="#34A853" d="M10 19a2.2 2.2 0 0 0 4.4 0v-2.4l-4.4 2v.4Z" />
    </svg>
  );
}

export function GoogleDocsBrandIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-6", className)}>
      <path
        fill="#4285F4"
        d="M6.5 2.5h7.8l4.7 4.7V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4a1.5 1.5 0 0 1 1.5-1.5Z"
      />
      <path fill="#A1C2FA" d="M14.3 2.5v3.2a1.5 1.5 0 0 0 1.5 1.5H19l-4.7-4.7Z" />
      <path fill="#FFFFFF" d="M8 10.5h8v1.4H8v-1.4Zm0 3h8v1.4H8v-1.4Zm0 3h5.5v1.4H8v-1.4Z" />
    </svg>
  );
}

export type StorageSegment = {
  id: string;
  label: string;
  bytes: number;
  colorClass: string;
  dotClass: string;
};

export function GoogleOneSegmentedBar({
  segments,
  totalBytes,
  formatBytes,
}: {
  segments: StorageSegment[];
  totalBytes: number;
  formatBytes: (bytes: number) => string;
}) {
  const nonZero = segments.filter((segment) => segment.bytes > 0);
  const safeTotal = Math.max(1, totalBytes);

  return (
    <div className="space-y-2.5">
      <div className="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-[#e1e5ea] dark:bg-[#333538]">
        {nonZero.map((segment) => {
          const pct = Math.min(100, (segment.bytes / safeTotal) * 100);
          return (
            <div
              key={segment.id}
              title={`${segment.label}: ${formatBytes(segment.bytes)}`}
              style={{ width: `${pct}%`, minWidth: "5px" }}
              className={cn(
                "h-full first:rounded-l-full last:rounded-r-full transition-[width] duration-300",
                segment.colorClass,
              )}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
        {segments.map((segment) => (
          <div key={segment.id} className="flex items-center gap-1.5 text-muted">
            <span className={cn("size-2 shrink-0 rounded-full", segment.dotClass)} />
            <span className="font-medium text-foreground">{segment.label}</span>
            <span className="tabular-nums">{formatBytes(segment.bytes)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
