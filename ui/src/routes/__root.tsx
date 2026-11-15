import {
  RouterProvider as AriaRouterProvider,
  Avatar,
  Button,
  Chip,
  cn,
  Dropdown,
  Input,
  Kbd,
  Label,
  Separator,
} from "@heroui/react";
import { buttonVariants } from "@heroui/styles";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { type Ref, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  dispatchWorkspaceAction,
  GoogleDocsBrandIcon,
  GoogleDriveBrandIcon,
  GoogleOneBrandIcon,
  GooglePhotosBrandIcon,
  getWorkspaceApp,
  WaffleGridIcon,
  type WorkspaceAction,
  type WorkspaceAppId,
} from "@/components/google-workspace";
import { clearDocumentCache } from "@/features/files/document-cache";
import { useMobileSelectionStore } from "@/features/files/mobile-selection-store";
import { useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { useTheme } from "@/lib/theme";
import DownloadIcon from "~icons/gravity-ui/arrow-down-to-line";
import LogoutIcon from "~icons/gravity-ui/arrow-right-from-square";
import UploadIcon from "~icons/gravity-ui/arrow-up-from-line";
import MenuIcon from "~icons/gravity-ui/bars";
import BookmarkIcon from "~icons/gravity-ui/bookmark";
import ChevronLeftIcon from "~icons/gravity-ui/chevron-left";
import ChevronRightIcon from "~icons/gravity-ui/chevron-right";
import ClockIcon from "~icons/gravity-ui/clock";
import CopyIcon from "~icons/gravity-ui/copy";
import CopyLinkIcon from "~icons/gravity-ui/copy-arrow-right";
import StorageIcon from "~icons/gravity-ui/database";
import MoreIcon from "~icons/gravity-ui/ellipsis-vertical";
import FileIcon from "~icons/gravity-ui/file";
import FolderIcon from "~icons/gravity-ui/folder";
import MoveIcon from "~icons/gravity-ui/folder-arrow-right";
import FolderFillIcon from "~icons/gravity-ui/folder-fill";
import FolderPlusIcon from "~icons/gravity-ui/folder-plus";
import SettingsIcon from "~icons/gravity-ui/gear";
import HeartIcon from "~icons/gravity-ui/heart";
import HouseIcon from "~icons/gravity-ui/house";
import HouseFillIcon from "~icons/gravity-ui/house-fill";
import LinkIcon from "~icons/gravity-ui/link";
import UnshareIcon from "~icons/gravity-ui/link-slash";
import TasksIcon from "~icons/gravity-ui/list-ul";
import SearchIcon from "~icons/gravity-ui/magnifier";
import MoonIcon from "~icons/gravity-ui/moon";
import PencilIcon from "~icons/gravity-ui/pencil";
import PersonsIcon from "~icons/gravity-ui/persons";
import PlusIcon from "~icons/gravity-ui/plus";
import CutIcon from "~icons/gravity-ui/scissors";
import ShieldIcon from "~icons/gravity-ui/shield-check";
import SelectAllIcon from "~icons/gravity-ui/square-check";
import StarIcon from "~icons/gravity-ui/star";
import StarFillIcon from "~icons/gravity-ui/star-fill";
import SunIcon from "~icons/gravity-ui/sun";
import TrashIcon from "~icons/gravity-ui/trash-bin";
import CloseIcon from "~icons/gravity-ui/xmark";
import FileTextIcon from "~icons/icon-park-outline/file-text";
import PictureIcon from "~icons/icon-park-outline/picture-one";
import VideoFileIcon from "~icons/icon-park-outline/video-file";
import { $api } from "../api/client";
import { isUnauthorized, userMessage } from "../api/errors";
import { currentUserQueryOptions } from "../auth/queries";
import { UploadShelf } from "../components/upload-shelf";
import { preferencesQueryOptions } from "../lib/preferences";
import { getQueryClient } from "../lib/queryClient";

const DESKTOP_BREAKPOINT = 1024;

type AppRoutePath =
  | "/files"
  | "/shared"
  | "/shared-with-me"
  | "/trash"
  | "/photos"
  | "/storage"
  | "/admin"
  | "/tasks"
  | "/settings"
  | "/docs";

type AppNavItem = {
  key: string;
  labelKey: string;
  icon: typeof FolderIcon;
  activeIcon?: typeof FolderIcon;
  to: AppRoutePath;
  search?: Record<string, unknown>;
  capability?: string;
  isActive: (pathname: string, search: Record<string, unknown>) => boolean;
};

const MOBILE_DRIVE_NAV: AppNavItem[] = [
  {
    key: "mobile-home",
    labelKey: "drive.home",
    icon: HouseIcon,
    activeIcon: HouseFillIcon,
    to: "/files",
    search: { recent: true },
    isActive: (pathname, search) => pathname.startsWith("/files") && search.recent === true,
  },
  {
    key: "mobile-bookmarks",
    labelKey: "nav.bookmarks",
    icon: StarIcon,
    activeIcon: StarFillIcon,
    to: "/files",
    search: { bookmarked: true },
    isActive: (pathname, search) =>
      pathname.startsWith("/files") && search.bookmarked === true && search.recent !== true,
  },
  {
    key: "mobile-shared",
    labelKey: "nav.shared",
    icon: PersonsIcon,
    activeIcon: PersonsIcon,
    to: "/shared-with-me",
    isActive: (pathname) =>
      pathname.startsWith("/shared-with-me") ||
      pathname === "/shared" ||
      pathname.startsWith("/shared/"),
  },
  {
    key: "mobile-files",
    labelKey: "nav.files",
    icon: FolderIcon,
    activeIcon: FolderFillIcon,
    to: "/files",
    search: {},
    isActive: (pathname, search) =>
      pathname.startsWith("/files") && search.recent !== true && search.bookmarked !== true,
  },
];

const DRIVE_NAV: AppNavItem[] = [
  {
    key: "files",
    labelKey: "nav.files",
    icon: FolderIcon,
    to: "/files",
    search: {},
    isActive: (pathname, search) =>
      pathname.startsWith("/files") && search.recent !== true && search.bookmarked !== true,
  },
  {
    key: "recent",
    labelKey: "nav.recent",
    icon: TasksIcon,
    to: "/files",
    search: { recent: true },
    isActive: (pathname, search) => pathname.startsWith("/files") && search.recent === true,
  },
  {
    key: "bookmarks",
    labelKey: "nav.bookmarks",
    icon: BookmarkIcon,
    to: "/files",
    search: { bookmarked: true },
    isActive: (pathname, search) =>
      pathname.startsWith("/files") && search.bookmarked === true && search.recent !== true,
  },
  {
    key: "sharedWithMe",
    labelKey: "nav.sharedWithMe",
    icon: FolderPlusIcon,
    to: "/shared-with-me",
    isActive: (pathname) => pathname.startsWith("/shared-with-me"),
  },
  {
    key: "shared",
    labelKey: "nav.shared",
    icon: ShieldIcon,
    to: "/shared",
    isActive: (pathname) => pathname === "/shared" || pathname.startsWith("/shared/"),
  },
  {
    key: "trash",
    labelKey: "nav.trash",
    icon: TrashIcon,
    to: "/trash",
    isActive: (pathname) => pathname.startsWith("/trash"),
  },
];

const PHOTOS_NAV: AppNavItem[] = [
  {
    key: "photos-timeline",
    labelKey: "photos.tabTimeline",
    icon: PictureIcon,
    to: "/photos",
    search: { mode: "timeline" },
    isActive: (pathname, search) =>
      pathname.startsWith("/photos") && (!search.mode || search.mode === "timeline"),
  },
  {
    key: "photos-favorites",
    labelKey: "photos.tabFavorites",
    icon: HeartIcon,
    to: "/photos",
    search: { mode: "favorites" },
    isActive: (pathname, search) => pathname.startsWith("/photos") && search.mode === "favorites",
  },
  {
    key: "photos-albums",
    labelKey: "photos.tabAlbums",
    icon: FolderPlusIcon,
    to: "/photos",
    search: { mode: "albums" },
    isActive: (pathname, search) => pathname.startsWith("/photos") && search.mode === "albums",
  },
  {
    key: "photos-videos",
    labelKey: "photos.tabVideos",
    icon: VideoFileIcon,
    to: "/photos",
    search: { mode: "videos" },
    isActive: (pathname, search) => pathname.startsWith("/photos") && search.mode === "videos",
  },
  {
    key: "photos-screenshots",
    labelKey: "photos.modeScreenshots",
    icon: PictureIcon,
    to: "/photos",
    search: { mode: "screenshots" },
    isActive: (pathname, search) => pathname.startsWith("/photos") && search.mode === "screenshots",
  },
  {
    key: "photos-recent",
    labelKey: "photos.modeRecent",
    icon: TasksIcon,
    to: "/photos",
    search: { mode: "recent" },
    isActive: (pathname, search) => pathname.startsWith("/photos") && search.mode === "recent",
  },
];

const ONE_NAV: AppNavItem[] = [
  {
    key: "storage",
    labelKey: "nav.storage",
    icon: StorageIcon,
    to: "/storage",
    isActive: (pathname) => pathname.startsWith("/storage"),
  },
  {
    key: "admin",
    labelKey: "admin.title",
    icon: ShieldIcon,
    to: "/admin",
    capability: "system.manageUsers",
    isActive: (pathname) => pathname.startsWith("/admin"),
  },
  {
    key: "tasks",
    labelKey: "nav.tasks",
    icon: TasksIcon,
    to: "/tasks",
    search: { status: "running", query: "" },
    capability: "system.manageJobs",
    isActive: (pathname) => pathname.startsWith("/tasks"),
  },
  {
    key: "settings",
    labelKey: "title.settings",
    icon: SettingsIcon,
    to: "/settings",
    isActive: (pathname) => pathname.startsWith("/settings"),
  },
];

const DOCS_NAV: AppNavItem[] = [
  {
    key: "docs",
    labelKey: "nav.docs",
    icon: FileTextIcon,
    to: "/docs",
    isActive: (pathname) => pathname.startsWith("/docs"),
  },
  {
    key: "back-drive",
    labelKey: "apps.openDrive",
    icon: FolderIcon,
    to: "/files",
    search: { path: "/", query: "", view: "list" },
    isActive: () => false,
  },
];

function getAppMeta(app: WorkspaceAppId, t: (key: string) => string) {
  switch (app) {
    case "photos":
      return {
        label: t("apps.photos"),
        brand: GooglePhotosBrandIcon,
        searchPlaceholder: t("photos.searchPlaceholder"),
      };
    case "one":
      return {
        label: t("apps.one"),
        brand: GoogleOneBrandIcon,
        searchPlaceholder: t("search.placeholder"),
      };
    case "docs":
      return {
        label: t("apps.docs"),
        brand: GoogleDocsBrandIcon,
        searchPlaceholder: t("docs.searchPh"),
      };
    default:
      return {
        label: t("apps.drive"),
        brand: GoogleDriveBrandIcon,
        searchPlaceholder: t("search.placeholder"),
      };
  }
}

function getNavForApp(app: WorkspaceAppId, capabilities: string[]): AppNavItem[] {
  const source =
    app === "photos" ? PHOTOS_NAV : app === "one" ? ONE_NAV : app === "docs" ? DOCS_NAV : DRIVE_NAV;
  return source.filter((item) => !item.capability || capabilities.includes(item.capability));
}

function Sidebar({
  collapsed,
  mobile,
  onNavigate,
}: {
  collapsed: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const { t } = useAppLocale();
  const formatBytes = useFormatBytes();
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeSearch = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const activeApp = getWorkspaceApp(pathname);
  const appMeta = getAppMeta(activeApp, t);
  const ActiveBrandIcon = appMeta.brand;
  const { data: user } = useQuery(currentUserQueryOptions());
  const capabilities = user?.capabilities ?? [];
  const canManageJobs = capabilities.includes("system.manageJobs");
  const canLocalImport = capabilities.includes("system.localImport");
  const visibleNav = getNavForApp(activeApp, capabilities).filter((item) => {
    if (!mobile || activeApp !== "drive") return true;
    // Bottom bar handles Home (recent), Bookmarks, Shared, and Files on mobile Drive.
    return item.key === "trash";
  });

  const storageQuery = $api.useQuery(
    "get",
    "/v1/files/statistics/drive",
    {},
    { staleTime: 60_000, retry: false },
  );
  const storageStats = storageQuery.data;
  const storageFillPct =
    storageStats && storageStats.totalBytes > 0
      ? Math.min(100, Math.max(8, Math.round((Math.log10(storageStats.totalBytes + 1) / 12) * 100)))
      : 0;
  const versionLabel = import.meta.env.VITE_APP_VERSION;
  const logout = $api.useMutation("post", "/v1/auth/cookie/logout");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const displayName =
    user?.displayName?.trim() ||
    user?.username?.trim() ||
    (user ? t("account.userFallback", { id: user.userId }) : t("account.title"));
  const secondaryLabel = user?.username
    ? `@${user.username}`
    : user?.premium
      ? "Telegram Premium"
      : "Telegram";
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const signOut = async () => {
    try {
      await logout.mutateAsync({});
      await clearDocumentCache().catch(() => {});
      getQueryClient().clear();
      onNavigate?.();
      await navigate({ to: "/login", search: { redirect: "/files" }, replace: true });
    } catch (error) {
      toast.error(t("account.logoutFailed"), { description: userMessage(error) });
    }
  };

  const triggerDriveAction = async (action: WorkspaceAction) => {
    onNavigate?.();
    if (!pathname.startsWith("/files")) {
      await navigate({ to: "/files", search: { path: "/", query: "", view: "list" } });
      window.setTimeout(() => dispatchWorkspaceAction(action), 80);
      return;
    }
    dispatchWorkspaceAction(action);
  };

  const triggerPhotosAction = async (action: WorkspaceAction) => {
    onNavigate?.();
    if (!pathname.startsWith("/photos")) {
      await navigate({ to: "/photos" });
      window.setTimeout(() => dispatchWorkspaceAction(action), 80);
      return;
    }
    dispatchWorkspaceAction(action);
  };

  const renderItem = (item: AppNavItem) => {
    const active = item.isActive(pathname, routeSearch);
    const Icon = item.icon;
    return (
      <Link
        key={item.key}
        to={item.to}
        search={(item.search ?? {}) as never}
        activeOptions={{ includeSearch: false }}
        preload="intent"
        className={cn(
          buttonVariants({ variant: "ghost" }),
          "h-10 w-full justify-start rounded-full px-3 text-sm font-medium",
          active
            ? "bg-accent/10 bg-[#c2e7ff]! font-semibold text-[#001d35]! dark:bg-[#004a77]! dark:text-[#c2e7ff]!"
            : "text-[#444746] hover:bg-[#e1e5ea]/70 hover:text-foreground dark:text-[#c4c7c5] dark:hover:bg-[#333538]/70",
        )}
        onClick={() => onNavigate?.()}
      >
        <Icon className="size-4 shrink-0" />
        <span
          className={cn(
            "overflow-hidden whitespace-nowrap transition-[width,opacity,margin] duration-200",
            collapsed && !mobile ? "ml-0 max-w-0 opacity-0" : "ml-3 max-w-52 opacity-100",
          )}
        >
          {t(item.labelKey)}
        </span>
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "flex h-full flex-col overflow-hidden bg-sidebar",
        !mobile && "transition-[width] duration-200",
        mobile
          ? "w-[min(19.5rem,86vw)] border-r border-border/50 shadow-2xl"
          : cn(collapsed ? "w-16" : "w-60"),
      )}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 px-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface shadow-xs ring-1 ring-border/40">
          <ActiveBrandIcon className="size-5.5" />
        </div>
        <div
          className={cn(
            "min-w-0 overflow-hidden whitespace-nowrap transition-[width,opacity] duration-200",
            collapsed && !mobile ? "max-w-0 opacity-0" : "max-w-44 opacity-100",
          )}
        >
          <p className="text-[17px] font-semibold tracking-tight text-foreground">
            Teldrive <span className="font-normal text-muted">{appMeta.label}</span>
          </p>
        </div>
      </div>

      {!mobile && activeApp === "drive" && (
        <div className="px-3 pt-1">
          <Dropdown>
            <Button
              variant="secondary"
              aria-label={t("nav.newAction")}
              className={cn(
                "h-13 rounded-2xl border border-border/50 bg-white font-medium text-foreground shadow-sm transition-shadow hover:bg-[#f0f4f9] hover:shadow-md dark:border-transparent dark:bg-[#37393b] dark:hover:bg-[#444746]",
                collapsed ? "w-10 min-w-0 justify-center px-0" : "w-32 justify-start gap-3 px-4",
              )}
            >
              <PlusIcon className="size-5 shrink-0 text-foreground" />
              {!collapsed && <span className="text-sm">{t("nav.newAction")}</span>}
            </Button>
            <Dropdown.Popover placement="bottom start" className="min-w-56 rounded-2xl p-1.5">
              <Dropdown.Menu
                aria-label={t("nav.newAction")}
                onAction={(key) => {
                  if (key === "folder") void triggerDriveAction("drive:new-folder");
                  if (key === "files") void triggerDriveAction("drive:upload-files");
                  if (key === "uploadFolder") void triggerDriveAction("drive:upload-folder");
                  if (key === "background") void triggerDriveAction("drive:background-upload");
                }}
              >
                <Dropdown.Item id="folder" textValue={t("files.newFolder")}>
                  <FolderPlusIcon className="size-4 text-accent" />
                  <Label>{t("files.newFolder")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="files" textValue={t("files.uploadFiles")}>
                  <FileIcon className="size-4 text-muted" />
                  <Label>{t("files.uploadFiles")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="uploadFolder" textValue={t("files.uploadFolder")}>
                  <UploadIcon className="size-4 text-muted" />
                  <Label>{t("files.uploadFolder")}</Label>
                </Dropdown.Item>
                {canLocalImport ? (
                  <Dropdown.Item id="background" textValue={t("uploads.bgTitle")}>
                    <UploadIcon className="size-4 text-muted" />
                    <Label>{t("uploads.bgTitle")}</Label>
                  </Dropdown.Item>
                ) : null}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      )}

      {!mobile && activeApp === "photos" && (
        <div className="px-3 pt-1">
          <Dropdown>
            <Button
              variant="secondary"
              aria-label={t("photos.newAlbum")}
              className={cn(
                "h-13 rounded-2xl border border-border/50 bg-surface font-medium text-foreground shadow-sm transition-shadow hover:bg-surface hover:shadow-md",
                collapsed ? "w-10 min-w-0 justify-center px-0" : "w-44 justify-start gap-3 px-4",
              )}
            >
              <PlusIcon className="size-5 shrink-0 text-accent" />
              {!collapsed && <span className="text-sm">{t("photos.newAlbum")}</span>}
            </Button>
            <Dropdown.Popover placement="bottom start" className="min-w-52 rounded-2xl p-1.5">
              <Dropdown.Menu
                aria-label={t("photos.newAlbum")}
                onAction={(key) => {
                  if (key === "album") void triggerPhotosAction("photos:new-album");
                  if (key === "upload") void triggerPhotosAction("photos:upload");
                }}
              >
                <Dropdown.Item id="album" textValue={t("photos.newAlbum")}>
                  <FolderPlusIcon className="size-4 text-accent" />
                  <Label>{t("photos.newAlbum")}</Label>
                </Dropdown.Item>
                <Dropdown.Item id="upload" textValue={t("photos.uploadPhotos")}>
                  <UploadIcon className="size-4 text-muted" />
                  <Label>{t("photos.uploadPhotos")}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      )}

      <nav aria-label={t("sidebar.nav")} className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
        {visibleNav.map(renderItem)}
        {mobile && activeApp === "drive" && canManageJobs ? (
          <Link
            to="/tasks"
            search={{ status: "running", query: "" }}
            activeOptions={{ includeSearch: false }}
            preload="intent"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-10 w-full justify-start rounded-full px-3 text-sm font-medium",
              pathname.startsWith("/tasks")
                ? "bg-accent/10 bg-[#c2e7ff]! font-semibold text-[#001d35]! dark:bg-[#004a77]! dark:text-[#c2e7ff]!"
                : "text-[#444746] hover:bg-[#e1e5ea]/70 hover:text-foreground dark:text-[#c4c7c5] dark:hover:bg-[#333538]/70",
            )}
            onClick={() => onNavigate?.()}
          >
            <TasksIcon className="size-4 shrink-0" />
            <span className="ml-3 truncate">{t("nav.tasks")}</span>
          </Link>
        ) : null}
        {mobile ? (
          <Link
            to="/settings"
            activeOptions={{ includeSearch: false }}
            preload="intent"
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "h-10 w-full justify-start rounded-full px-3 text-sm font-medium",
              pathname.startsWith("/settings")
                ? "bg-accent/10 bg-[#c2e7ff]! font-semibold text-[#001d35]! dark:bg-[#004a77]! dark:text-[#c2e7ff]!"
                : "text-[#444746] hover:bg-[#e1e5ea]/70 hover:text-foreground dark:text-[#c4c7c5] dark:hover:bg-[#333538]/70",
            )}
            onClick={() => onNavigate?.()}
          >
            <SettingsIcon className="size-4 shrink-0" />
            <span className="ml-3 truncate">{t("title.settings")}</span>
          </Link>
        ) : null}
      </nav>

      {(!collapsed || mobile) && storageStats ? (
        <Link
          to="/storage"
          onClick={() => onNavigate?.()}
          className="mx-3 mb-3 block rounded-2xl border border-border/40 bg-surface/80 p-3 transition-colors hover:bg-surface"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium text-foreground">{t("nav.storage")}</span>
            <span className="tabular-nums text-muted">{formatBytes(storageStats.totalBytes)}</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-default/40">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${storageFillPct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            {t("admin.metricFilesCount", { count: storageStats.totalFiles })}
          </p>
        </Link>
      ) : null}

      <div className="border-t border-border/50 px-3 py-3">
        {!mobile && (
          <Dropdown isOpen={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
            {collapsed ? (
              <Dropdown.Trigger className="flex size-10 items-center justify-center rounded-full hover:bg-default/30">
                <Avatar className="size-8 cursor-pointer">
                  <Avatar.Image alt={displayName} src="/api/v1/me/photo" />
                  <Avatar.Fallback>{initials}</Avatar.Fallback>
                </Avatar>
              </Dropdown.Trigger>
            ) : (
              <Button
                variant="ghost"
                aria-label={t("account.menu")}
                className="flex h-14 w-full items-center justify-start gap-3 rounded-xl px-2 text-muted hover:bg-default/30 hover:text-foreground"
              >
                <Avatar className="size-9 shrink-0">
                  <Avatar.Image alt={displayName} src="/api/v1/me/photo" />
                  <Avatar.Fallback>{initials}</Avatar.Fallback>
                </Avatar>
                <div className="min-w-0 overflow-hidden whitespace-nowrap text-left">
                  <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                  <p className="truncate text-xs text-muted">{secondaryLabel}</p>
                </div>
              </Button>
            )}
            <Dropdown.Popover placement="top start" className="min-w-52">
              <Dropdown.Menu
                aria-label={t("account.menu")}
                onAction={(key) => {
                  if (key === "logout") void signOut();
                }}
              >
                <Dropdown.Item
                  id="settings"
                  textValue={t("account.settings")}
                  render={({ ref, ...itemProps }) => {
                    return (
                      // @ts-expect-error HeroUI types render props for a menu item div; this render target is an anchor.
                      <Link
                        {...itemProps}
                        ref={ref as Ref<HTMLAnchorElement>}
                        to="/settings"
                        preload="intent"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          onNavigate?.();
                        }}
                      />
                    );
                  }}
                >
                  <SettingsIcon className="size-4" />
                  <Label>{t("account.settings")}</Label>
                </Dropdown.Item>
                <Dropdown.Item
                  id="logout"
                  textValue={t("account.logout")}
                  isDisabled={logout.isPending}
                >
                  <LogoutIcon className="size-4" />
                  <Label>{logout.isPending ? t("account.loggingOut") : t("account.logout")}</Label>
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        )}
        {(!collapsed || mobile) && (
          <p
            className={cn("truncate px-2 text-xs text-muted", !mobile && "mt-2")}
            title={versionLabel}
          >
            {versionLabel}
          </p>
        )}
      </div>
    </aside>
  );
}

