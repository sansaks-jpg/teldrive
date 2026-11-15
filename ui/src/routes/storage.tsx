import { Button, Card, Dropdown, Label, Spinner, Typography } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import ArrowDownIcon from "~icons/gravity-ui/arrow-down";
import ArrowUpIcon from "~icons/gravity-ui/arrow-up";
import ChevronDownIcon from "~icons/gravity-ui/chevron-down";
import CloseIcon from "~icons/gravity-ui/xmark";
import { $api } from "@/api/client";
import { queryClient } from "@/api/query-client";
import type { components } from "@/api/schema";
import type { FileCategory, FileEntry } from "@/api/types";
import { FilePreviewDialog, isPreviewable } from "@/components/file-preview-dialog";
import { GoogleOneSegmentedBar, type StorageSegment } from "@/components/google-workspace";
import { LinkButton } from "@/components/link-button";
import { Page } from "@/components/page";
import { startFileDownload } from "@/features/files/download";
import { FileTypeIcon } from "@/features/files/file-type-icon";
import { useInfiniteFilePages } from "@/features/files/queries";
import { useDateOnlyFormatter, useFormatBytes } from "@/lib/format";
import { useCurrentUser } from "@/auth/use-current-user";
import { useAppLocale } from "@/lib/locale";

type StorageActivity = components["schemas"]["StorageActivity"];
type StorageGrowthPoint = components["schemas"]["StorageGrowthPoint"];
type TFunction = (key: string, vars?: Record<string, string | number>) => string;

function categoryLabel(t: TFunction, category: string) {
  switch (category) {
    case "archive":
      return t("storage.cat.archive");
    case "audio":
      return t("storage.cat.audio");
    case "document":
      return t("storage.cat.document");
    case "image":
      return t("storage.cat.image");
    case "video":
      return t("storage.cat.video");
    case "other":
      return t("storage.cat.other");
    default:
      return category;
  }
}

function activityLabel(t: TFunction, type: string) {
  switch (type) {
    case "file.created":
      return t("storage.act.file.created");
    case "file.trashed":
      return t("storage.act.file.trashed");
    case "file.restored":
      return t("storage.act.file.restored");
    case "file.purged":
      return t("storage.act.file.purged");
    case "upload.completed":
      return t("storage.act.upload.completed");
    case "upload.aborted":
      return t("storage.act.upload.aborted");
    case "upload.expired":
      return t("storage.act.upload.expired");
    case "share.created":
      return t("storage.act.share.created");
    case "share.deleted":
      return t("storage.act.share.deleted");
    case "channel.created":
      return t("storage.act.channel.created");
    case "channel.updated":
      return t("storage.act.channel.updated");
    case "channel.deleted":
      return t("storage.act.channel.deleted");
    default:
      return type;
  }
}

export const Route = createFileRoute("/storage")({
  component: StoragePage,
  pendingComponent: () => (
    <div className="flex items-center justify-center py-20">
      <Spinner size="lg" />
    </div>
  ),
  loader: () => queryClient.ensureQueryData($api.queryOptions("get", "/v1/storage/stats")),
});

