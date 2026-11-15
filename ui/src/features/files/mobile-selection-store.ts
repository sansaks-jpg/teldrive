import { create } from "zustand";

export type MobileSelectionActions = {
  count: number;
  singleKind?: "file" | "folder";
  pending?: boolean;
  bookmarked?: boolean;
  onClear?: () => void;
  onSelectAll?: () => void;
  onCut?: () => void;
  onCopy?: () => void;
  onBookmark?: () => void;
  onRename?: () => void;
  onShare?: () => void;
  onVersions?: () => void;
  onDownload?: () => void;
  onCopyDownloadLinks?: () => void;
  onMove?: () => void;
  onTrash?: () => void;
  onStopSharing?: () => void;
};

type MobileSelectionStoreState = {
  selection?: MobileSelectionActions;
  setSelection: (selection: MobileSelectionActions) => void;
  clearSelection: () => void;
};

export const useMobileSelectionStore = create<MobileSelectionStoreState>((set) => ({
  selection: undefined,
  setSelection: (selection) => set({ selection }),
  clearSelection: () => set({ selection: undefined }),
}));
