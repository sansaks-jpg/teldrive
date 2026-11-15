import { Button, Card, Checkbox, Dropdown, Label, Separator, Spinner } from "@heroui/react";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Collection,
  GridLayout,
  GridList,
  GridListItem,
  GridListLoadMoreItem,
  ListLayout,
  type Selection,
  Size,
  Virtualizer,
} from "react-aria-components";
import { createPortal } from "react-dom";
import type { FileEntry } from "@/api/types";
import { useDateOnlyFormatter, useDateTimeFormatter, useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import DownloadIcon from "~icons/gravity-ui/arrow-down-to-line";
import BackIcon from "~icons/gravity-ui/arrow-left";
import BookmarkIcon from "~icons/gravity-ui/bookmark";
import CheckIcon from "~icons/gravity-ui/check";
import ChevronRightIcon from "~icons/gravity-ui/chevron-right";
import UpIcon from "~icons/gravity-ui/chevron-up";
import ClockIcon from "~icons/gravity-ui/clock";
import CopyIcon from "~icons/gravity-ui/copy";
import CopyLinkIcon from "~icons/gravity-ui/copy-arrow-right";
import MoreIcon from "~icons/gravity-ui/ellipsis-vertical";
import FolderIcon from "~icons/gravity-ui/folder";
import MoveIcon from "~icons/gravity-ui/folder-arrow-right";
import GridIcon from "~icons/gravity-ui/layout-cells";
import LinkIcon from "~icons/gravity-ui/link";
import ListIcon from "~icons/gravity-ui/list-ul";
import PencilIcon from "~icons/gravity-ui/pencil";
import TrashIcon from "~icons/gravity-ui/trash-bin";
import { FileTypeIcon } from "./file-type-icon";

export type FileBrowserView = "list" | "grid";

export type FileRowActionHandlers = {
  onDownload?: (file: FileEntry) => void;
  onShare?: (file: FileEntry) => void;
  onCopyLink?: (file: FileEntry) => void;
  onRename?: (file: FileEntry) => void;
  onBookmark?: (file: FileEntry) => void;
  onMove?: (file: FileEntry) => void;
  onCopy?: (file: FileEntry) => void;
  onVersions?: (file: FileEntry) => void;
  onTrash?: (file: FileEntry) => void;
  isBookmarked?: boolean;
};

const fileGridLayoutOptions = {
  // Estimate a single-line filename; the virtualizer measures wrapped names.
  minItemSize: new Size(144, 160),
  maxItemSize: new Size(208, 204),
  minSpace: new Size(12, 12),
  maxHorizontalSpace: 12,
};

const locatedFileGridLayoutOptions = {
  ...fileGridLayoutOptions,
  minItemSize: new Size(144, 180),
  maxItemSize: new Size(208, 224),
};

type FileBrowserProps = {
  files: FileEntry[];
  path: string;
  rootLabel: string;
  view: FileBrowserView;
  loading: boolean;
  onNavigatePath: (path: string) => void;
  onViewChange: (view: FileBrowserView) => void;
  onOpen: (file: FileEntry) => void;
  toolbar?: ReactNode;
  compactToolbar?: boolean;
  emptyContent?: ReactNode;
  onBack?: () => void;
  selection?: {
    selectedKeys: Selection;
    onSelectionChange: (selection: Selection) => void;
    onClearSelection: () => void;
  };
  selectionOverlay?: ReactNode;
  selectionDisabled?: boolean;

  dimmedIds?: ReadonlySet<string>;
  hasNextPage?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  emptyHint?: string;
  emptyTitle?: string;
  hideFolderControls?: boolean;
  showLocations?: boolean;
  onOpenContainingFolder?: (file: FileEntry) => void;
  rowActions?: FileRowActionHandlers;
  headerFilters?: ReactNode;
  flat?: boolean;
};

export function FileBrowser({
  files,
  path,
  rootLabel,
  view,
  loading,
  onNavigatePath,
  onViewChange,
  onOpen,
  toolbar,
  compactToolbar = false,
  emptyContent,
  onBack,
  selection,
  selectionOverlay,
  selectionDisabled = false,

  dimmedIds,
  hasNextPage = false,
  isLoadingMore = false,
  onLoadMore,
  emptyHint,
  emptyTitle,
  hideFolderControls = false,
  showLocations = false,
  onOpenContainingFolder,
  rowActions,
  headerFilters,
  flat = false,
}: FileBrowserProps) {
  const { t } = useAppLocale();
  const resolvedEmptyHint = emptyHint ?? t("browser.emptyHint");
  const resolvedEmptyTitle = emptyTitle ?? t("browser.emptyTitle");
  return (
    <Card
      className={
        flat
          ? "@container/file-browser relative flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-none border-0 bg-transparent shadow-none"
          : "@container/file-browser relative flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-2xl border border-border/60 bg-surface shadow-sm"
      }
    >
      <Card.Header
        className={`shrink-0 border-b-0 px-3 sm:border-b sm:border-border/45 sm:px-4 ${compactToolbar ? "py-2" : "pb-1.5 pt-3 sm:py-2.5"}`}
        data-testid="file-browser-toolbar"
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2 [&>button]:shrink-0">
          {onBack ? (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="hidden size-8 rounded-full sm:inline-flex"
              aria-label={t("browser.back")}
              onPress={onBack}
            >
              <BackIcon className="size-4" />
            </Button>
          ) : null}
          {!hideFolderControls && path !== "/" ? (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="size-8 rounded-full"
              aria-label={t("browser.up")}
              onPress={() => {
                const parts = path.split("/").filter(Boolean);
                const parentPath = parts.length <= 1 ? "/" : `/${parts.slice(0, -1).join("/")}`;
                onNavigatePath(parentPath);
              }}
            >
              <BackIcon className="size-4 sm:hidden" />
              <UpIcon className="hidden size-4 sm:block" />
            </Button>
          ) : null}
          {!hideFolderControls && (
            <div
              className={
                path === "/"
                  ? "hidden min-w-24 flex-1 overflow-hidden sm:block"
                  : "min-w-24 flex-1 overflow-hidden"
              }
            >
              <FileBrowserBreadcrumb
                path={path}
                rootLabel={rootLabel}
                onNavigatePath={onNavigatePath}
              />
            </div>
          )}
          <div
            className={
              toolbar
                ? "flex w-full min-w-0 flex-wrap items-center justify-between gap-1.5 sm:ml-auto sm:w-auto sm:flex-none sm:justify-end [&>button]:shrink-0"
                : "ml-auto flex min-w-0 shrink-0 flex-wrap items-center justify-end gap-1.5 [&>button]:shrink-0"
            }
          >
            {toolbar ? <div className="flex min-w-0 items-center gap-1.5">{toolbar}</div> : null}
            <div className="inline-flex shrink-0 items-center gap-0.5">
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={t("browser.listView")}
                aria-pressed={view === "list"}
                className={
                  view === "list"
                    ? "h-8 w-11 rounded-full bg-[#c2e7ff] text-[#001d35] dark:bg-[#b8dce6] dark:text-[#002026]"
                    : "h-8 w-11 rounded-l-full rounded-r-md bg-[#eef2f6] text-[#444746] hover:text-foreground dark:bg-[#223236] dark:text-[#cbe2e8]"
                }
                onPress={() => onViewChange("list")}
              >
                <ListIcon className="size-4" />
              </Button>
              <Button
                isIconOnly
                size="sm"
                variant="ghost"
                aria-label={t("browser.gridView")}
                aria-pressed={view === "grid"}
                className={
                  view === "grid"
                    ? "h-8 w-11 rounded-full bg-[#c2e7ff] text-[#001d35] dark:bg-[#b8dce6] dark:text-[#002026]"
                    : "h-8 w-11 rounded-r-full rounded-l-md bg-[#eef2f6] text-[#444746] hover:text-foreground dark:bg-[#223236] dark:text-[#cbe2e8]"
                }
                onPress={() => onViewChange("grid")}
              >
                <GridIcon className="size-4" />
              </Button>
            </div>
          </div>
        </div>
        {headerFilters ? <div className="mt-2.5 hidden sm:block">{headerFilters}</div> : null}
      </Card.Header>
      <Card.Content className="flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {loading ? (
          <div className="flex flex-1 min-h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : emptyContent ? (
          emptyContent
        ) : (
          <>
            {view === "list" && files.length > 0 ? (
              <div className="hidden shrink-0 grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-2 border-b border-border/60 px-4 py-2 text-xs font-medium text-[#444746] dark:text-[#c4c7c5] sm:grid lg:grid-cols-[minmax(0,1fr)_9.5rem_5.5rem_8.5rem] lg:gap-4">
                <span className="truncate pl-1">{t("drive.columnName")}</span>
                <span className="hidden lg:block">{t("drive.columnModified")}</span>
                <span className="hidden sm:block">{t("drive.columnSize")}</span>
                <span aria-hidden="true" />
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <FileCollection
                files={files}
                view={view}
                selection={selection}
                selectionDisabled={selectionDisabled}
                onOpen={onOpen}
                dimmedIds={dimmedIds}
                hasNextPage={hasNextPage}
                isLoadingMore={isLoadingMore}
                onLoadMore={onLoadMore}
                emptyHint={resolvedEmptyHint}
                emptyTitle={resolvedEmptyTitle}
                showLocations={showLocations}
                onOpenContainingFolder={onOpenContainingFolder}
                rowActions={rowActions}
              />
            </div>
          </>
        )}
      </Card.Content>
      {selectionOverlay}
    </Card>
  );
}

function FileCollection({
  files,
  view,
  selection,
  selectionDisabled,
  onOpen,

  dimmedIds,
  hasNextPage,
  isLoadingMore,
  onLoadMore,
  emptyHint,
  emptyTitle,
  showLocations,
  onOpenContainingFolder,
  rowActions,
}: {
  files: FileEntry[];
  view: FileBrowserView;
  selection?: FileBrowserProps["selection"];
  selectionDisabled: boolean;
  onOpen: (file: FileEntry) => void;

  dimmedIds?: ReadonlySet<string>;
  hasNextPage: boolean;
  isLoadingMore: boolean;
  onLoadMore?: () => void;
  emptyHint: string;
  emptyTitle: string;
  showLocations: boolean;
  onOpenContainingFolder?: (file: FileEntry) => void;
  rowActions?: FileRowActionHandlers;
}) {
  const grid = view === "grid";
  const { t } = useAppLocale();
  const selectedKeys = selection?.selectedKeys ?? new Set<React.Key>();
  const hasSelection = selection ? selectedKeys === "all" || selectedKeys.size > 0 : false;
  const gridRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<number | undefined>(undefined);
  const longPressStart = useRef<{ x: number; y: number } | undefined>(undefined);
  const longPressTriggered = useRef(false);
  const [gridWidth, setGridWidth] = useState(0);

  const compactList = gridWidth > 0 && gridWidth < 640;

  const toggleFileSelection = (id: string) => {
    if (!selection) return;
    const next =
      selectedKeys === "all"
        ? new Set(files.map((item) => item.id))
        : new Set(Array.from(selectedKeys, String));
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selection.onSelectionChange(next);
  };

  const enterFileSelection = (id: string) => {
    if (!selection) return;
    const next =
      selectedKeys === "all"
        ? new Set(files.map((item) => item.id))
        : new Set(Array.from(selectedKeys, String));
    next.add(id);
    selection.onSelectionChange(next);
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== undefined) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = undefined;
    }
    longPressStart.current = undefined;
  };

  useEffect(() => clearLongPress, []);

  useLayoutEffect(() => {
    const element = gridRef.current;
    if (!element) return;
    setGridWidth(element.clientWidth);
    const observer = new ResizeObserver(() => setGridWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [grid]);

  const collection = (
    <GridList
      ref={gridRef}
      aria-label={t("browser.files")}
      layout={grid ? "grid" : "stack"}
      selectionMode={selection ? "multiple" : "none"}
      selectionBehavior={compactList && hasSelection ? "toggle" : "replace"}
      selectedKeys={selection?.selectedKeys}
      onSelectionChange={selection?.onSelectionChange}
      disabledKeys={selectionDisabled ? files.map((file) => file.id) : undefined}
      disabledBehavior="selection"
      onClick={(event) => {
        if (!selection) return;
        const target = event.target as HTMLElement;
        if (!target.closest('[role="row"]')) selection.onClearSelection();
      }}
      onAction={(key) => {
        if (longPressTriggered.current) {
          longPressTriggered.current = false;
          return;
        }
        const id = String(key);
        if (compactList && hasSelection && selection) {
          toggleFileSelection(id);
          return;
        }
        const file = files.find((item) => item.id === id);
        if (file) onOpen(file);
      }}
      renderEmptyState={() => (
        <div className="flex min-h-80 flex-col items-center justify-center px-6 text-center">
          <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-default/30 text-muted">
            <FolderIcon className="size-5" />
          </div>
          <p className="text-sm font-medium">{emptyTitle}</p>
          <p className="mt-1 text-xs text-muted">{emptyHint}</p>
        </div>
      )}
      className={`h-full min-h-0 overflow-x-hidden overflow-y-auto outline-none ${hasSelection ? "pb-24" : ""}`}
    >
      <Collection
        items={files}
        dependencies={[
          dimmedIds,
          showLocations,
          onOpenContainingFolder,
          rowActions,
          onOpen,
          hasSelection,
          compactList,
        ]}
      >
        {(file) => (
          <GridListItem
            id={file.id}
            textValue={file.name}
            onPointerDown={(event) => {
              if (!selection || event.pointerType === "mouse") return;
              longPressTriggered.current = false;
              longPressStart.current = { x: event.clientX, y: event.clientY };
              clearLongPress();
              longPressTimer.current = window.setTimeout(() => {
                longPressTriggered.current = true;
                enterFileSelection(file.id);
              }, 420);
            }}
            onPointerMove={(event) => {
              if (!longPressStart.current) return;
              if (
                Math.abs(event.clientX - longPressStart.current.x) > 8 ||
                Math.abs(event.clientY - longPressStart.current.y) > 8
              ) {
                clearLongPress();
              }
            }}
            onPointerUp={clearLongPress}
            onPointerCancel={clearLongPress}
            className={(state) =>
              grid
                ? [
                    "group relative flex min-w-0 cursor-default flex-col rounded-2xl border border-transparent bg-[#f0f4f9]/75 p-2.5 outline-none transition-colors dark:bg-[#282a2c]/65",
                    state.isSelected
                      ? "border-accent/50 bg-[#c2e7ff]/45 dark:bg-[#23434c]"
                      : "hover:bg-[#e1e5ea]/80 dark:hover:bg-[#333537]",

                    dimmedIds?.has(file.id) && "opacity-45",
                    state.isFocusVisible && "ring-2 ring-inset ring-accent",
                  ]
                    .filter(Boolean)
                    .join(" ")
                : [
                    "group grid min-h-[64px] cursor-default grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-2 rounded-2xl bg-[#f4f7fb] px-3.5 py-2.5 outline-none transition-colors dark:bg-[#1c2425] sm:min-h-12 sm:grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] sm:rounded-none sm:border-b sm:border-border/50 sm:bg-transparent sm:px-4 sm:py-0 sm:last:border-b-0 sm:dark:bg-transparent lg:grid-cols-[minmax(0,1fr)_9.5rem_5.5rem_8.5rem] lg:gap-4",
                    state.isSelected
                      ? "bg-[#d3e3fd]! dark:bg-[#23434c]!"
                      : "hover:bg-[#eaf0f7] dark:hover:bg-[#253031] sm:hover:bg-[#f0f4f9] sm:dark:hover:bg-[#282a2c]/70",

                    dimmedIds?.has(file.id) && "opacity-45",
                    state.isFocusVisible && "ring-2 ring-inset ring-accent/30",
                  ]
                    .filter(Boolean)
                    .join(" ")
            }
          >
            {(state) =>
              grid ? (
                <GridFile
                  file={file}
                  selectable={Boolean(selection)}
                  inSelectionMode={hasSelection}
                  compactMenu={compactList}
                  onEnterSelection={selection ? () => enterFileSelection(file.id) : undefined}
                  showCheckbox={state.isHovered || state.isFocusVisible || state.isSelected}
                  location={showLocations ? file.parentPath : undefined}
                  onOpenContainingFolder={
                    onOpenContainingFolder ? () => onOpenContainingFolder(file) : undefined
                  }
                  onOpen={() => onOpen(file)}
                  rowActions={rowActions}
                />
              ) : (
                <ListFile
                  file={file}
                  selectable={Boolean(selection)}
                  inSelectionMode={hasSelection}
                  compactMenu={compactList}
                  onEnterSelection={selection ? () => enterFileSelection(file.id) : undefined}
                  showCheckbox={state.isHovered || state.isFocusVisible || state.isSelected}
                  location={showLocations ? file.parentPath : undefined}
                  onOpenContainingFolder={
                    onOpenContainingFolder ? () => onOpenContainingFolder(file) : undefined
                  }
                  onOpen={() => onOpen(file)}
                  rowActions={rowActions}
                />
              )
            }
          </GridListItem>
        )}
      </Collection>
      {hasNextPage ? (
        <GridListLoadMoreItem
          onLoadMore={() => onLoadMore?.()}
          isLoading={isLoadingMore}
          className="flex min-h-14 items-center justify-center p-4"
        >
          <Spinner size="sm" />
        </GridListLoadMoreItem>
      ) : null}
    </GridList>
  );

  return grid ? (
    <Virtualizer
      key="grid"
      layout={GridLayout}
      layoutOptions={{
        ...(showLocations ? locatedFileGridLayoutOptions : fileGridLayoutOptions),
        // Prefer ~196px cards, while allowing two smaller tiles in narrow panes.
        maxColumns: Math.max(2, Math.floor((gridWidth + 12) / 208)),
      }}
    >
      {collection}
    </Virtualizer>
  ) : (
    <Virtualizer
      key="list"
      layout={ListLayout}
      layoutOptions={compactList ? { gap: 6, padding: 12, estimatedRowSize: 64 } : undefined}
    >
      {collection}
    </Virtualizer>
  );
}

function SelectionCheckbox({
  file,
  isVisible,
  circle = false,
}: {
  file: FileEntry;
  isVisible: boolean;
  circle?: boolean;
}) {
  const { t } = useAppLocale();
  return (
    <Checkbox
      slot="selection"
      aria-label={t("browser.selectName", { name: file.name })}
      className={({ isSelected }) =>
        [
          "group/cb shrink-0 transition-opacity",
          isSelected || isVisible
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
        ].join(" ")
      }
    >
      <Checkbox.Content>
        {circle ? (
          <span
            data-slot="checkbox-control"
            className="inline-flex size-6 items-center justify-center rounded-full border-2 border-foreground/70 bg-transparent text-transparent transition-colors group-data-[selected=true]/cb:border-[#0b57d0] group-data-[selected=true]/cb:bg-[#0b57d0] group-data-[selected=true]/cb:text-white dark:border-[#c4c7c5] dark:group-data-[selected=true]/cb:border-[#b8dce6] dark:group-data-[selected=true]/cb:bg-[#b8dce6] dark:group-data-[selected=true]/cb:text-[#002026]"
          >
            <CheckIcon className="size-3.5 stroke-[2.5]" />
          </span>
        ) : (
          <Checkbox.Control className="border-muted/60 bg-transparent data-[selected=true]:border-accent data-[selected=true]:bg-accent before:hidden">
            <Checkbox.Indicator />
          </Checkbox.Control>
        )}
      </Checkbox.Content>
    </Checkbox>
  );
}

function GridFile({
  file,
  selectable,
  inSelectionMode,
  compactMenu,
  onEnterSelection,
  showCheckbox,
  location,
  onOpenContainingFolder,
  onOpen,
  rowActions,
}: {
  file: FileEntry;
  selectable: boolean;
  inSelectionMode: boolean;
  compactMenu: boolean;
  onEnterSelection?: () => void;
  showCheckbox: boolean;
  location?: string;
  onOpenContainingFolder?: () => void;
  onOpen: () => void;
  rowActions?: FileRowActionHandlers;
}) {
  const { t } = useAppLocale();
  const formatBytes = useFormatBytes();
  const formatDate = useDateOnlyFormatter();
  const formatDateTime = useDateTimeFormatter();
  const modified = new Date(file.modTime);
  return (
    <>
      {selectable ? (
        <div
          className={
            compactMenu
              ? inSelectionMode
                ? "absolute end-2.5 top-2.5 z-10 sm:hidden"
                : "hidden"
              : "absolute start-3 top-3 z-10"
          }
        >
          <SelectionCheckbox
            file={file}
            isVisible={showCheckbox || inSelectionMode}
            circle={compactMenu}
          />
        </div>
      ) : null}
      {rowActions && !(compactMenu && inSelectionMode) ? (
        <fieldset
          aria-label={t("drive.rowActions", { name: file.name })}
          className={[
            "absolute end-2.5 top-2.5 z-10 m-0 border-0 p-0 transition-opacity",
            showCheckbox ? "opacity-100" : "opacity-0 [@media(hover:none)]:opacity-100",
          ].join(" ")}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <FileItemActionsMenu
            file={file}
            onOpen={onOpen}
            rowActions={rowActions}
            compactMenu={compactMenu}
            onSelect={onEnterSelection}
          />
        </fieldset>
      ) : null}
      <div
        className="flex aspect-[16/11] w-full shrink-0 items-center justify-center rounded-xl bg-surface shadow-xs"
        aria-hidden="true"
        data-testid="file-grid-preview"
      >
        {file.kind === "folder" ? (
          <FolderIcon className="size-12 text-[#5f6368] dark:text-[#c4c7c5]" />
        ) : (
          <FileTypeIcon file={file} className="size-12 text-muted" />
        )}
      </div>
      <p
        className="mt-2 line-clamp-2 shrink-0 text-sm leading-5 [overflow-wrap:anywhere]"
        title={file.name}
      >
        {file.name}
      </p>
      {location && (
        <LocationButton
          location={location}
          onPress={onOpenContainingFolder}
          className="mt-1 h-4 shrink-0"
        />
      )}
      <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-[11px] leading-4 text-muted">
        <time className="truncate" dateTime={file.modTime} title={formatDateTime.format(modified)}>
          {formatDate.format(modified)}
        </time>
        <span className="shrink-0 text-end">
          {file.kind === "folder"
            ? file.size != null
              ? formatBytes(file.size)
              : t("browser.folderKind")
            : formatBytes(file.size ?? 0)}
        </span>
      </div>
    </>
  );
}

function ListFile({
  file,
  selectable,
  inSelectionMode,
  compactMenu,
  onEnterSelection,
  showCheckbox,
  location,
  onOpenContainingFolder,
  onOpen,
  rowActions,
}: {
  file: FileEntry;
  selectable: boolean;
  inSelectionMode: boolean;
  compactMenu: boolean;
  onEnterSelection?: () => void;
  showCheckbox: boolean;
  location?: string;
  onOpenContainingFolder?: () => void;
  onOpen: () => void;
  rowActions?: FileRowActionHandlers;
}) {
  const { t } = useAppLocale();
  const formatBytes = useFormatBytes();
  const formatDate = useDateOnlyFormatter();
  const formatDateTime = useDateTimeFormatter();
  const sizeText =
    file.kind === "folder"
      ? file.size != null
        ? formatBytes(file.size)
        : t("browser.folderKind")
      : formatBytes(file.size ?? 0);
  const modifiedDate = new Date(file.modTime);
  return (
    <>
      <div className="flex min-w-0 items-center gap-3.5 sm:gap-3">
        {selectable ? (
          <div className="hidden shrink-0 sm:block">
            <SelectionCheckbox file={file} isVisible={showCheckbox} />
          </div>
        ) : null}
        <div
          className={
            file.kind === "folder"
              ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-transparent sm:size-8 sm:rounded-lg sm:bg-[#f0f4f9] sm:dark:bg-[#282a2c]"
              : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs dark:bg-[#121819] sm:size-8 sm:rounded-lg sm:bg-[#f0f4f9] sm:shadow-none sm:dark:bg-[#282a2c]"
          }
        >
          {file.kind === "folder" ? (
            <FolderIcon className="size-7 text-[#5f6368] dark:text-[#b4c5c8] sm:size-4.5 sm:dark:text-[#c4c7c5]" />
          ) : (
            <FileTypeIcon file={file} className="size-5.5 sm:size-4.5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span
            className="block truncate text-[15px] font-normal text-foreground group-hover:text-[#0b57d0] dark:group-hover:text-[#a8c7fa] sm:text-sm sm:font-medium"
            title={file.name}
          >
            {file.name}
          </span>
          {location ? (
            <LocationButton location={location} onPress={onOpenContainingFolder} />
          ) : null}
          <span className="mt-0.5 block truncate text-xs text-muted sm:hidden">
            {file.kind === "folder"
              ? formatDate.format(modifiedDate)
              : `${formatDate.format(modifiedDate)} • ${sizeText}`}
          </span>
        </div>
      </div>
      <time
        className="hidden min-w-0 truncate text-xs text-muted lg:block"
        dateTime={file.modTime}
        title={formatDateTime.format(modifiedDate)}
      >
        {formatDate.format(modifiedDate)}
      </time>
      <span className="hidden truncate text-xs text-muted sm:block">{sizeText}</span>
      <fieldset
        aria-label={t("drive.rowActions", { name: file.name })}
        className="m-0 flex shrink-0 items-center justify-end gap-0.5 border-0 p-0"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {rowActions ? (
          <>
            <div className="hidden lg:flex lg:items-center lg:gap-0.5 lg:opacity-0 lg:transition-opacity lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
              {rowActions.onShare ? (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="size-7 rounded-full text-muted hover:text-foreground"
                  aria-label={t("drive.actionShare")}
                  onPress={() => rowActions.onShare?.(file)}
                >
                  <LinkIcon className="size-3.5" />
                </Button>
              ) : null}
              {file.kind === "file" && rowActions.onDownload ? (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="size-7 rounded-full text-muted hover:text-foreground"
                  aria-label={t("drive.actionDownload")}
                  onPress={() => rowActions.onDownload?.(file)}
                >
                  <DownloadIcon className="size-3.5" />
                </Button>
              ) : null}
              {rowActions.onRename ? (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="size-7 rounded-full text-muted hover:text-foreground"
                  aria-label={t("drive.actionRename")}
                  onPress={() => rowActions.onRename?.(file)}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
              ) : null}
              {rowActions.onBookmark ? (
                <Button
                  isIconOnly
                  size="sm"
                  variant="ghost"
                  className="size-7 rounded-full text-muted hover:text-foreground"
                  aria-label={
                    rowActions.isBookmarked
                      ? t("drive.actionBookmarkRemove")
                      : t("drive.actionBookmarkAdd")
                  }
                  onPress={() => rowActions.onBookmark?.(file)}
                >
                  <BookmarkIcon className="size-3.5" />
                </Button>
              ) : null}
            </div>
            {selectable && inSelectionMode ? (
              <div className="flex items-center justify-center sm:hidden">
                <SelectionCheckbox file={file} isVisible circle />
              </div>
            ) : null}
            <div className={inSelectionMode ? "hidden sm:block" : undefined}>
              <FileItemActionsMenu
                file={file}
                onOpen={onOpen}
                rowActions={rowActions}
                compactMenu={compactMenu}
                onSelect={onEnterSelection}
              />
            </div>
          </>
        ) : selectable && inSelectionMode ? (
          <div className="flex items-center justify-center sm:hidden">
            <SelectionCheckbox file={file} isVisible circle />
          </div>
        ) : null}
      </fieldset>
    </>
  );
}

function FileItemActionsMenu({
  file,
  onOpen,
  rowActions,
  compactMenu = false,
  onSelect,
}: {
  file: FileEntry;
  onOpen: () => void;
  rowActions: FileRowActionHandlers;
  compactMenu?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useAppLocale();
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  if (compactMenu) {
    return (
      <>
        <Button
          isIconOnly
          size="sm"
          variant="ghost"
          className="size-8 rounded-full text-muted hover:bg-[#e1e5ea]/80 hover:text-foreground dark:hover:bg-[#333538]"
          aria-label={t("drive.rowActions", { name: file.name })}
          onPress={() => setSheetOpen(true)}
        >
          <MoreIcon className="size-4" />
        </Button>
        {sheetOpen
          ? createPortal(
              <div
                className="fixed inset-0 z-[90] flex flex-col justify-end"
                role="dialog"
                aria-modal="true"
                aria-label={file.name}
              >
                <div
                  aria-hidden="true"
                  className="fixed inset-0 bg-black/55"
                  onClick={() => setSheetOpen(false)}
                />
                <div className="relative z-10 max-h-[82dvh] w-full overflow-y-auto rounded-t-[28px] bg-[#f8fafd] px-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl dark:bg-[#192223]">
                  <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-muted/40" />
                  <div className="mb-1 flex items-center gap-3.5 border-b border-border/50 px-4 pb-3">
                    {file.kind === "folder" ? (
                      <FolderIcon className="size-6 shrink-0 text-[#5f6368] dark:text-[#b4c5c8]" />
                    ) : (
                      <FileTypeIcon file={file} className="size-6 shrink-0" />
                    )}
                    <p className="min-w-0 flex-1 truncate text-base font-medium text-foreground">
                      {file.name}
                    </p>
                  </div>
                  <div className="flex flex-col py-1">
                    {onSelect ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          onSelect();
                        }}
                      >
                        <CheckIcon className="size-5 shrink-0 text-muted" />
                        {t("drive.actionSelect")}
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                      onPress={() => {
                        setSheetOpen(false);
                        onOpen();
                      }}
                    >
                      <FolderIcon className="size-5 shrink-0 text-muted" />
                      {t("drive.actionOpen")}
                    </Button>
                    {rowActions.onShare ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onShare?.(file);
                        }}
                      >
                        <LinkIcon className="size-5 shrink-0 text-muted" />
                        {t("drive.actionShare")}
                      </Button>
                    ) : null}
                    {file.kind === "file" && rowActions.onCopyLink ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onCopyLink?.(file);
                        }}
                      >
                        <CopyLinkIcon className="size-5 shrink-0 text-muted" />
                        {t("drive.actionCopyLink")}
                      </Button>
                    ) : null}
                    {rowActions.onBookmark ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onBookmark?.(file);
                        }}
                      >
                        <BookmarkIcon className="size-5 shrink-0 text-muted" />
                        {rowActions.isBookmarked
                          ? t("drive.actionBookmarkRemove")
                          : t("drive.actionBookmarkAdd")}
                      </Button>
                    ) : null}
                    <Separator className="my-1.5" />
                    {rowActions.onRename ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onRename?.(file);
                        }}
                      >
                        <PencilIcon className="size-5 shrink-0 text-muted" />
                        {t("drive.actionRename")}
                      </Button>
                    ) : null}
                    {file.kind === "file" && rowActions.onDownload ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onDownload?.(file);
                        }}
                      >
                        <DownloadIcon className="size-5 shrink-0 text-muted" />
                        {t("drive.actionDownload")}
                      </Button>
                    ) : null}
                    {file.kind === "file" && rowActions.onVersions ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onVersions?.(file);
                        }}
                      >
                        <ClockIcon className="size-5 shrink-0 text-muted" />
                        {t("versions.action")}
                      </Button>
                    ) : null}
                    {rowActions.onMove ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onMove?.(file);
                        }}
                      >
                        <MoveIcon className="size-5 shrink-0 text-muted" />
                        {t("drive.actionMove")}
                      </Button>
                    ) : null}
                    {rowActions.onCopy ? (
                      <Button
                        variant="ghost"
                        className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-foreground"
                        onPress={() => {
                          setSheetOpen(false);
                          rowActions.onCopy?.(file);
                        }}
                      >
                        <CopyIcon className="size-5 shrink-0 text-muted" />
                        {t("drive.actionCopy")}
                      </Button>
                    ) : null}
                    {rowActions.onTrash ? (
                      <>
                        <Separator className="my-1.5" />
                        <Button
                          variant="ghost"
                          className="h-12 w-full justify-start gap-4 rounded-xl px-4 text-[15px] font-normal text-danger"
                          onPress={() => {
                            setSheetOpen(false);
                            rowActions.onTrash?.(file);
                          }}
                        >
                          <TrashIcon className="size-5 shrink-0 text-danger" />
                          {t("drive.actionTrash")}
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </>
    );
  }

  return (
    <Dropdown>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        className="size-8 rounded-full text-muted hover:bg-[#e1e5ea]/80 hover:text-foreground dark:hover:bg-[#333538]"
        aria-label={t("drive.rowActions", { name: file.name })}
      >
        <MoreIcon className="size-4" />
      </Button>
      <Dropdown.Popover placement="bottom end" className="min-w-48 rounded-2xl p-1.5">
        <Dropdown.Menu
          aria-label={t("drive.rowActions", { name: file.name })}
          onAction={(key) => {
            if (key === "open") onOpen();
            else if (key === "download") rowActions.onDownload?.(file);
            else if (key === "share") rowActions.onShare?.(file);
            else if (key === "copy-link") rowActions.onCopyLink?.(file);
            else if (key === "rename") rowActions.onRename?.(file);
            else if (key === "bookmark") rowActions.onBookmark?.(file);
            else if (key === "move") rowActions.onMove?.(file);
            else if (key === "copy") rowActions.onCopy?.(file);
            else if (key === "versions") rowActions.onVersions?.(file);
            else if (key === "trash") rowActions.onTrash?.(file);
          }}
        >
          <Dropdown.Item id="open" textValue={t("drive.actionOpen")}>
            <FolderIcon className="size-4" />
            <Label>{t("drive.actionOpen")}</Label>
          </Dropdown.Item>
          {file.kind === "file" && rowActions.onDownload ? (
            <Dropdown.Item id="download" textValue={t("drive.actionDownload")}>
              <DownloadIcon className="size-4" />
              <Label>{t("drive.actionDownload")}</Label>
            </Dropdown.Item>
          ) : null}
          {rowActions.onShare ? (
            <Dropdown.Item id="share" textValue={t("drive.actionShare")}>
              <LinkIcon className="size-4" />
              <Label>{t("drive.actionShare")}</Label>
            </Dropdown.Item>
          ) : null}
          {file.kind === "file" && rowActions.onCopyLink ? (
            <Dropdown.Item id="copy-link" textValue={t("drive.actionCopyLink")}>
              <CopyLinkIcon className="size-4" />
              <Label>{t("drive.actionCopyLink")}</Label>
            </Dropdown.Item>
          ) : null}
          {rowActions.onRename ? (
            <Dropdown.Item id="rename" textValue={t("drive.actionRename")}>
              <PencilIcon className="size-4" />
              <Label>{t("drive.actionRename")}</Label>
            </Dropdown.Item>
          ) : null}
          {rowActions.onBookmark ? (
            <Dropdown.Item
              id="bookmark"
              textValue={
                rowActions.isBookmarked
                  ? t("drive.actionBookmarkRemove")
                  : t("drive.actionBookmarkAdd")
              }
            >
              <BookmarkIcon className="size-4" />
              <Label>
                {rowActions.isBookmarked
                  ? t("drive.actionBookmarkRemove")
                  : t("drive.actionBookmarkAdd")}
              </Label>
            </Dropdown.Item>
          ) : null}
          {rowActions.onMove ? (
            <Dropdown.Item id="move" textValue={t("drive.actionMove")}>
              <MoveIcon className="size-4" />
              <Label>{t("drive.actionMove")}</Label>
            </Dropdown.Item>
          ) : null}
          {rowActions.onCopy ? (
            <Dropdown.Item id="copy" textValue={t("drive.actionCopy")}>
              <CopyIcon className="size-4" />
              <Label>{t("drive.actionCopy")}</Label>
            </Dropdown.Item>
          ) : null}
          {file.kind === "file" && rowActions.onVersions ? (
            <Dropdown.Item id="versions" textValue={t("versions.action")}>
              <ClockIcon className="size-4" />
              <Label>{t("versions.action")}</Label>
            </Dropdown.Item>
          ) : null}
          {rowActions.onTrash ? (
            <>
              <Separator className="my-1" />
              <Dropdown.Item id="trash" textValue={t("drive.actionTrash")} className="text-danger">
                <TrashIcon className="size-4" />
                <Label>{t("drive.actionTrash")}</Label>
              </Dropdown.Item>
            </>
          ) : null}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function LocationButton({
  location,
  onPress,
  className = "",
}: {
  location: string;
  onPress?: () => void;
  className?: string;
}) {
  const { t } = useAppLocale();
  return (
    <Button
      size="sm"
      variant="ghost"
      className={`h-auto min-h-0 max-w-full justify-start rounded-sm px-0 py-0 text-[11px] text-muted ${className}`}
      aria-label={t("browser.openFolder", { location })}
      onPress={onPress}
    >
      <span className="truncate">{location}</span>
    </Button>
  );
}

function FileBrowserBreadcrumb({
  path,
  rootLabel,
  onNavigatePath,
}: {
  path: string;
  rootLabel: string;
  onNavigatePath: (path: string) => void;
}) {
  const parts = path.split("/").filter(Boolean);
  const lastIndex = parts.length - 1;
  const { t } = useAppLocale();
  return (
    <nav
      aria-label={t("browser.currentFolder")}
      className="flex min-w-0 items-center gap-1 overflow-hidden text-sm"
    >
      <Button
        size="sm"
        variant="ghost"
        aria-label={rootLabel}
        className={
          parts.length === 0
            ? "inline-flex! h-9! w-auto! max-w-none! shrink-0! justify-start! gap-2.5! overflow-visible! rounded-full! px-3! text-lg font-normal text-foreground @lg/file-browser:text-[22px]"
            : "hidden h-8 max-w-9 shrink-0 gap-2 overflow-hidden rounded-full px-2.5 text-muted hover:text-foreground sm:inline-flex @lg/file-browser:max-w-48"
        }
        onPress={() => onNavigatePath("/")}
      >
        <FolderIcon className="size-4 shrink-0" />
        <span
          className={
            parts.length === 0 ? "whitespace-nowrap" : "hidden truncate @lg/file-browser:inline"
          }
        >
          {rootLabel}
        </span>
      </Button>
      {parts.map((part, index) => {
        const currentPath = `/${parts.slice(0, index + 1).join("/")}`;
        const isCurrent = index === lastIndex;
        const isParent = index === lastIndex - 1;
        const visibility = isCurrent
          ? "flex"
          : isParent
            ? "hidden @md/file-browser:flex"
            : "hidden @4xl/file-browser:flex";
        return (
          <span key={currentPath} className={`${visibility} min-w-0 items-center gap-1`}>
            <ChevronRightIcon
              className={
                index === 0
                  ? "hidden size-4 shrink-0 text-muted/60 sm:block"
                  : "size-4 shrink-0 text-muted/60"
              }
            />
            {isCurrent ? (
              <span
                aria-current="page"
                className="min-w-0 truncate px-1.5 text-lg font-normal text-foreground @lg/file-browser:text-[22px]"
                title={part}
              >
                {part}
              </span>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 min-w-0 max-w-40 truncate rounded-full px-2.5 text-muted hover:text-foreground"
                onPress={() => onNavigatePath(currentPath)}
              >
                {part}
              </Button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
