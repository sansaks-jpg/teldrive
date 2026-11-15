import { Button, Dropdown, Input, Label, TextField } from "@heroui/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useKeyboard } from "react-aria/useKeyboard";
import { DropZone, FileTrigger, type Selection } from "react-aria-components";
import { toast } from "sonner";
import { normalizeApiError, userMessage } from "@/api/errors";
import type { FileEntry } from "@/api/types";
import { currentUserQueryOptions } from "@/auth/queries";
import { BackgroundUploadDialog } from "@/components/background-upload-dialog";
import { AppDialog } from "@/components/dialogs/app-dialog";
import { isPreviewable } from "@/components/file-preview-dialog";
import { subscribeWorkspaceAction } from "@/components/google-workspace";
import { Page, PageContent } from "@/components/page";
import { useUploadStore } from "@/features/uploads/store";
import { useAppLocale } from "@/lib/locale";
import { usePreferences, useUpdatePreferences } from "@/lib/preferences";
import PasteIcon from "~icons/gravity-ui/arrow-right-to-square";
import ChevronDownIcon from "~icons/gravity-ui/chevron-down";
import SplitIcon from "~icons/gravity-ui/layout-split-columns";
import CloseIcon from "~icons/gravity-ui/xmark";
import { useFileClipboardStore } from "./clipboard-store";
import {
  absoluteFileDownloadUrl,
  copyText,
  downloadEntriesAsZip,
  startFileDownload,
} from "./download";
import { FileActionDialogs } from "./file-action-dialogs";
import { FileBrowser } from "./file-browser";
import { FileSelectionToolbar } from "./file-selection-toolbar";
import { FileSortControls } from "./file-sort-controls";
import { useFileActions } from "./mutations";
import { useInfiniteFilePages } from "./queries";
import { SearchControls } from "./search-controls";
import {
  driveSearchOptions,
  hasSearchCriteria,
  invalidSearchDates,
  type SearchState,
} from "./search-state";
import type { FileSort, SortOrder } from "./sort-preference";

type FileBrowserView = "list" | "grid";
type PaneId = "primary" | "secondary";

type PaneLocation = {
  path: string;
  parentId?: string;
  query: string;
  view: FileBrowserView;
};

export type FilesLocation = PaneLocation & {
  sort?: FileSort;
  order?: SortOrder;
  split?: boolean;
  secondaryPath?: string;
  secondaryParentId?: string;
  secondaryQuery?: string;
  secondaryView?: FileBrowserView;
  bookmarked?: boolean;
  recent?: boolean;
};

