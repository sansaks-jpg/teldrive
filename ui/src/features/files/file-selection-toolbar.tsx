import { Button, Tooltip } from "@heroui/react";
import { type ComponentProps, useEffect } from "react";
import { useAppLocale } from "@/lib/locale";
import DownloadIcon from "~icons/gravity-ui/arrow-down-to-line";
import BookmarkIcon from "~icons/gravity-ui/bookmark";
import ClockIcon from "~icons/gravity-ui/clock";
import CopyIcon from "~icons/gravity-ui/copy";
import CopyLinkIcon from "~icons/gravity-ui/copy-arrow-right";
import MoveIcon from "~icons/gravity-ui/folder-arrow-right";
import LinkIcon from "~icons/gravity-ui/link";
import PencilIcon from "~icons/gravity-ui/pencil";
import CutIcon from "~icons/gravity-ui/scissors";
import TrashIcon from "~icons/gravity-ui/trash-bin";
import CloseIcon from "~icons/gravity-ui/xmark";
import type { FileEntry } from "../../api/types";
import { useMobileSelectionStore } from "./mobile-selection-store";

export function SelectionActionButton(
  props: ComponentProps<typeof Button> & { "aria-label": string },
) {
  return (
    <Tooltip delay={300}>
      <Button {...props} />
      <Tooltip.Content placement="bottom">{props["aria-label"]}</Tooltip.Content>
    </Tooltip>
  );
}

export function FileSelectionToolbar({
  selectedFiles,
  pending,
  onCut,
  onCopy,
  onBookmark,
  bookmarked = false,
  onRename,
  onShare,
  onVersions,
  onDownload,
  onCopyDownloadLinks,
  onMove,
  onTrash,
  onClear,
  onSelectAll,
}: {
  selectedFiles: FileEntry[];
  pending: boolean;
  onCut?: () => void;
  onCopy?: () => void;
  onBookmark?: () => void;
  bookmarked?: boolean;
  onRename?: () => void;
  onShare?: () => void;
  onVersions?: () => void;
  onDownload?: () => void;
  onCopyDownloadLinks?: () => void;
  onMove?: () => void;
  onTrash?: () => void;
  onClear?: () => void;
  onSelectAll?: () => void;
}) {
  const { t } = useAppLocale();
  const setMobileSelection = useMobileSelectionStore((state) => state.setSelection);
  const clearMobileSelection = useMobileSelectionStore((state) => state.clearSelection);
  const selectedCount = selectedFiles.length;
  const singleSelectedFile = selectedCount === 1 ? selectedFiles[0] : undefined;
  const selectedOnlyFiles = selectedFiles.every((file) => file.kind === "file");

  useEffect(() => {
    if (selectedCount === 0) {
      clearMobileSelection();
      return;
    }
    setMobileSelection({
      count: selectedCount,
      singleKind: singleSelectedFile?.kind,
      pending,
      bookmarked,
      onClear,
      onSelectAll,
      onCut,
      onCopy,
      onBookmark,
      onRename: singleSelectedFile ? onRename : undefined,
      onShare: singleSelectedFile ? onShare : undefined,
      onVersions: singleSelectedFile?.kind === "file" ? onVersions : undefined,
      onDownload: singleSelectedFile?.kind === "file" ? onDownload : undefined,
      onCopyDownloadLinks: selectedOnlyFiles ? onCopyDownloadLinks : undefined,
      onMove,
      onTrash,
    });
    return () => clearMobileSelection();
  }, [
    selectedCount,
    singleSelectedFile,
    selectedOnlyFiles,
    pending,
    bookmarked,
    onClear,
    onSelectAll,
    onCut,
    onCopy,
    onBookmark,
    onRename,
    onShare,
    onVersions,
    onDownload,
    onCopyDownloadLinks,
    onMove,
    onTrash,
    setMobileSelection,
    clearMobileSelection,
  ]);

  if (selectedCount === 0) return null;

  return (
    <div className="hidden w-full sm:flex">
      <fieldset
        aria-label={t("selection.actions")}
        className="flex h-8 w-full min-w-0 items-center gap-1 rounded-full bg-[#edf2fa] px-1.5 dark:bg-[#282a2c] [&>button]:shrink-0"
      >
        {onClear ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            className="size-8 rounded-full"
            aria-label={t("selection.clear")}
            isDisabled={pending}
            onPress={onClear}
          >
            <CloseIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        <span className="shrink-0 px-2 text-sm font-medium text-foreground">
          {t("selection.count", { count: selectedCount })}
        </span>
        <span className="mx-1 h-4 w-px shrink-0 bg-border/80" aria-hidden="true" />
        {onCut ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("selection.cut")}
            isDisabled={pending}
            onPress={onCut}
          >
            <CutIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {onCopy ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("selection.copy")}
            isDisabled={pending}
            onPress={onCopy}
          >
            <CopyIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {onBookmark ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={bookmarked ? t("selection.bookmarkRemove") : t("selection.bookmarkAdd")}
            isDisabled={pending}
            onPress={onBookmark}
          >
            <BookmarkIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {singleSelectedFile && onRename ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("selection.rename")}
            isDisabled={pending}
            onPress={onRename}
          >
            <PencilIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {singleSelectedFile && onShare ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("selection.share")}
            isDisabled={pending}
            onPress={onShare}
          >
            <LinkIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {singleSelectedFile?.kind === "file" && onVersions ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("versions.action")}
            isDisabled={pending}
            onPress={onVersions}
          >
            <ClockIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {selectedCount > 0 && onDownload ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("selection.download")}
            isDisabled={pending}
            onPress={onDownload}
          >
            <DownloadIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {selectedOnlyFiles && onCopyDownloadLinks ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={
              selectedCount === 1 ? t("selection.copyLinkOne") : t("selection.copyLinkMany")
            }
            onPress={onCopyDownloadLinks}
            isDisabled={pending}
          >
            <CopyLinkIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {onMove ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label={t("selection.move")}
            isDisabled={pending}
            onPress={onMove}
          >
            <MoveIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
        {onTrash ? (
          <SelectionActionButton
            isIconOnly
            size="sm"
            variant="danger"
            aria-label={t("selection.trash")}
            isDisabled={pending}
            onPress={onTrash}
          >
            <TrashIcon className="size-4" />
          </SelectionActionButton>
        ) : null}
      </fieldset>
    </div>
  );
}