function StoragePage() {
  const { data } = $api.useSuspenseQuery("get", "/v1/storage/stats");
  const currentUser = useCurrentUser();
  const { t } = useAppLocale();
  const formatBytes = useFormatBytes();
  const [filterType, setFilterType] = useState<"all" | "document" | "media" | "audio" | "archive">(
    "all",
  );
  const [filterModified, setFilterModified] = useState<"all" | "today" | "week" | "month">("all");
  const [sortBy, setSortBy] = useState<"name" | "size">("size");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [previewFile, setPreviewFile] = useState<FileEntry>();

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

  const filesQuery = useInfiniteFilePages(
    {
      path: "/",
      scope: "drive",
      kind: "file",
      category: filterCategories,
      updatedAfter: filterUpdatedAfter,
      sort: sortBy,
      order: sortOrder,
      view: "list",
    },
    "active",
  );
  const files = filesQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const summary = data.summary;
  const quotaBytes = currentUser.data.storageQuotaBytes ?? null;
  const categoryMap = new Map(data.categories.map((entry) => [entry.category, entry.totalSize]));
  const otherSize =
    (categoryMap.get("archive") ?? 0) +
    (categoryMap.get("audio") ?? 0) +
    (categoryMap.get("other") ?? 0);
  const segments: StorageSegment[] = [
    {
      id: "document",
      label: categoryLabel(t, "document"),
      bytes: categoryMap.get("document") ?? 0,
      colorClass: "bg-[#1a73e8]",
      dotClass: "bg-[#1a73e8]",
    },
    {
      id: "image",
      label: categoryLabel(t, "image"),
      bytes: categoryMap.get("image") ?? 0,
      colorClass: "bg-[#fbbc04]",
      dotClass: "bg-[#fbbc04]",
    },
    {
      id: "video",
      label: categoryLabel(t, "video"),
      bytes: categoryMap.get("video") ?? 0,
      colorClass: "bg-[#ea4335]",
      dotClass: "bg-[#ea4335]",
    },
    {
      id: "other",
      label: categoryLabel(t, "other"),
      bytes: otherSize,
      colorClass: "bg-[#34a853]",
      dotClass: "bg-[#34a853]",
    },
    {
      id: "trash",
      label: t("storage.trash"),
      bytes: summary.trashBytes,
      colorClass: "bg-muted/55",
      dotClass: "bg-muted/55",
    },
  ];
  const combinedPoolBytes = summary.logicalBytes + summary.trashBytes;

  const filterTypeLabel =
    filterType === "document"
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
      ? t("storage.filterToday")
      : filterModified === "week"
        ? t("storage.filterWeek")
        : filterModified === "month"
          ? t("storage.filterMonth")
          : t("manager.sortModified");

  const toggleSort = (col: "name" | "size") => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(col);
      setSortOrder(col === "size" ? "desc" : "asc");
    }
  };

  return (
    <Page className="gap-5 p-3 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-normal tracking-tight text-foreground sm:text-2xl">
          {t("storage.title")}
        </h1>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => setShowAnalytics((prev) => !prev)}
          className="h-8 rounded-full px-3 text-xs font-medium text-muted hover:text-foreground"
        >
          {showAnalytics ? t("storage.hideAnalytics") : t("storage.analytics")}
        </Button>
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
                  setFilterType(String(key) as "all" | "document" | "media" | "audio" | "archive")
                }
              >
                <Dropdown.Item id="all" textValue={t("drive.filterAll")}>
                  <Label>{t("drive.filterAll")}</Label>
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
              aria-label={t("storage.clearTypeFilter")}
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
                <Dropdown.Item id="today" textValue={t("storage.filterToday")}>
                  <Label>{t("storage.filterToday")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="week" textValue={t("storage.filterWeek")}>
                  <Label>{t("storage.filterWeek")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="month" textValue={t("storage.filterMonth")}>
                  <Label>{t("storage.filterMonth")}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
          {filterModified !== "all" ? (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t("storage.clearModifiedFilter")}
              onPress={() => setFilterModified("all")}
              className="h-8 w-7 rounded-l-none rounded-r-lg border border-[#0b57d0]/40 bg-[#c2e7ff]/60 text-[#001d35] hover:bg-[#c2e7ff] dark:border-[#a8c7fa]/40 dark:bg-[#004a77] dark:text-[#c2e7ff] dark:hover:bg-[#004a77]/80"
            >
              <CloseIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Google Drive-style Storage Summary */}
      <div className="grid gap-3 py-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-normal tabular-nums tracking-tight text-foreground sm:text-[32px]">
            {formatBytes(combinedPoolBytes)}
          </span>
          <span className="text-sm text-muted">
            {quotaBytes != null
              ? t("storage.usedOfQuotaClean", { quota: formatBytes(quotaBytes) })
              : t("storage.usedTotalClean")}
          </span>
        </div>

        <GoogleOneSegmentedBar
          segments={segments}
          totalBytes={
            quotaBytes != null && quotaBytes > combinedPoolBytes ? quotaBytes : combinedPoolBytes
          }
          formatBytes={formatBytes}
        />

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <LinkButton
            to="/trash"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-3 text-xs font-medium text-[#0b57d0] hover:bg-[#0b57d0]/10 dark:text-[#a8c7fa] dark:hover:bg-[#a8c7fa]/10"
          >
            {t("storage.freeUpSpace")}
          </LinkButton>
          {data.cleanup.totalReclaimableBytes > 0 ? (
            <span className="text-xs text-muted">
              {t("storage.reclaimableTrash", {
                bytes: formatBytes(data.cleanup.totalReclaimableBytes),
              })}
            </span>
          ) : null}
        </div>
      </div>

      {/* Collapsible detailed analytics */}
      {showAnalytics ? (
        <div className="grid gap-4 pb-2">
          <StorageGrowthChart points={data.growth} />
          <div className="grid gap-4">
            <Card className="gap-4 p-5">
              <div>
                <Typography type="h2" className="text-base font-semibold">
                  {t("storage.recent")}
                </Typography>
                <Typography.Paragraph className="text-sm text-muted">
                  {t("storage.recentDesc")}
                </Typography.Paragraph>
              </div>
              <div className="divide-y divide-border rounded-xl border border-border">
                {data.activity.slice(0, 8).map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} />
                ))}
                {data.activity.length === 0 && <EmptyCopy>{t("storage.emptyActivity")}</EmptyCopy>}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {/* Files taking up space table */}
      <div className="min-w-0">
        <div className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-center border-b border-border/60 px-3 py-2 text-xs font-medium text-muted">
          <button
            type="button"
            onClick={() => toggleSort("name")}
            className="flex w-fit items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-default/40 hover:text-foreground"
          >
            <span>{t("manager.sortName")}</span>
            {sortBy === "name" ? (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]">
                {sortOrder === "asc" ? (
                  <ArrowUpIcon className="size-3" />
                ) : (
                  <ArrowDownIcon className="size-3" />
                )}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => toggleSort("size")}
            className="ml-auto flex w-fit items-center gap-1.5 rounded px-1 py-0.5 text-right transition-colors hover:bg-default/40 hover:text-foreground"
          >
            <span>{t("storage.columnUsed")}</span>
            {sortBy === "size" ? (
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[#c2e7ff] text-[#001d35] dark:bg-[#004a77] dark:text-[#c2e7ff]">
                {sortOrder === "asc" ? (
                  <ArrowUpIcon className="size-3" />
                ) : (
                  <ArrowDownIcon className="size-3" />
                )}
              </span>
            ) : null}
          </button>
        </div>

        {filesQuery.isPending ? (
          <div className="flex items-center justify-center py-14">
            <Spinner size="md" />
          </div>
        ) : files.length === 0 ? (
          <div className="py-14 text-center text-sm text-muted">
            <p>{t("storage.emptyFiltered")}</p>
            {filterType !== "all" || filterModified !== "all" ? (
              <Button
                size="sm"
                variant="tertiary"
                className="mt-3 rounded-full"
                onPress={() => {
                  setFilterType("all");
                  setFilterModified("all");
                }}
              >
                {t("drive.filterAll")}
              </Button>
            ) : null}
          </div>
        ) : (
          <div>
            {files.map((file) => (
              <button
                key={file.id}
                type="button"
                onClick={() => {
                  if (isPreviewable(file)) {
                    setPreviewFile(file);
                  } else {
                    startFileDownload(file);
                  }
                }}
                className="grid h-11 w-full grid-cols-[minmax(0,1fr)_9.5rem] items-center border-b border-border/40 px-3 text-left transition-colors hover:bg-[#f0f4f9] dark:hover:bg-[#282a2c]/70"
              >
                <div className="flex min-w-0 items-center gap-3 pr-3">
                  <FileTypeIcon file={file} className="size-4.5 shrink-0" />
                  <span className="truncate text-sm font-normal text-foreground">{file.name}</span>
                </div>
                <span className="text-right text-xs tabular-nums text-muted">
                  {formatBytes(file.size ?? 0)}
                </span>
              </button>
            ))}
            {filesQuery.hasNextPage ? (
              <div className="flex justify-center pt-4">
                <Button
                  size="sm"
                  variant="secondary"
                  isDisabled={filesQuery.isFetchingNextPage}
                  onPress={() => void filesQuery.fetchNextPage()}
                >
                  {filesQuery.isFetchingNextPage ? t("storage.loadingMore") : t("storage.loadMore")}
                </Button>
              </div>
            ) : null}
          </div>
        )}
      </div>

      <FilePreviewDialog
        file={previewFile}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(undefined);
        }}
      />
    </Page>
  );
}