function TopBar({
  collapsed,
  desktop,
  onToggleSidebar,
  onOpenMobile,
}: {
  collapsed: boolean;
  desktop: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useAppLocale();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<number | undefined>(undefined);
  const composingSearch = useRef(false);
  const [searchText, setSearchText] = useState("");
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeSearch = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const locationKey = useLocation({ select: (location) => location.href });
  const activeApp = getWorkspaceApp(pathname);
  const appMeta = getAppMeta(activeApp, t);
  const mobileSelection = useMobileSelectionStore((state) => state.selection);

  const scheduleSearch = (value: string) => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = undefined;
    const q = value.trim() || undefined;
    if (activeApp === "photos" && !composingSearch.current) {
      searchTimer.current = window.setTimeout(() => {
        searchTimer.current = undefined;
        void navigate({ to: "/photos", search: { ...routeSearch, q } as never, replace: true });
      }, 220);
      return;
    }
    if (pathname !== "/search" || composingSearch.current || q === routeSearch.q) return;
    searchTimer.current = window.setTimeout(() => {
      searchTimer.current = undefined;
      void navigate({ to: "/search", search: { ...routeSearch, q }, replace: true });
    }, 300);
  };

  useEffect(() => {
    if (pathname === "/search" || pathname.startsWith("/photos")) {
      setSearchText(typeof routeSearch.q === "string" ? routeSearch.q : "");
    } else {
      setSearchText("");
    }
  }, [pathname, routeSearch]);

  useEffect(
    () => () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    },
    [locationKey],
  );

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        (event.target instanceof HTMLElement && event.target.closest('[role="dialog"]'))
      )
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, []);

  const searchForm = (
    <search aria-label={t("search.navLabel")} className="min-w-0 flex-1 md:max-w-2xl">
      <form
        className="w-full"
        onSubmit={(event) => {
          event.preventDefault();
          if (composingSearch.current) return;
          if (searchTimer.current) window.clearTimeout(searchTimer.current);
          searchTimer.current = undefined;
          const q = searchText.trim() || undefined;
          if (activeApp === "photos") {
            void navigate({ to: "/photos", search: { ...routeSearch, q } as never, replace: true });
            return;
          }
          void navigate({
            to: "/search",
            search: {
              ...(pathname === "/search" ? routeSearch : {}),
              ...(pathname === "/files"
                ? {
                    parentId:
                      typeof routeSearch.parentId === "string" ? routeSearch.parentId : undefined,
                    folderPath:
                      typeof routeSearch.path === "string" && routeSearch.path !== "/"
                        ? routeSearch.path
                        : undefined,
                  }
                : {}),
              q,
            },
          });
        }}
      >
        <div
          className={cn(
            "flex w-full items-center gap-2 rounded-full transition-all",
            desktop
              ? "h-11 bg-[#e9eef6] px-4 focus-within:bg-surface focus-within:shadow-md focus-within:ring-1 focus-within:ring-border/40 dark:bg-[#282a2c]"
              : "h-12 bg-[#e9eef6] px-4 focus-within:bg-surface focus-within:ring-1 focus-within:ring-border/40 dark:bg-[#1e2627]",
          )}
        >
          {desktop && (
            <SearchIcon className="size-4.5 shrink-0 text-[#444746] dark:text-[#c4c7c5]" />
          )}
          <Input
            ref={searchRef}
            aria-label={t("search.aria")}
            value={searchText}
            maxLength={512}
            enterKeyHint="search"
            variant="secondary"
            onCompositionStart={() => {
              composingSearch.current = true;
              if (searchTimer.current) window.clearTimeout(searchTimer.current);
            }}
            onCompositionEnd={(event) => {
              composingSearch.current = false;
              setSearchText(event.currentTarget.value);
              scheduleSearch(event.currentTarget.value);
            }}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                (event.nativeEvent.isComposing || composingSearch.current)
              )
                event.preventDefault();
            }}
            onChange={(event) => {
              const value = event.target.value;
              setSearchText(value);
              scheduleSearch(value);
            }}
            placeholder={appMeta.searchPlaceholder}
            className={cn(
              "h-auto! min-h-0! w-0 min-w-0 flex-1 border-0! bg-transparent! px-0! py-0! text-[15px] leading-normal! text-foreground shadow-none! outline-none! ring-0! focus:ring-0! focus-visible:ring-0! sm:text-sm",
              !desktop && !searchText && "text-center! focus:text-left!",
            )}
          />
          {searchText ? (
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              className="size-7 shrink-0 rounded-full text-muted hover:text-foreground"
              aria-label={t("search.clear")}
              onPress={() => {
                setSearchText("");
                if (searchTimer.current) window.clearTimeout(searchTimer.current);
                if (activeApp === "photos") {
                  void navigate({
                    to: "/photos",
                    search: { ...routeSearch, q: undefined } as never,
                    replace: true,
                  });
                } else if (pathname === "/search") {
                  void navigate({
                    to: "/files",
                    search: { path: "/", query: "", view: "list" },
                    replace: true,
                  });
                }
              }}
            >
              <CloseIcon className="size-3.5" />
            </Button>
          ) : (
            desktop && <Kbd className="hidden shrink-0 md:inline-flex">Ctrl K</Kbd>
          )}
        </div>
      </form>
    </search>
  );

  if (!desktop) {
    if (mobileSelection && mobileSelection.count > 0) {
      const hasOverflow = Boolean(
        mobileSelection.onDownload ||
          mobileSelection.onRename ||
          mobileSelection.onBookmark ||
          mobileSelection.onCopyDownloadLinks ||
          mobileSelection.onCut ||
          mobileSelection.onCopy ||
          mobileSelection.onVersions,
      );
      return (
        <header className="shrink-0 bg-sidebar px-2 pb-1.5 pt-2.5">
          <fieldset
            aria-label={t("selection.actions")}
            className="flex h-12 min-w-0 items-center gap-1 border-0 p-0 [&_button]:shrink-0"
          >
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="size-10 shrink-0 rounded-full text-[#0b57d0] dark:text-[#7cd0e3]"
              aria-label={t("selection.clear")}
              isDisabled={mobileSelection.pending}
              onPress={() => mobileSelection.onClear?.()}
            >
              <CloseIcon className="size-5" />
            </Button>
            <span className="min-w-0 truncate px-1 text-lg font-medium text-[#0b57d0] dark:text-[#7cd0e3]">
              {t("selection.count", { count: mobileSelection.count })}
            </span>
            <div className="ml-auto flex shrink-0 items-center gap-0.5 text-[#0b57d0] dark:text-[#7cd0e3]">
              {mobileSelection.onShare ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="size-10 rounded-full text-inherit"
                  aria-label={t("selection.share")}
                  isDisabled={mobileSelection.pending}
                  onPress={() => mobileSelection.onShare?.()}
                >
                  <LinkIcon className="size-5" />
                </Button>
              ) : null}
              {mobileSelection.onMove ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="size-10 rounded-full text-inherit"
                  aria-label={t("selection.move")}
                  isDisabled={mobileSelection.pending}
                  onPress={() => mobileSelection.onMove?.()}
                >
                  <MoveIcon className="size-5" />
                </Button>
              ) : null}
              {mobileSelection.onTrash ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="size-10 rounded-full text-inherit"
                  aria-label={t("selection.trash")}
                  isDisabled={mobileSelection.pending}
                  onPress={() => mobileSelection.onTrash?.()}
                >
                  <TrashIcon className="size-5" />
                </Button>
              ) : mobileSelection.onStopSharing ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="size-10 rounded-full text-inherit"
                  aria-label={t("selection.stopSharing")}
                  isDisabled={mobileSelection.pending}
                  onPress={() => mobileSelection.onStopSharing?.()}
                >
                  <UnshareIcon className="size-5" />
                </Button>
              ) : null}
              {mobileSelection.onSelectAll ? (
                <Button
                  isIconOnly
                  variant="ghost"
                  size="sm"
                  className="size-10 rounded-full text-inherit"
                  aria-label={t("selection.selectAll")}
                  isDisabled={mobileSelection.pending}
                  onPress={() => mobileSelection.onSelectAll?.()}
                >
                  <SelectAllIcon className="size-5" />
                </Button>
              ) : null}
              {hasOverflow ? (
                <Dropdown>
                  <Button
                    isIconOnly
                    variant="ghost"
                    size="sm"
                    className="size-10 rounded-full text-inherit"
                    aria-label={t("selection.actions")}
                  >
                    <MoreIcon className="size-5" />
                  </Button>
                  <Dropdown.Popover placement="bottom end" className="min-w-48 rounded-2xl p-1.5">
                    <Dropdown.Menu
                      aria-label={t("selection.actions")}
                      onAction={(key) => {
                        if (key === "download") mobileSelection.onDownload?.();
                        else if (key === "rename") mobileSelection.onRename?.();
                        else if (key === "bookmark") mobileSelection.onBookmark?.();
                        else if (key === "copy-links") mobileSelection.onCopyDownloadLinks?.();
                        else if (key === "cut") mobileSelection.onCut?.();
                        else if (key === "copy") mobileSelection.onCopy?.();
                        else if (key === "versions") mobileSelection.onVersions?.();
                      }}
                    >
                      {mobileSelection.onDownload ? (
                        <Dropdown.Item id="download" textValue={t("selection.download")}>
                          <DownloadIcon className="size-4" />
                          <Label>{t("drive.actionDownload")}</Label>
                        </Dropdown.Item>
                      ) : null}
                      {mobileSelection.onRename ? (
                        <Dropdown.Item id="rename" textValue={t("selection.rename")}>
                          <PencilIcon className="size-4" />
                          <Label>{t("drive.actionRename")}</Label>
                        </Dropdown.Item>
                      ) : null}
                      {mobileSelection.onBookmark ? (
                        <Dropdown.Item
                          id="bookmark"
                          textValue={
                            mobileSelection.bookmarked
                              ? t("selection.bookmarkRemove")
                              : t("selection.bookmarkAdd")
                          }
                        >
                          <BookmarkIcon className="size-4" />
                          <Label>
                            {mobileSelection.bookmarked
                              ? t("drive.actionBookmarkRemove")
                              : t("drive.actionBookmarkAdd")}
                          </Label>
                        </Dropdown.Item>
                      ) : null}
                      {mobileSelection.onCopyDownloadLinks ? (
                        <Dropdown.Item
                          id="copy-links"
                          textValue={
                            mobileSelection.count === 1
                              ? t("selection.copyLinkOne")
                              : t("selection.copyLinkMany")
                          }
                        >
                          <CopyLinkIcon className="size-4" />
                          <Label>{t("drive.actionCopyLink")}</Label>
                        </Dropdown.Item>
                      ) : null}
                      {mobileSelection.onCut ? (
                        <Dropdown.Item id="cut" textValue={t("selection.cut")}>
                          <CutIcon className="size-4" />
                          <Label>{t("selection.cut")}</Label>
                        </Dropdown.Item>
                      ) : null}
                      {mobileSelection.onCopy ? (
                        <Dropdown.Item id="copy" textValue={t("selection.copy")}>
                          <CopyIcon className="size-4" />
                          <Label>{t("drive.actionCopy")}</Label>
                        </Dropdown.Item>
                      ) : null}
                      {mobileSelection.onVersions ? (
                        <Dropdown.Item id="versions" textValue={t("versions.action")}>
                          <ClockIcon className="size-4" />
                          <Label>{t("versions.action")}</Label>
                        </Dropdown.Item>
                      ) : null}
                    </Dropdown.Menu>
                  </Dropdown.Popover>
                </Dropdown>
              ) : null}
            </div>
          </fieldset>
        </header>
      );
    }
    return (
      <header className="shrink-0 bg-sidebar px-3 pb-1 pt-2.5">
        <div className="flex h-12 items-center gap-2">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="size-10 shrink-0 rounded-full text-foreground"
            onPress={onOpenMobile}
            aria-label={t("sidebar.open")}
          >
            <MenuIcon className="size-5.5" />
          </Button>
          {searchForm}
          <div className="flex shrink-0 items-center gap-1">
            <AppSwitcher />
            <HeaderAccountAvatar />
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 bg-sidebar px-4 sm:px-5">
      <Button
        isIconOnly
        variant="ghost"
        size="sm"
        className="size-9 rounded-full text-[#444746] dark:text-[#c4c7c5]"
        onPress={onToggleSidebar}
        aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
      >
        {collapsed ? (
          <ChevronRightIcon className="size-4" />
        ) : (
          <ChevronLeftIcon className="size-4" />
        )}
      </Button>

      {searchForm}

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button
          isIconOnly
          variant="ghost"
          className="size-9 rounded-full text-[#444746] dark:text-[#c4c7c5]"
          onPress={() => void navigate({ to: "/settings" })}
          aria-label={t("title.settings")}
        >
          <SettingsIcon className="size-4.5" />
        </Button>
        <AppSwitcher />
        <Button
          isIconOnly
          variant="ghost"
          className="size-9 rounded-full text-[#444746] dark:text-[#c4c7c5]"
          onPress={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={t("theme.toggle")}
        >
          {resolvedTheme === "dark" ? (
            <SunIcon className="size-4.5" />
          ) : (
            <MoonIcon className="size-4.5" />
          )}
        </Button>
        <HeaderAccountAvatar />
      </div>
    </header>
  );
}

