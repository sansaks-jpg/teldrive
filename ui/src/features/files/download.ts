import { zipSync } from "fflate";
import { toast } from "sonner";
import { fetchClient } from "@/api/client";
import type { FileEntry } from "@/api/types";

export function fileContentUrl(file: Pick<FileEntry, "id" | "name">, download = false) {
  const path = `/api/v1/files/${encodeURIComponent(file.id)}/content/${encodeURIComponent(file.name)}`;
  return download ? `${path}?download=1` : path;
}

export function startFileDownload(
  file: Pick<FileEntry, "id" | "name">,
  downloadUrl = fileContentUrl(file, true),
) {
  const anchor = document.createElement("a");
  anchor.href = downloadUrl;
  anchor.download = file.name;
  anchor.click();
}

async function listFolderChildren(parentId: string): Promise<FileEntry[]> {
  const items: FileEntry[] = [];
  let cursor: string | undefined;
  do {
    const { data, error } = await fetchClient.GET("/v1/files", {
      params: {
        query: {
          parentId,
          limit: 200,
          cursor,
        },
      },
    });
    if (error || !data) throw new Error("Failed to list folder contents");
    items.push(...data.items);
    cursor = data.nextCursor ?? undefined;
  } while (cursor);
  return items;
}

async function collectFilesForZip(
  entries: FileEntry[],
  prefix = "",
): Promise<Array<{ path: string; entry?: FileEntry }>> {
  const result: Array<{ path: string; entry?: FileEntry }> = [];
  for (const entry of entries) {
    const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.kind === "folder") {
      const children = await listFolderChildren(entry.id);
      if (children.length === 0) {
        result.push({ path: `${entryPath}/` });
      } else {
        result.push(...(await collectFilesForZip(children, entryPath)));
      }
    } else {
      result.push({ path: entryPath, entry });
    }
  }
  return result;
}

export async function downloadEntriesAsZip(entries: FileEntry[], archiveName: string) {
  if (entries.length === 0) return;
  const toastId = toast.loading(`Preparing ${archiveName}.zip…`);
  try {
    const collected = await collectFilesForZip(entries);
    const zipInput: Record<string, Uint8Array> = {};
    const fileItems = collected.filter((item): item is { path: string; entry: FileEntry } =>
      Boolean(item.entry),
    );
    for (const item of collected) {
      if (!item.entry) zipInput[item.path] = new Uint8Array(0);
    }

    const concurrency = 3;
    let index = 0;
    const worker = async () => {
      while (index < fileItems.length) {
        const current = fileItems[index++];
        const response = await fetch(fileContentUrl(current.entry, true), {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`Failed to download ${current.entry.name} (${response.status})`);
        }
        const buffer = await response.arrayBuffer();
        zipInput[current.path] = new Uint8Array(buffer);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, fileItems.length) }, worker));

    const zipped = zipSync(zipInput, { level: 0 });
    const blob = new Blob([new Uint8Array(zipped)], { type: "application/zip" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${archiveName}.zip`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success(`Downloaded ${archiveName}.zip`, { id: toastId });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Failed to create zip archive", {
      id: toastId,
    });
  }
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    // Clipboard API requires a secure context; the textarea path also works on HTTP IP hosts.
  }

  const activeElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  activeElement?.focus();
  if (!copied) throw new Error("Clipboard access is unavailable");
}

export function absoluteFileDownloadUrl(file: Pick<FileEntry, "id" | "name">) {
  return new URL(fileContentUrl(file, true), window.location.origin).toString();
}