function StorageGrowthChart({ points }: { points: StorageGrowthPoint[] }) {
  const { t } = useAppLocale();
  const formatBytes = useFormatBytes();
  const formatDate = useDateOnlyFormatter();
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const visible = points.slice(-range);
  const maxBytes = Math.max(...visible.map((point) => point.addedBytes), 1);

  return (
    <Card className="gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Typography type="h2" className="text-base font-semibold">
            {t("storage.growth")}
          </Typography>
          <Typography.Paragraph className="text-sm text-muted">
            {t("storage.growthDesc")}
          </Typography.Paragraph>
        </div>
        <fieldset
          className="m-0 flex items-center gap-1 border-0 p-0"
          aria-label={t("storage.range")}
        >
          {([7, 30, 90] as const).map((days) => (
            <Button
              key={days}
              size="sm"
              variant={range === days ? "primary" : "tertiary"}
              onPress={() => setRange(days)}
            >
              {t("storage.days", { count: days })}
            </Button>
          ))}
        </fieldset>
      </div>
      <div className="grid h-36 grid-cols-[repeat(auto-fit,minmax(4px,1fr))] items-end gap-1 rounded-xl border border-border/60 bg-surface-secondary/50 p-3">
        {visible.map((point) => {
          const height =
            point.addedBytes > 0 ? Math.max((point.addedBytes / maxBytes) * 100, 8) : 3;
          return (
            <div
              key={point.day}
              title={`${formatDate.format(new Date(point.day))}: ${t("storage.dailyAdded", {
                bytes: formatBytes(point.addedBytes),
              })}`}
              className="group relative flex h-full items-end"
            >
              <div
                className={
                  point.addedBytes > 0
                    ? "w-full rounded-t bg-accent/80 transition-colors group-hover:bg-accent"
                    : "w-full rounded-t bg-border/60"
                }
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ActivityRow({ activity }: { activity: StorageActivity }) {
  const { t } = useAppLocale();
  const formatDate = useDateOnlyFormatter();
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">{activity.label || activity.type}</div>
        <div className="text-xs text-muted">{activityLabel(t, activity.type)}</div>
      </div>
      <span className="shrink-0 text-xs text-muted">
        {formatDate.format(new Date(activity.occurredAt))}
      </span>
    </div>
  );
}

function _ProgressTrack({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className="h-2 overflow-hidden rounded-full bg-surface-secondary"
    >
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function EmptyCopy({ children }: { children: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted">{children}</p>;
}