function HeaderAccountAvatar() {
  const { t } = useAppLocale();
  const navigate = useNavigate();
  const { resolvedTheme, setTheme } = useTheme();
  const { data: user } = useQuery(currentUserQueryOptions());
  const logout = $api.useMutation("post", "/v1/auth/cookie/logout");

  const displayName =
    user?.displayName?.trim() ||
    user?.username?.trim() ||
    (user ? t("account.userFallback", { id: user.userId }) : t("account.title"));
  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "U";

  const signOut = async () => {
    try {
      await logout.mutateAsync({});
      await clearDocumentCache().catch(() => {});
      getQueryClient().clear();
      await navigate({ to: "/login", search: { redirect: "/files" }, replace: true });
    } catch (error) {
      toast.error(t("account.logoutFailed"), { description: userMessage(error) });
    }
  };

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={displayName}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full p-0.5 outline-none"
      >
        <Avatar className="size-8 h-8 w-8 shrink-0 overflow-hidden rounded-full ring-2 ring-[#4285f4]/80 dark:ring-[#7cd0e3]/80">
          <Avatar.Image alt={displayName} src="/api/v1/me/photo" />
          <Avatar.Fallback>{initials}</Avatar.Fallback>
        </Avatar>
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-56 rounded-2xl p-1.5">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
          {user?.username ? <p className="truncate text-xs text-muted">@{user.username}</p> : null}
        </div>
        <Separator className="my-1" />
        <Dropdown.Menu
          aria-label={displayName}
          onAction={(key) => {
            if (key === "settings") void navigate({ to: "/settings" });
            else if (key === "theme") setTheme(resolvedTheme === "dark" ? "light" : "dark");
            else if (key === "logout") void signOut();
          }}
        >
          <Dropdown.Item id="settings" textValue={t("account.settings")}>
            <SettingsIcon className="size-4" />
            <Label>{t("account.settings")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="theme" textValue={t("theme.toggle")}>
            {resolvedTheme === "dark" ? (
              <SunIcon className="size-4" />
            ) : (
              <MoonIcon className="size-4" />
            )}
            <Label>{t("theme.toggle")}</Label>
          </Dropdown.Item>
          <Dropdown.Item id="logout" textValue={t("account.logout")} isDisabled={logout.isPending}>
            <LogoutIcon className="size-4" />
            <Label>{logout.isPending ? t("account.loggingOut") : t("account.logout")}</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function AppSwitcher() {
  const navigate = useNavigate();
  const { t } = useAppLocale();
  const pathname = useLocation({ select: (location) => location.pathname });
  const activeApp = getWorkspaceApp(pathname);
  const { data: user } = useQuery(currentUserQueryOptions());
  const isAdmin = Boolean(user?.capabilities.includes("system.manageUsers"));
  const canManageJobs = Boolean(user?.capabilities.includes("system.manageJobs"));
  const [open, setOpen] = useState(false);

  const go = (
    path: "/files" | "/photos" | "/admin" | "/storage" | "/docs" | "/tasks" | "/settings",
  ) => {
    setOpen(false);
    if (path === "/files") {
      void navigate({ to: "/files", search: { path: "/", query: "", view: "list" } });
    } else if (path === "/tasks") {
      void navigate({ to: "/tasks", search: { status: "running", query: "" } });
    } else {
      void navigate({ to: path });
    }
  };

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <Button
        isIconOnly
        variant="ghost"
        className="size-9 rounded-full"
        aria-label={t("apps.switcher")}
      >
        <WaffleGridIcon className="size-4.5" />
      </Button>
      <Dropdown.Popover className="w-80 rounded-3xl border border-border/60 bg-surface p-3 shadow-xl">
        <div className="mb-2 flex items-center justify-between px-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">
            {t("apps.workspaceSwitch")}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="ghost"
            onPress={() => go("/files")}
            className={cn(
              "h-auto flex-col items-center gap-2 rounded-2xl p-3 text-center",
              activeApp === "drive" ? "bg-accent/10 text-foreground" : "hover:bg-surface-secondary",
            )}
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-secondary">
              <GoogleDriveBrandIcon className="size-6.5" />
            </div>
            <span className="text-xs font-semibold">{t("apps.drive")}</span>
          </Button>
          <Button
            variant="ghost"
            onPress={() => go("/photos")}
            className={cn(
              "h-auto flex-col items-center gap-2 rounded-2xl p-3 text-center",
              activeApp === "photos"
                ? "bg-accent/10 text-foreground"
                : "hover:bg-surface-secondary",
            )}
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-secondary">
              <GooglePhotosBrandIcon className="size-6.5" />
            </div>
            <span className="text-xs font-semibold">{t("apps.photos")}</span>
          </Button>
          <Button
            variant="ghost"
            onPress={() => go(isAdmin ? "/admin" : "/storage")}
            className={cn(
              "h-auto flex-col items-center gap-2 rounded-2xl p-3 text-center",
              activeApp === "one" ? "bg-accent/10 text-foreground" : "hover:bg-surface-secondary",
            )}
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-secondary">
              <GoogleOneBrandIcon className="size-6.5" />
            </div>
            <span className="text-xs font-semibold">{t("apps.one")}</span>
          </Button>
          <Button
            variant="ghost"
            onPress={() => go("/docs")}
            className={cn(
              "h-auto flex-col items-center gap-1.5 rounded-2xl p-3 text-center",
              activeApp === "docs" ? "bg-accent/10 text-foreground" : "hover:bg-surface-secondary",
            )}
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-surface-secondary">
              <GoogleDocsBrandIcon className="size-6.5" />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold">{t("apps.docs")}</span>
              <Chip size="sm" variant="soft" className="h-4 px-1.5 text-[9px]">
                {t("apps.soonBadge")}
              </Chip>
            </div>
          </Button>
        </div>
        <Separator className="my-2.5 opacity-60" />
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-3 text-xs"
            onPress={() => go("/storage")}
          >
            <StorageIcon className="size-3.5" />
            {t("nav.storage")}
          </Button>
          {canManageJobs ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 rounded-full px-3 text-xs"
              onPress={() => go("/tasks")}
            >
              <TasksIcon className="size-3.5" />
              {t("nav.tasks")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-full px-3 text-xs"
            onPress={() => go("/settings")}
          >
            <SettingsIcon className="size-3.5" />
            {t("title.settings")}
          </Button>
        </div>
      </Dropdown.Popover>
    </Dropdown>
  );
}

function MobileDriveSubTabs() {
  const { t } = useAppLocale();
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeSearch = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const activeApp = getWorkspaceApp(pathname);
  const mobileSelection = useMobileSelectionStore((state) => state.selection);
  const { data: user } = useQuery(currentUserQueryOptions());
  const canManageJobs = Boolean(user?.capabilities.includes("system.manageJobs"));

  if (mobileSelection && mobileSelection.count > 0) return null;
  if (activeApp !== "drive" || pathname.startsWith("/trash") || pathname.startsWith("/search")) {
    return null;
  }

  const inHomeMode =
    (pathname.startsWith("/files") && routeSearch.recent === true) || pathname.startsWith("/tasks");
  const inSharedRootMode =
    (pathname.startsWith("/shared-with-me") || pathname === "/shared") &&
    !(typeof routeSearch.parentId === "string" && routeSearch.parentId.length > 0);

  if (!inHomeMode && !inSharedRootMode) {
    return null;
  }

  const tabs: Array<{
    key: string;
    label: string;
    to: AppRoutePath;
    search?: Record<string, unknown>;
    active: boolean;
  }> = inHomeMode
    ? canManageJobs
      ? [
          {
            key: "suggested",
            label: t("drive.suggested"),
            to: "/files",
            search: { recent: true },
            active: pathname.startsWith("/files") && routeSearch.recent === true,
          },
          {
            key: "activity",
            label: t("drive.activity"),
            to: "/tasks",
            active: pathname.startsWith("/tasks"),
          },
        ]
      : []
    : [
        {
          key: "shared-with-me",
          label: t("nav.sharedWithMe"),
          to: "/shared-with-me",
          active: pathname.startsWith("/shared-with-me"),
        },
        {
          key: "shared-by-me",
          label: t("nav.shared"),
          to: "/shared",
          active: pathname === "/shared",
        },
      ];

  if (tabs.length === 0) return null;

  return (
    <div className="flex h-11 shrink-0 items-stretch bg-sidebar px-2 lg:hidden">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          to={tab.to}
          search={(tab.search ?? {}) as never}
          className="relative flex flex-1 flex-col items-center justify-center text-sm transition-colors"
        >
          <span
            className={cn(
              "truncate px-2",
              tab.active
                ? "font-semibold text-[#0b57d0] dark:text-[#7cd0e3]"
                : "font-medium text-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </span>
          {tab.active ? (
            <span
              aria-hidden="true"
              className="absolute bottom-0 h-[3px] w-20 rounded-t-full bg-[#0b57d0] dark:bg-[#00d8f0]"
            />
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function MobileBottomBar() {
  const { t } = useAppLocale();
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeSearch = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const activeApp = getWorkspaceApp(pathname);
  const { data: user } = useQuery(currentUserQueryOptions());
  const capabilities = user?.capabilities ?? [];
  const items =
    activeApp === "drive" ? MOBILE_DRIVE_NAV : getNavForApp(activeApp, capabilities).slice(0, 4);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("apps.companionRail")}
      className="relative z-0 flex h-[68px] shrink-0 items-center justify-around bg-sidebar px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {items.map((item) => {
        const active = item.isActive(pathname, routeSearch);
        const Icon = active && item.activeIcon ? item.activeIcon : item.icon;
        return (
          <Link
            key={item.key}
            to={item.to}
            search={(item.search ?? {}) as never}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 py-1 text-center"
          >
            <div
              className={cn(
                "flex h-8 w-16 items-center justify-center rounded-full transition-colors",
                active
                  ? "bg-accent/10 bg-[#c2e7ff]! text-[#001d35]! dark:bg-[#22424a]! dark:text-[#cdeaf2]!"
                  : "text-[#444746] dark:text-[#c4c7c5]",
              )}
            >
              <Icon className="size-4.5" />
            </div>
            <span
              className={cn(
                "max-w-full truncate px-1 text-[11px] leading-tight",
                active ? "font-semibold text-foreground" : "font-medium text-muted",
              )}
            >
              {item.key === "sharedWithMe" ? t("nav.shared") : t(item.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileFloatingActionButton() {
  const { t } = useAppLocale();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeSearch = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const mobileSelection = useMobileSelectionStore((state) => state.selection);
  const hasMobileSelection = (mobileSelection?.count ?? 0) > 0;
  const [speedDialOpen, setSpeedDialOpen] = useState(false);

  useEffect(() => {
    setSpeedDialOpen(false);
  }, [pathname, hasMobileSelection]);

  useEffect(() => {
    if (!speedDialOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSpeedDialOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [speedDialOpen]);

  if (mobileSelection && mobileSelection.count > 0) return null;

  if (pathname === "/files" && routeSearch.bookmarked !== true) {
    return (
      <>
        {speedDialOpen ? (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/65 backdrop-blur-[1px] lg:hidden"
            onClick={() => setSpeedDialOpen(false)}
          />
        ) : null}
        <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-3 lg:hidden">
          {speedDialOpen ? (
            <div className="flex flex-col items-end gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
              <Button
                size="md"
                variant="secondary"
                className="h-12 gap-2.5 rounded-full bg-[#c2e7ff] px-5 text-sm font-medium text-[#001d35] shadow-md dark:bg-[#004f58] dark:text-[#cdeff5]"
                onPress={() => {
                  setSpeedDialOpen(false);
                  void navigate({ to: "/docs" });
                }}
              >
                <FileTextIcon className="size-4.5" />
                {t("drive.newDocument")}
              </Button>
              <Button
                size="md"
                variant="secondary"
                className="h-12 gap-2.5 rounded-full bg-[#c2e7ff] px-5 text-sm font-medium text-[#001d35] shadow-md dark:bg-[#004f58] dark:text-[#cdeff5]"
                onPress={() => {
                  setSpeedDialOpen(false);
                  dispatchWorkspaceAction("drive:upload-files");
                }}
              >
                <UploadIcon className="size-4.5" />
                {t("files.uploadFiles")}
              </Button>
              <Button
                size="md"
                variant="secondary"
                className="h-12 gap-2.5 rounded-full bg-[#c2e7ff] px-5 text-sm font-medium text-[#001d35] shadow-md dark:bg-[#004f58] dark:text-[#cdeff5]"
                onPress={() => {
                  setSpeedDialOpen(false);
                  dispatchWorkspaceAction("drive:upload-folder");
                }}
              >
                <FolderPlusIcon className="size-4.5" />
                {t("files.uploadFolder")}
              </Button>
              <Button
                size="md"
                variant="secondary"
                className="h-12 gap-2.5 rounded-full bg-[#c2e7ff] px-5 text-sm font-medium text-[#001d35] shadow-md dark:bg-[#004f58] dark:text-[#cdeff5]"
                onPress={() => {
                  setSpeedDialOpen(false);
                  dispatchWorkspaceAction("drive:new-folder");
                }}
              >
                <FolderIcon className="size-4.5" />
                {t("files.newFolder")}
              </Button>
            </div>
          ) : null}
          <Button
            isIconOnly
            variant="secondary"
            aria-label={t("drive.openNewMenu")}
            aria-expanded={speedDialOpen}
            className={
              speedDialOpen
                ? "size-14 rounded-full bg-[#0b57d0] text-white shadow-xl dark:bg-[#00d8f0] dark:text-[#002024]"
                : "size-14 rounded-2xl bg-[#c2e7ff] text-[#001d35] shadow-lg dark:bg-[#004f58] dark:text-[#cdeff5]"
            }
            onPress={() => setSpeedDialOpen((prev) => !prev)}
          >
            {speedDialOpen ? <CloseIcon className="size-6" /> : <PlusIcon className="size-6" />}
          </Button>
        </div>
      </>
    );
  }

  if (pathname.startsWith("/photos")) {
    return (
      <div className="fixed bottom-20 right-4 z-30 lg:hidden">
        <Dropdown>
          <Button
            isIconOnly
            variant="secondary"
            aria-label={t("photos.newAlbum")}
            className="size-14 rounded-2xl border border-border/40 bg-[#c2e7ff] text-[#001d35] shadow-lg hover:shadow-xl dark:bg-[#004a77] dark:text-[#c2e7ff]"
          >
            <PlusIcon className="size-6" />
          </Button>
          <Dropdown.Popover placement="top end" className="min-w-48 rounded-2xl p-1.5">
            <Dropdown.Menu
              aria-label={t("photos.newAlbum")}
              onAction={(key) => {
                if (key === "album") dispatchWorkspaceAction("photos:new-album");
                if (key === "upload") dispatchWorkspaceAction("photos:upload");
              }}
            >
              <Dropdown.Item id="album" textValue={t("photos.newAlbum")}>
                <FolderPlusIcon className="size-4 text-accent" />
                <Label>{t("photos.newAlbum")}</Label>
              </Dropdown.Item>
              <Dropdown.Item id="upload" textValue={t("photos.uploadPhotos")}>
                <UploadIcon className="size-4 text-muted" />
                <Label>{t("photos.uploadPhotos")}</Label>
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
    );
  }

  return null;
}

function Layout() {
  const navigate = useNavigate();
  const { t } = useAppLocale();
  const pathname = useLocation({ select: (location) => location.pathname });
  const [collapsed, setCollapsed] = useState(false);
  const [desktop, setDesktop] = useState(() =>
    typeof window === "undefined" ? true : window.innerWidth >= DESKTOP_BREAKPOINT,
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${DESKTOP_BREAKPOINT}px)`);
    const update = () => {
      setDesktop(media.matches);
      if (media.matches) setMobileOpen(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (pathname === "/login" || pathname.startsWith("/share/")) return <Outlet />;
  return (
    <AriaRouterProvider
      navigate={(path) => navigate({ to: String(path) })}
      useHref={(path) => String(path)}
    >
      <div className="relative z-0 flex h-dvh w-full overflow-hidden bg-sidebar text-foreground">
        {desktop && <Sidebar collapsed={collapsed} />}
        {!desktop && mobileOpen && (
          <div
            className="fixed inset-0 z-[80] flex"
            role="dialog"
            aria-modal="true"
            aria-label={t("sidebar.dialog")}
          >
            <div
              aria-hidden="true"
              className="fixed inset-0 bg-black/55 backdrop-blur-xs"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative z-10 h-full bg-sidebar shadow-2xl">
              <Sidebar collapsed={false} mobile onNavigate={() => setMobileOpen(false)} />
              <Button
                isIconOnly
                variant="ghost"
                className="absolute right-3 top-3 size-9 rounded-xl"
                onPress={() => setMobileOpen(false)}
                aria-label={t("sidebar.close")}
              >
                <CloseIcon className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="relative z-0 flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            collapsed={collapsed}
            desktop={desktop}
            onToggleSidebar={() => setCollapsed((value) => !value)}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <MobileDriveSubTabs />
          <main
            className={cn(
              "flex min-h-0 min-w-0 flex-1 flex-col select-none overflow-hidden lg:px-4 lg:pb-4 lg:pt-0",
              getWorkspaceApp(pathname) === "drive" ? "p-0" : "px-2 pb-2 pt-1 sm:px-4 sm:pb-4",
            )}
          >
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-y-auto bg-surface lg:rounded-3xl lg:shadow-xs lg:ring-1 lg:ring-border/35",
                getWorkspaceApp(pathname) === "drive"
                  ? "rounded-t-[28px] bg-white dark:bg-[#131314] p-0 pt-1 lg:rounded-2xl lg:p-2"
                  : "rounded-2xl p-2.5 sm:p-4 lg:p-5",
              )}
            >
              <Outlet />
            </div>
          </main>
          <MobileFloatingActionButton />
          <MobileBottomBar />
        </div>
        <UploadShelf />
      </div>
    </AriaRouterProvider>
  );
}

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context, location }) => {
    if (location.pathname === "/login" || location.pathname.startsWith("/share/")) return;
    try {
      await context.queryClient.ensureQueryData(currentUserQueryOptions());
      await context.queryClient.ensureQueryData(preferencesQueryOptions());
    } catch (error) {
      if (!isUnauthorized(error)) throw error;
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
        replace: true,
      });
    }
  },
  component: Layout,
});