export function FileManagerPage({
  location: search,
  onLocationChange,
  searchMode,
}: {
  location: FilesLocation;
  onLocationChange: (location: FilesLocation, replace?: boolean) => void;
  searchMode?: {
    criteria: SearchState;
    onChange: (search: SearchState, replace?: boolean) => void;
  };
}) {
  const navigateTo = useNavigate();
  const savedSort = usePreferences()?.files ?? { sort: "name" as const, order: "asc" as const };
  const { mutate: updatePreferences } = useUpdatePreferences();
  const sorting = search.recent
    ? { sort: "updatedAt" as const, order: "desc" as const }
    : { sort: search.sort ?? savedSort.sort, order: search.order ?? savedSort.order };
  const [recentAfter] = useState(() =>
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  );
  const recentCriteria = search.recent
    ? {
        scope: "drive" as const,
        kind: "file" as const,
        updatedAfter: recentAfter,
        parentId: undefined,
        bookmarked: undefined,
      }
    : {};
  const changeSorting = (next: typeof sorting) => {
    updatePreferences({ files: { sort: next.sort, order: next.order } });
    onLocationChange({ ...search, ...next }, true);
  };
  const navigate = ({ search: next, replace }: { search: FilesLocation; replace?: boolean }) =>
    onLocationChange(next, replace);
  const criteria = searchMode?.criteria;
  const missingFolder = criteria?.scope === "recursive" && !criteria.parentId;
  const invalidDates = criteria ? invalidSearchDates(criteria) : false;
  const activeSearch = criteria ? hasSearchCriteria(criteria) : true;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const { data: currentUser } = useQuery(currentUserQueryOptions());
  const canLocalImport = Boolean(currentUser?.capabilities.includes("system.localImport"));

  const primaryLocation: PaneLocation = {
    path: search.path,
    parentId: search.parentId,
    query: search.query,
    view: search.view,
  };
  const secondaryLocation: PaneLocation = search.secondaryPath
    ? {
        path: search.secondaryPath,
        parentId: search.secondaryParentId,
        query: search.secondaryQuery ?? "",
        view: search.secondaryView ?? search.view,
      }
    : primaryLocation;

  const [activePane, setActivePane] = useState<PaneId>("primary");
  const activePaneRef = useRef<PaneId>("primary");
  const [primarySelectedKeys, setPrimarySelectedKeys] = useState<Selection>(new Set());
  const [secondarySelectedKeys, setSecondarySelectedKeys] = useState<Selection>(new Set());
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [backgroundUploadOpen, setBackgroundUploadOpen] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [previewFile, setPreviewFile] = useState<FileEntry>();
  const [renameFile, setRenameFile] = useState<FileEntry>();
  const [renameName, setRenameName] = useState("");
  const [destination, setDestination] = useState<{
    mode: "move" | "copy";
    files: FileEntry[];
    pane: PaneId;
  }>();
  const [actionError, setActionError] = useState<string>();
  const operationLock = useRef(false);
  const [operationPending, setOperationPending] = useState(false);
  const [shareFile, setShareFile] = useState<FileEntry>();
  const [versionsFile, setVersionsFile] = useState<FileEntry>();
  const [pasteConflictPane, setPasteConflictPane] = useState<PaneId>();
  const primaryUploadFilesTriggerRef = useRef<HTMLButtonElement>(null);
  const primaryUploadFolderTriggerRef = useRef<HTMLButtonElement>(null);
  const secondaryUploadFilesTriggerRef = useRef<HTMLButtonElement>(null);
  const secondaryUploadFolderTriggerRef = useRef<HTMLButtonElement>(null);
  const enqueue = useUploadStore((state) => state.enqueue);
  const fileActions = useFileActions();
  const pending = operationPending || fileActions.pending;
  const { t } = useAppLocale();

  const clipboardMode = useFileClipboardStore((state) => state.mode);
  const clipboardItems = useFileClipboardStore((state) => state.items);
  const clipboardSourceParentId = useFileClipboardStore((state) => state.sourceParentId);
  const clipboardSourcePane = useFileClipboardStore((state) => state.sourcePane);
  const setClipboard = useFileClipboardStore((state) => state.set);
  const clearClipboard = useFileClipboardStore((state) => state.clear);

  const primaryFileQuery = useInfiniteFilePages(
    {
      path: primaryLocation.path,
      parentId: primaryLocation.parentId,
      q: primaryLocation.query || undefined,
      ...sorting,
      view: primaryLocation.view,
      ...(criteria ? driveSearchOptions(criteria) : {}),
      bookmarked: search.bookmarked,
      ...recentCriteria,
    },
    "active",
    activeSearch && !missingFolder && !invalidDates,
  );
  const secondaryFileQuery = useInfiniteFilePages(
    {
      path: secondaryLocation.path,
      parentId: secondaryLocation.parentId,
      q: secondaryLocation.query || undefined,
      ...sorting,
      view: secondaryLocation.view,
      bookmarked: search.bookmarked,
      ...recentCriteria,
    },
    "active",
    Boolean(search.split) && !searchMode,
  );
  const primaryFiles = primaryFileQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const secondaryFiles = secondaryFileQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const primaryCriteriaKey = JSON.stringify({
    ...sorting,
    path: primaryLocation.path,
    bookmarked: search.bookmarked,
    recent: search.recent,
    ...(criteria
      ? driveSearchOptions(criteria)
      : {
          parentId: primaryLocation.parentId,
          q: primaryLocation.query,
        }),
  });
  useEffect(() => setPrimarySelectedKeys(new Set()), [primaryCriteriaKey]);
  useEffect(
    () => setSecondarySelectedKeys(new Set()),
    [secondaryLocation.parentId, secondaryLocation.path, secondaryLocation.query],
  );
  useEffect(() => {
    if (!search.split) {
      activePaneRef.current = "primary";
      if (activePane === "secondary") setActivePane("primary");
    }
  }, [activePane, search.split]);

  useEffect(() => {
    if (searchMode) return;
    return subscribeWorkspaceAction((action) => {
      const pane = activePaneRef.current;
      if (action === "drive:new-folder") {
        setActivePane(pane);
        setFolderDialogOpen(true);
      } else if (action === "drive:upload-files") {
        const ref =
          pane === "secondary" && search.split
            ? secondaryUploadFilesTriggerRef
            : primaryUploadFilesTriggerRef;
        ref.current?.click();
      } else if (action === "drive:upload-folder") {
        const ref =
          pane === "secondary" && search.split
            ? secondaryUploadFolderTriggerRef
            : primaryUploadFolderTriggerRef;
        ref.current?.click();
      } else if (action === "drive:background-upload" && canLocalImport) {
        setActivePane(pane);
        setBackgroundUploadOpen(true);
      }
    });
  }, [canLocalImport, search.split, searchMode]);

  const primarySelectedIds = selectionIds(primarySelectedKeys, primaryFiles);
  const secondarySelectedIds = selectionIds(secondarySelectedKeys, secondaryFiles);
  const primarySelectedFiles = primaryFiles.filter((file) => primarySelectedIds.includes(file.id));
  const secondarySelectedFiles = secondaryFiles.filter((file) =>
    secondarySelectedIds.includes(file.id),
  );
  const activeLocation =
    activePane === "secondary" && search.split ? secondaryLocation : primaryLocation;

  const cutIds =
    clipboardMode === "cut" ? new Set(clipboardItems.map((file) => file.id)) : undefined;
  const hasClipboard = Boolean(clipboardMode && clipboardItems.length > 0);

  const paneLocation = (pane: PaneId) =>
    pane === "secondary" && search.split ? secondaryLocation : primaryLocation;
  const paneFiles = (pane: PaneId) =>
    pane === "secondary" && search.split ? secondaryFiles : primaryFiles;
  const paneSelectedKeys = (pane: PaneId) =>
    pane === "secondary" && search.split ? secondarySelectedKeys : primarySelectedKeys;
  const paneSelectedFiles = (pane: PaneId) =>
    pane === "secondary" && search.split ? secondarySelectedFiles : primarySelectedFiles;
  const setPaneSelectedKeys = (pane: PaneId, selection: Selection) => {
    if (searchMode && primaryFileQuery.isPlaceholderData) return;
    if (selection === "all") selection = new Set(paneFiles(pane).map((file) => file.id));
    activePaneRef.current = pane;
    if (pane === "secondary") setSecondarySelectedKeys(selection);
    else setPrimarySelectedKeys(selection);
  };

  const navigatePane = (pane: PaneId, location: PaneLocation, replace = false) => {
    if (pane === "secondary") {
      navigate({
        search: {
          ...search,
          split: true,
          secondaryPath: location.path,
          secondaryParentId: location.parentId,
          secondaryQuery: location.query,
          secondaryView: location.view,
        },
        replace,
      });
      return;
    }
    navigate({
      search: {
        ...search,
        path: location.path,
        parentId: location.parentId,
        query: location.query,
        view: location.view,
      },
      replace,
    });
  };

  const openSplitView = () => {
    if (search.split) return;
    setSecondarySelectedKeys(new Set());
    navigate({
      search: {
        ...search,
        split: true,
        secondaryPath: primaryLocation.path,
        secondaryParentId: primaryLocation.parentId,
        secondaryQuery: primaryLocation.query,
        secondaryView: primaryLocation.view,
      },
    });
  };

  const closeSplitView = () => {
    setActivePane("primary");
    setSecondarySelectedKeys(new Set());
    navigate({
      search: {
        path: primaryLocation.path,
        parentId: primaryLocation.parentId,
        query: primaryLocation.query,
        view: primaryLocation.view,
        split: false,
      },
    });
  };

  const createFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    try {
      await fileActions.createFolder(name, activeLocation.parentId);
      setFolderName("");
      setFolderDialogOpen(false);
      toast.success(t("files.folderCreated"));
    } catch (error) {
      toast.error(t("files.folderCreateFailed"), { description: userMessage(error) });
    }
  };

  const performAction = async (
    operation: () => Promise<unknown>,
    successMessage: string,
    failureMessage: string,
    onSuccess: () => void,
    inlineError = false,
  ) => {
    if (operationLock.current) return;
    operationLock.current = true;
    setOperationPending(true);
    setActionError(undefined);
    try {
      await operation();
      onSuccess();
      toast.success(successMessage);
    } catch (error) {
      if (inlineError) setActionError(`${failureMessage}. ${userMessage(error)}`);
      else toast.error(failureMessage, { description: userMessage(error) });
    } finally {
      operationLock.current = false;
      setOperationPending(false);
    }
  };

  const trashFiles = async (ids: string[], pane: PaneId) => {
    if (ids.length === 0 || pending) return;
    await performAction(
      () => fileActions.bulkTrash(ids),
      t(ids.length === 1 ? "files.trashedOne" : "files.trashedMany", { count: ids.length }),
      t("files.trashFailed"),
      () => setPaneSelectedKeys(pane, new Set()),
    );
  };

  const trashSelected = async (pane: PaneId) => {
    const files = paneSelectedFiles(pane);
    await trashFiles(
      files.map((file) => file.id),
      pane,
    );
  };

  const bookmarkIds = async (ids: string[], pane: PaneId) => {
    if (ids.length === 0 || pending) return;
    await performAction(
      () => (search.bookmarked ? fileActions.removeBookmarks(ids) : fileActions.bookmarkFiles(ids)),
      search.bookmarked
        ? t(ids.length === 1 ? "manager.unbookmarkedOne" : "manager.unbookmarkedMany", {
            count: ids.length,
          })
        : t(ids.length === 1 ? "manager.bookmarkedOne" : "manager.bookmarkedMany", {
            count: ids.length,
          }),
      search.bookmarked ? t("manager.unbookmarkFailed") : t("manager.bookmarkFailed"),
      () => setPaneSelectedKeys(pane, new Set()),
    );
  };

  const toggleBookmarks = async (pane: PaneId) => {
    const files = paneSelectedFiles(pane);
    await bookmarkIds(
      files.map((file) => file.id),
      pane,
    );
  };

  const renameSelected = async () => {
    if (!renameFile || !renameName.trim() || pending) return;
    await performAction(
      () => fileActions.rename(renameFile, renameName.trim()),
      t("files.renamed"),
      t("files.renameFailed"),
      () => {
        setRenameFile(undefined);
        setRenameName("");
        setPaneSelectedKeys(activePane, new Set());
      },
      true,
    );
  };

  const transferSelected = async (parentId?: string) => {
    const target = destination;
    if (!target || target.files.length === 0 || pending) return;
    await performAction(
      async () => {
        if (target.mode === "copy") return fileActions.copyMany(target.files, parentId, "rename");
        if (target.files.length === 1) return fileActions.move(target.files[0], parentId, "rename");
        return fileActions.bulkMove(
          target.files.map((file) => file.id),
          parentId,
        );
      },
      t(
        target.mode === "copy"
          ? target.files.length === 1
            ? "manager.copiedOne"
            : "manager.copiedMany"
          : target.files.length === 1
            ? "manager.movedOne"
            : "manager.movedMany",
        { count: target.files.length },
      ),
      target.mode === "copy" ? t("manager.copyFailed") : t("manager.moveFailed"),
      () => {
        setDestination(undefined);
        setPaneSelectedKeys(target.pane, new Set());
      },
      true,
    );
  };

  const stageClipboard = (mode: "copy" | "cut", pane: PaneId) => {
    const files = paneSelectedFiles(pane);
    if (files.length === 0) return;
    if (searchMode && mode === "copy") {
      setActionError(undefined);
      setDestination({ mode: "copy", files: [...files], pane });
      return;
    }
    const location = paneLocation(pane);
    setClipboard(mode, files, location.parentId, location.path, pane);
    setPaneSelectedKeys(pane, new Set());
  };

  const pasteClipboard = async (
    pane: PaneId,
    cutConflictPolicy: "fail" | "rename" | "replace" = "fail",
  ) => {
    if (!clipboardMode || clipboardItems.length === 0) return;
    const location = paneLocation(pane);
    if (clipboardMode === "cut" && clipboardSourceParentId === location.parentId) {
      toast.info(t("manager.alreadyHere"));
      return;
    }
    try {
      if (clipboardMode === "copy") {
        await fileActions.copyMany(clipboardItems, location.parentId, "rename");
      } else if (clipboardItems.length === 1) {
        await fileActions.move(clipboardItems[0], location.parentId, cutConflictPolicy);
      } else {
        await fileActions.bulkMove(
          clipboardItems.map((file) => file.id),
          location.parentId,
          cutConflictPolicy,
        );
      }
      const count = clipboardItems.length;
      const action = t(clipboardMode === "copy" ? "manager.actionCopied" : "manager.actionMoved");
      setPasteConflictPane(undefined);
      if (clipboardMode === "cut") clearClipboard();
      setPaneSelectedKeys(pane, new Set());
      toast.success(t(count === 1 ? "manager.pastedOne" : "manager.pastedMany", { count, action }));
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (clipboardMode === "cut" && cutConflictPolicy === "fail" && normalized.status === 409) {
        setPasteConflictPane(pane);
        return;
      }
      toast.error(t("manager.pasteFailed"), { description: userMessage(error) });
    }
  };

  const navigateToParent = (pane: PaneId) => {
    const location = paneLocation(pane);
    if (location.path === "/") return;
    const parts = location.path.split("/").filter(Boolean);
    const parentPath = parts.length <= 1 ? "/" : `/${parts.slice(0, -1).join("/")}`;
    navigatePane(pane, { path: parentPath, query: "", view: location.view });
  };

  const { keyboardProps } = useKeyboard({
    onKeyDown: (event) => {
      if (
        event.defaultPrevented ||
        event.nativeEvent.isComposing ||
        pending ||
        primaryFileQuery.isPlaceholderData ||
        folderDialogOpen ||
        renameFile ||
        destination ||
        shareFile ||
        previewFile ||
        pasteConflictPane ||
        (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]')) ||
        isEditableTarget(event.target)
      ) {
        event.continuePropagation();
        return;
      }
      const pane = activePaneRef.current;
      const selectedFiles = paneSelectedFiles(pane);
      const selectedIds = selectedFiles.map((file) => file.id);
      const singleSelectedFile = selectedFiles.length === 1 ? selectedFiles[0] : undefined;
      const command = event.ctrlKey || event.metaKey;

      const key = event.key.toLowerCase();
      if (command && key === "c" && selectedFiles.length > 0) {
        event.preventDefault();
        stageClipboard("copy", pane);
        return;
      }
      if (!searchMode && !search.recent && command && key === "x" && selectedFiles.length > 0) {
        event.preventDefault();
        stageClipboard("cut", pane);
        return;
      }
      if (!searchMode && !search.recent && command && key === "v" && hasClipboard) {
        event.preventDefault();
        void pasteClipboard(pane);
        return;
      }
      if (event.key === "F2" && singleSelectedFile) {
        event.preventDefault();
        setActivePane(pane);
        setRenameFile(singleSelectedFile);
        setActionError(undefined);
        setRenameName(singleSelectedFile.name);
        return;
      }
      if (event.key === "Delete" && selectedIds.length > 0) {
        event.preventDefault();
        void trashSelected(pane);
        return;
      }
      if (
        !searchMode &&
        !search.recent &&
        command &&
        event.shiftKey &&
        event.key.toLowerCase() === "n"
      ) {
        event.preventDefault();
        setActivePane(pane);
        setFolderDialogOpen(true);
        return;
      }
      if (!searchMode && event.altKey && event.key === "ArrowUp") {
        event.preventDefault();
        navigateToParent(pane);
        return;
      }
      event.continuePropagation();
    },
  });

  const openFile = (file: FileEntry, pane: PaneId) => {
    activePaneRef.current = pane;
    setActivePane(pane);
    if (file.kind === "folder") {
      const location = paneLocation(pane);
      if (searchMode || search.bookmarked) {
        void navigateTo({
          to: "/files",
          search: {
            path: joinPath(file.parentPath ?? "/", file.name),
            parentId: file.id,
            query: "",
            view: location.view,
            bookmarked: undefined,
          },
        });
        return;
      }
      navigatePane(pane, {
        path: joinPath(location.path, file.name),
        parentId: file.id,
        query: "",
        view: location.view,
      });
      setPaneSelectedKeys(pane, new Set());
      return;
    }
    if (isPreviewable(file)) {
      setPreviewFile(file);
      return;
    }
    startFileDownload(file);
  };

  const copyLinksForFiles = async (files: FileEntry[]) => {
    if (files.length === 0) return;
    try {
      await copyText(files.map(absoluteFileDownloadUrl).join("\n"));
      toast.success(
        t(files.length === 1 ? "manager.linksCopiedOne" : "manager.linksCopiedMany", {
          count: files.length,
        }),
      );
    } catch (error) {
      toast.error(t("manager.linksCopyFailed"), { description: userMessage(error) });
    }
  };

  const copyDownloadLinks = async (pane: PaneId) => copyLinksForFiles(paneSelectedFiles(pane));

  const downloadEntries = (entries: FileEntry[]) => {
    if (entries.length === 0) return;
    if (entries.length === 1 && entries[0].kind === "file") {
      startFileDownload(entries[0]);
      return;
    }
    const archiveName = entries.length === 1 ? entries[0].name : "teldrive-files";
    void downloadEntriesAsZip(entries, archiveName);
  };

  const moveItemsToFolder = async (ids: string[], targetFolder: FileEntry, pane: PaneId) => {
    const filteredIds = ids.filter((id) => id !== targetFolder.id);
    if (filteredIds.length === 0) return;
    const allFiles = paneFiles(pane);
    const items = filteredIds
      .map((id) => allFiles.find((item) => item.id === id))
      .filter((item): item is FileEntry => Boolean(item));
    if (items.length === 0) return;
    try {
      setActionError(undefined);
      if (items.length === 1) {
        await fileActions.move(items[0], targetFolder.id);
      } else {
        await fileActions.bulkMove(filteredIds, targetFolder.id);
      }
      setPaneSelectedKeys(pane, new Set());
      toast(
        items.length === 1
          ? `Moved "${items[0].name}" to "${targetFolder.name}"`
          : `Moved ${items.length} items to "${targetFolder.name}"`,
      );
    } catch (err) {
      toast.error(userMessage(err));
    }
  };

  const renderToolbar = (pane: PaneId) => {
    if (searchMode)
      return (
        <SearchControls
          search={searchMode.criteria}
          onChange={searchMode.onChange}
          isOpen={filtersOpen}
          onOpenChange={setFiltersOpen}
          status={
            activeSearch && !missingFolder && !invalidDates
              ? primaryFileQuery.isFetching
                ? t("search.updating")
                : t("search.loaded", { count: primaryFiles.length })
              : undefined
          }
        />
      );
    if (search.recent) return undefined;
    const location = paneLocation(pane);
    const uploadFilesTriggerRef =
      pane === "secondary" ? secondaryUploadFilesTriggerRef : primaryUploadFilesTriggerRef;
    const uploadFolderTriggerRef =
      pane === "secondary" ? secondaryUploadFolderTriggerRef : primaryUploadFolderTriggerRef;
    return (
      <>
        <div className={location.view === "list" ? "sm:hidden" : undefined}>
          <FileSortControls sorting={sorting} onChange={changeSorting} />
        </div>
        {pane === "primary" && !search.split ? (
          <Button
            isIconOnly
            size="sm"
            variant="secondary"
            className="hidden sm:inline-flex"
            aria-label={t("manager.openSplit")}
            onPress={openSplitView}
          >
            <SplitIcon className="size-4" />
          </Button>
        ) : pane === "secondary" && search.split ? (
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("manager.closeSplit")}
            onPress={closeSplitView}
          >
            <SplitIcon className="size-4" />
          </Button>
        ) : null}

        <span className="hidden" aria-hidden="true">
          <FileTrigger
            allowsMultiple
            onSelect={(list) => {
              if (list?.length) enqueue(Array.from(list), location.parentId, location.path);
            }}
          >
            <Button ref={uploadFilesTriggerRef}>{t("files.chooseUpload")}</Button>
          </FileTrigger>
          <FileTrigger
            acceptDirectory
            allowsMultiple
            onSelect={(list) => {
              if (list?.length) enqueue(Array.from(list), location.parentId, location.path);
            }}
          >
            <Button ref={uploadFolderTriggerRef}>{t("files.chooseFolder")}</Button>
          </FileTrigger>
        </span>
      </>
    );
  };

  const renderSelectionOverlay = (pane: PaneId) => {
    const selectedFiles = paneSelectedFiles(pane);
    const clipboardTargetPane =
      search.split && clipboardSourcePane
        ? clipboardSourcePane === "primary"
          ? "secondary"
          : "primary"
        : "primary";
    const showClipboard =
      !searchMode &&
      !search.recent &&
      hasClipboard &&
      (!search.split || pane === clipboardTargetPane);
    const canPasteHere =
      showClipboard &&
      !(clipboardMode === "cut" && clipboardSourceParentId === paneLocation(pane).parentId);
    if (showClipboard) {
      return (
        <div className="flex w-full">
          <div className="flex min-h-10 w-full min-w-0 flex-wrap items-center gap-1 rounded-full bg-[#edf2fa] px-2 py-1 dark:bg-[#282a2c] [&>button]:shrink-0">
            <span className="shrink-0 px-2 text-sm font-medium text-foreground">
              {t(clipboardMode === "cut" ? "manager.clipCut" : "manager.clipCopied", {
                count: clipboardItems.length,
              })}
            </span>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t(
                clipboardItems.length === 1 ? "manager.pasteOne" : "manager.pasteMany",
                {
                  count: clipboardItems.length,
                },
              )}
              isDisabled={fileActions.pending || !canPasteHere}
              onPress={() => void pasteClipboard(pane)}
            >
              <PasteIcon className="size-4" />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={t(clipboardMode === "cut" ? "manager.cancelCut" : "manager.clearCopied")}
              onPress={clearClipboard}
            >
              <CloseIcon className="size-4" />
            </Button>
          </div>
        </div>
      );
    }
    if (selectedFiles.length === 0) return undefined;
    return (
      <FileSelectionToolbar
        selectedFiles={selectedFiles}
        pending={pending}
        onCut={
          searchMode || search.bookmarked || search.recent
            ? undefined
            : () => stageClipboard("cut", pane)
        }
        onCopy={() => stageClipboard("copy", pane)}
        onBookmark={() => void toggleBookmarks(pane)}
        bookmarked={search.bookmarked}
        onRename={() => {
          const file = selectedFiles[0];
          setActivePane(pane);
          setRenameFile(file);
          setRenameName(file.name);
          setActionError(undefined);
        }}
        onShare={() => {
          setActivePane(pane);
          setShareFile(selectedFiles[0]);
        }}
        onVersions={() => {
          setActivePane(pane);
          setVersionsFile(selectedFiles[0]);
        }}
        onDownload={() => downloadEntries(selectedFiles)}
        onCopyDownloadLinks={() => void copyDownloadLinks(pane)}
        onMove={() => {
          setActivePane(pane);
          setActionError(undefined);
          setDestination({ mode: "move", files: [...selectedFiles], pane });
        }}
        onTrash={() => void trashSelected(pane)}
        onClear={() => setPaneSelectedKeys(pane, new Set())}
        onSelectAll={() =>
          setPaneSelectedKeys(pane, new Set(paneFiles(pane).map((file) => file.id)))
        }
      />
    );
  };

  const renderDriveFilterChips = () => (
    <div className="flex items-center gap-2">
      <Dropdown>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 rounded-lg border border-[#747775]/45 bg-transparent px-3 text-xs font-medium text-[#444746] hover:bg-[#f0f4f9] dark:border-[#8e918f]/45 dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
        >
          <span>{t("search.type")}</span>
          <ChevronDownIcon className="size-3.5 opacity-80" />
        </Button>
        <Dropdown.Popover placement="bottom start" className="min-w-44 rounded-xl p-1">
          <Dropdown.Menu
            aria-label={t("search.type")}
            onAction={(key) => {
              if (key === "all") {
                onLocationChange({
                  ...search,
                  path: "/",
                  parentId: undefined,
                  query: "",
                  recent: undefined,
                  bookmarked: undefined,
                });
              } else if (key === "folder") {
                void navigateTo({ to: "/search", search: { kind: "folder" } });
              } else if (key === "document") {
                void navigateTo({ to: "/search", search: { category: ["document"] } });
              } else if (key === "media") {
                void navigateTo({ to: "/search", search: { category: ["image", "video"] } });
              } else if (key === "audio") {
                void navigateTo({ to: "/search", search: { category: ["audio"] } });
              } else if (key === "archive") {
                void navigateTo({ to: "/search", search: { category: ["archive"] } });
              }
            }}
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
      <Dropdown>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 rounded-lg border border-[#747775]/45 bg-transparent px-3 text-xs font-medium text-[#444746] hover:bg-[#f0f4f9] dark:border-[#8e918f]/45 dark:text-[#c4c7c5] dark:hover:bg-[#282a2c]"
        >
          <span>{t("manager.sortModified")}</span>
          <ChevronDownIcon className="size-3.5 opacity-80" />
        </Button>
        <Dropdown.Popover placement="bottom start" className="min-w-44 rounded-xl p-1">
          <Dropdown.Menu
            aria-label={t("manager.sortModified")}
            onAction={(key) => {
              const nowMs = Date.now();
              const days = key === "today" ? 1 : key === "week" ? 7 : 30;
              const updatedAfter = new Date(nowMs - days * 86_400_000).toISOString().slice(0, 10);
              void navigateTo({ to: "/search", search: { updatedAfter } });
            }}
          >
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
    </div>
  );

  const renderPane = (pane: PaneId) => {
    const location = paneLocation(pane);
    const files = paneFiles(pane);
    const selectedKeys = paneSelectedKeys(pane);
    const fileQuery = pane === "secondary" ? secondaryFileQuery : primaryFileQuery;
    const browser = (
      <FileBrowser
        files={files}
        path={location.path}
        rootLabel={
          searchMode
            ? t("search.results")
            : search.recent
              ? t("title.recent")
              : search.bookmarked
                ? t("title.bookmarks")
                : t("drive.myDrive")
        }
        view={location.view}
        sorting={sorting}
        onSortChange={changeSorting}
        onMoveToFolder={
          !searchMode && !search.recent && !search.bookmarked
            ? (ids, targetFolder) => void moveItemsToFolder(ids, targetFolder, pane)
            : undefined
        }
        onDownloadFiles={(entries) => downloadEntries(entries)}
        flat={!search.split}
        headerFilters={
          !searchMode && !search.recent && !search.bookmarked && pane === "primary"
            ? renderDriveFilterChips()
            : undefined
        }
        loading={fileQuery.isPending && activeSearch && !missingFolder && !invalidDates}
        onNavigatePath={(path) => navigatePane(pane, { path, query: "", view: location.view })}
        onViewChange={(view) => navigatePane(pane, { ...location, view }, true)}
        onOpen={(file) => openFile(file, pane)}
        onBack={searchMode ? undefined : () => window.history.back()}
        selection={{
          selectedKeys,
          onSelectionChange: (selection) => setPaneSelectedKeys(pane, selection),
          onClearSelection: () => setPaneSelectedKeys(pane, new Set()),
        }}
        rowActions={{
          onDownload: (file) => downloadEntries([file]),
          onShare: (file) => {
            setActivePane(pane);
            setShareFile(file);
          },
          onCopyLink: (file) => void copyLinksForFiles([file]),
          onRename: (file) => {
            setActivePane(pane);
            setRenameFile(file);
            setRenameName(file.name);
            setActionError(undefined);
          },
          onBookmark: (file) => void bookmarkIds([file.id], pane),
          onMove: (file) => {
            setActivePane(pane);
            setActionError(undefined);
            setDestination({ mode: "move", files: [file], pane });
          },
          onCopy: (file) => {
            setActivePane(pane);
            setActionError(undefined);
            setDestination({ mode: "copy", files: [file], pane });
          },
          onVersions: (file) => {
            setActivePane(pane);
            setVersionsFile(file);
          },
          onTrash: (file) => void trashFiles([file.id], pane),
          isBookmarked: Boolean(search.bookmarked),
        }}
        selectionDisabled={fileQuery.isPlaceholderData || pending}
        hasNextPage={
          fileQuery.hasNextPage && !fileQuery.isPlaceholderData && !fileQuery.isFetchNextPageError
        }
        isLoadingMore={fileQuery.isFetchingNextPage}
        onLoadMore={() => {
          if (fileQuery.hasNextPage && !fileQuery.isFetching && !fileQuery.isPlaceholderData)
            void fileQuery.fetchNextPage();
        }}
        toolbar={renderToolbar(pane)}
        compactToolbar={Boolean(searchMode)}
        selectionOverlay={!fileQuery.isPlaceholderData ? renderSelectionOverlay(pane) : undefined}
        emptyAreaActions={
          !searchMode && !search.recent && !search.bookmarked
            ? {
                onNewFolder: () => {
                  setActivePane(pane);
                  setFolderDialogOpen(true);
                },
                onUploadFiles: () => {
                  setActivePane(pane);
                  (pane === "secondary"
                    ? secondaryUploadFilesTriggerRef
                    : primaryUploadFilesTriggerRef
                  ).current?.click();
                },
                onUploadFolder: () => {
                  setActivePane(pane);
                  (pane === "secondary"
                    ? secondaryUploadFolderTriggerRef
                    : primaryUploadFolderTriggerRef
                  ).current?.click();
                },
                onBackgroundUpload: canLocalImport
                  ? () => {
                      setActivePane(pane);
                      setBackgroundUploadOpen(true);
                    }
                  : undefined,
              }
            : undefined
        }
        emptyContent={
          searchMode && (missingFolder || invalidDates || !activeSearch) ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <p className="text-lg font-semibold">
                {missingFolder
                  ? t("search.chooseRecursive")
                  : invalidDates
                    ? t("search.checkRange")
                    : t("search.findAnything")}
              </p>
              <p className="mt-2 text-sm text-muted">
                {missingFolder
                  ? t("search.noFolderSaved")
                  : invalidDates
                    ? t("search.dateError")
                    : t("search.searchHint")}
              </p>
              {(missingFolder || invalidDates) && (
                <Button variant="secondary" className="mt-3" onPress={() => setFiltersOpen(true)}>
                  {missingFolder ? t("search.chooseFolderBtn") : t("search.editFilters")}
                </Button>
              )}
            </div>
          ) : undefined
        }
        dimmedIds={cutIds}
        hideFolderControls={Boolean(searchMode || search.recent)}
        showLocations={Boolean(searchMode || search.bookmarked || search.recent)}
        emptyTitle={
          searchMode
            ? t("search.noMatch")
            : search.recent
              ? t("manager.noRecent")
              : search.bookmarked
                ? t("manager.noBookmarks")
                : undefined
        }
        emptyHint={
          searchMode
            ? t("search.noMatchHint")
            : search.recent
              ? t("manager.recentHint")
              : search.bookmarked
                ? t("manager.bookmarksHint")
                : undefined
        }
        onOpenContainingFolder={
          searchMode || search.bookmarked || search.recent
            ? (file) => {
                void navigateTo({
                  to: "/files",
                  search: {
                    path: file.parentPath ?? "/",
                    parentId: file.parentId,
                    query: "",
                    view: location.view,
                    bookmarked: undefined,
                  },
                });
              }
            : undefined
        }
      />
    );
    if (searchMode)
      return (
        <div data-testid={`file-pane-${pane}`} className="flex min-h-0 min-w-0 flex-1">
          {browser}
        </div>
      );
    return (
      <div data-testid={`file-pane-${pane}`} className="flex min-h-0 min-w-0 flex-1 rounded-xl">
        <DropZone
          data-testid={pane === "primary" ? "file-drop-zone" : "file-drop-zone-secondary"}
          aria-label={t("manager.dropInto", { path: location.path })}
          getDropOperation={(types) =>
            types.has("application/x-teldrive-move") ? "cancel" : "copy"
          }
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden outline-none"
          onDrop={async (event) => {
            const dropped = await Promise.all(
              event.items.filter((item) => item.kind === "file").map((item) => item.getFile()),
            );
            if (dropped.length) enqueue(dropped, location.parentId, location.path);
          }}
        >
          {({ isDropTarget }) => (
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-x-hidden">
              {isDropTarget ? (
                <div className="shrink-0 rounded-xl border-2 border-dashed border-accent bg-accent/10 px-4 py-4 text-center text-sm font-medium text-accent sm:px-6 sm:py-6">
                  {t("manager.dropHere", { path: location.path })}
                </div>
              ) : null}
              {browser}
            </div>
          )}
        </DropZone>
      </div>
    );
  };

  return (
    <Page className="min-h-0 flex-1 gap-0 overflow-x-hidden">
      <PageContent className="flex min-h-0 flex-1 overflow-x-hidden">
        <div {...keyboardProps} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
          {searchMode && primaryFileQuery.isError && (
            <div role="alert" className="mb-3 rounded-xl border border-danger/30 p-4 text-sm">
              <p className="font-medium">
                {primaryFileQuery.isFetchNextPageError
                  ? t("search.moreFailed")
                  : t("search.failed")}
              </p>
              <p className="mt-1 text-muted">{userMessage(primaryFileQuery.error)}</p>
              <Button
                size="sm"
                variant="secondary"
                className="mt-2"
                isDisabled={primaryFileQuery.isFetching}
                onPress={() =>
                  void (primaryFileQuery.isFetchNextPageError
                    ? primaryFileQuery.fetchNextPage()
                    : primaryFileQuery.refetch())
                }
              >
                {t("picker.retry")}
              </Button>
            </div>
          )}
          <div
            className={
              search.split
                ? "grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2"
                : "flex min-h-0 min-w-0 flex-1"
            }
          >
            {renderPane("primary")}
            {search.split ? renderPane("secondary") : null}
          </div>
        </div>
      </PageContent>

      <AppDialog
        open={folderDialogOpen}
        onOpenChange={setFolderDialogOpen}
        title={t("files.createFolder")}
        description={t("manager.createIn", { path: activeLocation.path })}
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setFolderDialogOpen(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button
              variant="primary"
              isDisabled={!folderName.trim() || fileActions.pending}
              onPress={() => void createFolder()}
            >
              {t("files.createFolder")}
            </Button>
          </>
        }
      >
        <TextField
          autoFocus
          value={folderName}
          onChange={setFolderName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void createFolder();
            } else event.continuePropagation();
          }}
        >
          <Label>{t("files.folderName")}</Label>
          <Input placeholder={t("files.newFolderPlaceholder")} />
        </TextField>
      </AppDialog>

      <BackgroundUploadDialog
        open={backgroundUploadOpen}
        onOpenChange={setBackgroundUploadOpen}
        currentPath={activeLocation.path}
      />

      <FileActionDialogs
        renameFile={renameFile}
        renameName={renameName}
        onRenameNameChange={setRenameName}
        onRenameClose={() => {
          if (!pending) {
            setRenameFile(undefined);
            setActionError(undefined);
          }
        }}
        onRename={() => void renameSelected()}
        pending={pending}
        error={actionError}
        destinationAction={
          destination
            ? {
                mode: destination.mode,
                count: destination.files.length,
                onClose: () => {
                  if (!pending) {
                    setDestination(undefined);
                    setActionError(undefined);
                  }
                },
                onConfirm: (parentId) => void transferSelected(parentId),
              }
            : undefined
        }
        shareFile={shareFile}
        onShareClose={() => setShareFile(undefined)}
        versionsFile={versionsFile}
        onVersionsClose={() => setVersionsFile(undefined)}
        previewFile={previewFile}
        onPreviewClose={() => setPreviewFile(undefined)}
      />

      <AppDialog
        open={pasteConflictPane !== undefined}
        onOpenChange={(open) => {
          if (!open) setPasteConflictPane(undefined);
        }}
        title={t("manager.conflictTitle")}
        description={t("manager.conflictDesc")}
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setPasteConflictPane(undefined)}>
              {t("dialog.cancel")}
            </Button>
            <Button
              variant="secondary"
              isDisabled={fileActions.pending || pasteConflictPane === undefined}
              onPress={() => {
                if (pasteConflictPane) void pasteClipboard(pasteConflictPane, "rename");
              }}
            >
              {t("manager.conflictKeep")}
            </Button>
            <Button
              variant="danger"
              isDisabled={fileActions.pending || pasteConflictPane === undefined}
              onPress={() => {
                if (pasteConflictPane) void pasteClipboard(pasteConflictPane, "replace");
              }}
            >
              {t("manager.conflictReplace")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t("manager.conflictHint")}</p>
      </AppDialog>
    </Page>
  );
}

function selectionIds(selection: Selection, files: FileEntry[]) {
  return selection === "all" ? files.map((file) => file.id) : Array.from(selection, String);
}

function joinPath(parent: string, name: string) {
  return `${parent === "/" ? "" : parent}/${name}`.replace(/\/+/g, "/") || "/";
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      Boolean(target.closest("input, textarea, select, [contenteditable='true']")))
  );
}
