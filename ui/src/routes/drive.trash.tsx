import { Button, Dropdown, Label, Spinner } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import ArrowDownIcon from "~icons/gravity-ui/arrow-down";
import RestoreIcon from "~icons/gravity-ui/arrow-rotate-left";
import ArrowUpIcon from "~icons/gravity-ui/arrow-up";
import ChevronDownIcon from "~icons/gravity-ui/chevron-down";
import MoreIcon from "~icons/gravity-ui/ellipsis-vertical";
import FolderIcon from "~icons/gravity-ui/folder";
import TrashIcon from "~icons/gravity-ui/trash-bin";
import CloseIcon from "~icons/gravity-ui/xmark";
import { userMessage } from "@/api/errors";
import type { FileCategory, FileEntry } from "@/api/types";
import { ConfirmDialog } from "@/components/dialogs/confirm-dialog";
import { EmptyState, Page } from "@/components/page";
import { FileTypeIcon } from "@/features/files/file-type-icon";
import { useFileActions } from "@/features/files/mutations";
import { useInfiniteFilePages } from "@/features/files/queries";
import { useDateTimeFormatter, useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";

export const Route = createFileRoute("/drive/trash")({
  component: TrashPage,
  pendingComponent: () => (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Spinner size="lg" />
    </div>
  ),
});

function dateGroupLabel(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((startOfToday - date.getTime()) / 86_400_000);
  if (diffDays < 0) return "Today";
  if (diffDays === 0) return "Today";
  if (diffDays < 7) return "Earlier this week";
  if (diffDays < 14) return "Last week";
  if (diffDays < 30) return "Last month";
  return "Older";
}

function TrashPage() {
  const [filterType, setFilterType] = useState<
    "all" | "folder" | "document" | "media" | "audio" | "archive"
  >("all");
  const [filterModified, setFilterModified] = useState<"all" | "today" | "week" | "month">("all");
  const [sortBy, setSortBy] = useState<"name" | "updatedAt" | "size">("updatedAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const filterKind: "folder" | undefined = filterType === "folder" ? "folder" : undefined;
  const filterCategories: FileCategory[] | undefined =
    filterType === "document"
      ? ["document"]
      : filterType === "media"
        ? ["image", "video"]
        : filterType === "audio"
          ? ["audio"]
          : filterType === "archive"
            ? ["archive"]
            : undefined;
  const filterUpdatedAfter =
    filterModified === "all"
      ? undefined
      : new Date(
          Date.now() -
            (filterModified === "today" ? 1 : filterModified === "week" ? 7 : 30) * 86_400_000,
        )
          .toISOString()
          .slice(0, 10);

  const query = useInfiniteFilePages(
    {
      path: "/",
      scope: "folder",
      kind: filterKind,
      category: filterCategories,
      updatedAfter: filterUpdatedAfter,
      sort: sortBy,
      order: sortOrder,
      view: "list",
    },
    "trashed",
  );
  const items = query.data?.pages.flatMap((page) => page.items) ?? [];

  const actions = useFileActions();
  const [purging, setPurging] = useState<FileEntry>();
  const [cleaningTrash, setCleaningTrash] = useState(false);
  const { t } = useAppLocale();
  const formatDateTime = useDateTimeFormatter();
  const formatBytes = useFormatBytes();

  const restore = async (file: FileEntry) => {
    try {
      await actions.restore(file.id);
      toast.success(t("trash.restored", { name: file.name }));
    } catch (error) {
      toast.error(t("trash.restoreFailed"), { description: userMessage(error) });
    }
  };

  const purge = async (file: FileEntry) => {
    try {
      await actions.purge(file.id);
      toast.success(t("trash.purged", { name: file.name }));
    } catch (error) {
      toast.error(t("trash.purgeFailed"), { description: userMessage(error) });
    }
  };

  const cleanTrash = async () => {
    try {
      await actions.cleanTrash();
      toast.success(t("trash.cleaned"));
    } catch (error) {
      toast.error(t("trash.cleanFailed"), { description: userMessage(error) });
    }
  };

  const toggleSort = (col: "name" | "updatedAt" | "size") => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder(col === "name" ? "asc" : "desc");
    }
  };

  const grouped = useMemo(() => {
    if (sortBy !== "updatedAt") {
      return [{ label: null as string | null, items }];
    }
    const groups: { label: string | null; items: FileEntry[] }[] = [];
    for (const file of items) {
      const label = dateGroupLabel(file.updatedAt);
      const last = groups.at(-1);
      if (last && last.label === label) {
        last.items.push(file);
      } else {
        groups.push({ label, items: [file] });
      }
    }
    return groups;
  }, [items, sortBy]);

  const filterTypeLabel =
    filterType === "folder"
      ? t("drive.filterFolders")
      : filterType === "document"
        ? t("drive.filterDocuments")
        : filterType === "media"
          ? t("drive.filterMedia")
          : filterType === "audio"
            ? t("drive.filterAudio")
            : filterType === "archive"
              ? t("drive.filterArchives")
              : t("search.type");

  const filterModifiedLabel =
    filterModified === "today"
      ? "Today"
      : filterModified === "week"
        ? "Last 7 days"
        : filterModified === "month"
          ? "Last 30 days"
          : t("manager.sortModified");

  return (
    <Page className="gap-4 p-3 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-normal tracking-tight text-foreground sm:text-2xl">
          {t("trash.title")}
        </h1>
      </div>

      {/* Google Drive-style Filter Chips */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center">
          <Dropdown>
            <Button
              size="sm"
              variant="ghost"
              className={
                filterType !== "all"
                  ? "h-8 gap-1.5 rounded-l-lg rounded-r-none border border-r-0 border-[#0b57d0]/40 bg-[#c2e7ff]/60 px-3 text-xs font-medium text-[#001d35] hover:bg-[#c2e7ff] dark:border-[#a8c7fa]/40 dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#004a77]/80"
                  : "h-8 gap-1.5 rounded-lg border border-[#747775]/45 bg-transparent px-3 text-xs font-medium text-[#444746] hover:bg-[#f0f4f9] dark:border-[#8e918f]/45 dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
              }
            >
              <span>{filterTypeLabel}</span>
              <ChevronDownIcon className="size-3.5 opacity-80" />
            </Button>
            <Dropdown.Popover placement="bottom start" className="min-w-44 rounded-xl p-1">
              <Dropdown.Menu
                aria-label={t("search.type")}
                onAction={(key) =>
                  setFilterType(
                    String(key) as "all" | "folder" | "document" | "media" | "audio" | "archive",
                  )
                }
              >
                <Dropdown.Item id="all" textValue={t("drive.filterAll")}>
                  <Label>{t("drive.filterAll")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="folder" textValue={t("drive.filterFolders")}>
                  <Label>{t("drive.filterFolders")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="document" textValue={t("drive.filterDocuments")}>
                  <Label>{t("drive.filterDocuments")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="media" textValue={t("drive.filterMedia")}>
                  <Label>{t("drive.filterMedia")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="audio" textValue={t("drive.filterAudio")}>
                  <Label>{t("drive.filterAudio")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="archive" textValue={t("drive.filterArchives")}>
                  <Label>{t("drive.filterArchives")}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {filterType !== "all" ? (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Clear type filter"
              onPress={() => setFilterType("all")}
              className="h-8 w-7 rounded-l-none rounded-r-lg border border-[#0b57d0]/40 bg-[#c2e7ff]/60 text-[#001d35] hover:bg-[#c2e7ff] dark:border-[#a8c7fa]/40 dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#004a77]/80"
            >
              <CloseIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>

        <div className="inline-flex items-center">
          <Dropdown>
            <Button
              size="sm"
              variant="ghost"
              className={
                filterModified !== "all"
                  ? "h-8 gap-1.5 rounded-l-lg rounded-r-none border border-r-0 border-[#0b57d0]/40 bg-[#c2e7ff]/60 px-3 text-xs font-medium text-[#001d35] hover:bg-[#c2e7ff] dark:border-[#a8c7fa]/40 dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#004a77]/80"
                  : "h-8 gap-1.5 rounded-lg border border-[#747775]/45 bg-transparent px-3 text-xs font-medium text-[#444746] hover:bg-[#f0f4f9] dark:border-[#8e918f]/45 dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
              }
            >
              <span>{filterModifiedLabel}</span>
              <ChevronDownIcon className="size-3.5 opacity-80" />
            </Button>
            <Dropdown.Popover placement="bottom start" className="min-w-44 rounded-xl p-1">
              <Dropdown.Menu
                aria-label={t("manager.sortModified")}
                onAction={(key) =>
                  setFilterModified(String(key) as "all" | "today" | "week" | "month")
                }
              >
                <Dropdown.Item id="all" textValue={t("drive.filterAll")}>
                  <Label>{t("drive.filterAll")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="today" textValue="Today">
                  <Label>Today</Label>
                </Dropdown.Item>
                <Dropdown.Item id="week" textValue="Last 7 days">
                  <Label>Last 7 days</Label>
                </Dropdown.Item>
                <Dropdown.Item id="month" textValue="Last 30 days">
                  <Label>Last 30 days</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {filterModified !== "all" ? (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label="Clear modified filter"
              onPress={() => setFilterModified("all")}
              className="h-8 w-7 rounded-l-none rounded-r-lg border border-[#0b57d0]/40 bg-[#c2e7ff]/60 text-[#001d35] hover:bg-[#c2e7ff] dark:border-[#a8c7fa]/40 dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#004a77]/80"
            >
              <CloseIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Google Drive-style Trash notice banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f0f4f9] px-4 py-2.5 dark:bg-[#282a2c]/80">
        <p className="text-xs text-muted sm:text-sm">{t("trash.description")}</p>
        <Button
          size="sm"
          variant="ghost"
          isDisabled={items.length === 0 || actions.pending}
          onPress={() => setCleaningTrash(true)}
          className="h-8 rounded-full px-3 text-xs font-medium text-[#0b57d0] hover:bg-[#0b57d0]/10 dark:text-[#a8c7fa] dark:hover:bg-[#a8c7fa]/10"
        >
          {t("trash.clean")}
        </Button>
      </div>

      {query.isPending ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState title={t("trash.empty")} description={t("trash.emptyHint")} />
      ) : (
        <div className="min-w-0">
          <div className="grid grid-cols-[minmax(0,1fr)_8.5rem_2.5rem] items-center border-b border-border/60 px-3 py-2 text-xs font-medium text-muted sm:grid-cols-[minmax(0,1fr)_11rem_6.5rem_2.5rem]">
            <button
              type="button"
              onClick={() => toggleSort("name")}
              className="flex w-fit items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-default/40 hover:text-foreground"
            >
              <span>{t("manager.sortName")}</span>
              {sortBy === "name" ? (
                sortOrder === "asc" ? (
                  <ArrowUpIcon className="size-3.5 text-foreground" />
                ) : (
                  <ArrowDownIcon className="size-3.5 text-foreground" />
                )
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("updatedAt")}
              className="flex w-fit items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-default/40 hover:text-foreground"
            >
              <span>Date trashed</span>
              {sortBy === "updatedAt" ? (
                sortOrder === "asc" ? (
                  <ArrowUpIcon className="size-3.5 text-foreground" />
                ) : (
                  <ArrowDownIcon className="size-3.5 text-foreground" />
                )
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => toggleSort("size")}
              className="hidden w-fit items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-default/40 hover:text-foreground sm:flex"
            >
              <span>{t("manager.sortSize")}</span>
              {sortBy === "size" ? (
                sortOrder === "asc" ? (
                  <ArrowUpIcon className="size-3.5 text-foreground" />
                ) : (
                  <ArrowDownIcon className="size-3.5 text-foreground" />
                )
              ) : null}
            </button>
            <span />
          </div>

          {grouped.map((group, groupIndex) => (
            <div key={group.label ?? `group-${groupIndex}`}>
              {group.label ? (
                <div className="px-3 pb-1 pt-4 text-xs font-medium text-muted">{group.label}</div>
              ) : null}
              {group.items.map((file) => (
                <div
                  key={file.id}
                  className="group grid h-11 grid-cols-[minmax(0,1fr)_8.5rem_2.5rem] items-center border-b border-border/40 px-3 transition-colors hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c]/70 sm:grid-cols-[minmax(0,1fr)_11rem_6.5rem_2.5rem]"
                >
                  <div className="flex min-w-0 items-center gap-3 pr-3">
                    {file.kind === "folder" ? (
                      <FolderIcon className="size-4.5 shrink-0 text-[#5f6368] dark:text-[#c4c7c5]" />
                    ) : (
                      <FileTypeIcon file={file} className="size-4.5 shrink-0" />
                    )}
                    <span className="truncate text-sm font-medium text-foreground">
                      {file.name}
                    </span>
                  </div>
                  <span className="truncate text-xs text-muted">
                    {formatDateTime.format(new Date(file.updatedAt))}
                  </span>
                  <span className="hidden text-xs tabular-nums text-muted sm:block">
                    {file.kind === "folder" ? "—" : formatBytes(file.size ?? 0)}
                  </span>
                  <div className="flex justify-end">
                    <Dropdown>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="ghost"
                        aria-label={`Actions for ${file.name}`}
                        className="size-8 rounded-full text-muted hover:text-foreground"
                      >
                        <MoreIcon className="size-4" />
                      </Button>
                      <Dropdown.Popover placement="bottom end" className="min-w-44 rounded-xl p-1">
                        <Dropdown.Menu
                          aria-label={`Actions for ${file.name}`}
                          onAction={(key) => {
                            if (key === "restore") void restore(file);
                            else if (key === "purge") setPurging(file);
                          }}
                        >
                          <Dropdown.Item id="restore" textValue={t("trash.restore")}>
                            <RestoreIcon className="size-4" />
                            <Label>{t("trash.restore")}</Label>
                          </Dropdown.Item>
                          <Dropdown.Item
                            id="purge"
                            variant="danger"
                            textValue={t("trash.deleteForever")}
                          >
                            <TrashIcon className="size-4" />
                            <Label>{t("trash.deleteForever")}</Label>
                          </Dropdown.Item>
                        </Dropdown.Menu>
                      </Dropdown.Popover>
                    </Dropdown>
                  </div>
                </div>
              ))}
            </div>
          ))}

          {query.hasNextPage ? (
            <div className="flex justify-center pt-4">
              <Button
                size="sm"
                variant="secondary"
                isDisabled={query.isFetchingNextPage}
                onPress={() => void query.fetchNextPage()}
              >
                {query.isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          ) : null}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(purging)}
        onOpenChange={(open) => {
          if (!open) setPurging(undefined);
        }}
        title={t("trash.purgeTitle")}
        message={t("trash.purgeMessage")}
        confirmLabel={t("trash.deleteForever")}
        isPending={actions.pending}
        onConfirm={() => {
          if (!purging) return;
          void purge(purging).finally(() => setPurging(undefined));
        }}
      />

      <ConfirmDialog
        open={cleaningTrash}
        onOpenChange={setCleaningTrash}
        title={t("trash.cleanTitle")}
        message={t("trash.cleanMessage")}
        confirmLabel={t("trash.clean")}
        isPending={actions.pending}
        onConfirm={() => {
          void cleanTrash().finally(() => setCleaningTrash(false));
        }}
      />
    </Page>
  );
}
