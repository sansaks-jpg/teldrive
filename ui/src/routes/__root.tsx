import {
  RouterProvider as AriaRouterProvider,
  Avatar,
  Button,
  Chip,
  cn,
  Dropdown,
  InputGroup,
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
  getWorkspaceApp,
  GoogleDocsBrandIcon,
  GoogleDriveBrandIcon,
  GoogleOneBrandIcon,
  GooglePhotosBrandIcon,
  WaffleGridIcon,
  type WorkspaceAction,
  type WorkspaceAppId,
} from "@/components/google-workspace";
import { clearDocumentCache } from "@/features/files/document-cache";
import { useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { useTheme } from "@/lib/theme";
import UploadIcon from "~icons/gravity-ui/arrow-up-from-line";
import LogoutIcon from "~icons/gravity-ui/arrow-right-from-square";
import MenuIcon from "~icons/gravity-ui/bars";
import BookmarkIcon from "~icons/gravity-ui/bookmark";
import ChevronLeftIcon from "~icons/gravity-ui/chevron-left";
import ChevronRightIcon from "~icons/gravity-ui/chevron-right";
import StorageIcon from "~icons/gravity-ui/database";
import FileIcon from "~icons/gravity-ui/file";
import FolderIcon from "~icons/gravity-ui/folder";
import FolderPlusIcon from "~icons/gravity-ui/folder-plus";
import SettingsIcon from "~icons/gravity-ui/gear";
import HeartIcon from "~icons/gravity-ui/heart";
import TasksIcon from "~icons/gravity-ui/list-ul";
import SearchIcon from "~icons/gravity-ui/magnifier";
import MoonIcon from "~icons/gravity-ui/moon";
import PlusIcon from "~icons/gravity-ui/plus";
import ShieldIcon from "~icons/gravity-ui/shield-check";
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
  to: AppRoutePath;
  search?: Record<string, unknown>;
  capability?: string;
  isActive: (pathname: string, search: Record<string, unknown>) => boolean;
};

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
      pathname.startsWith("/photos") &&
      (!search.mode || search.mode === "timeline"),
  },
  {
    key: "photos-favorites",
    labelKey: "photos.tabFavorites",
    icon: HeartIcon,
    to: "/photos",
    search: { mode: "favorites" },
    isActive: (pathname, search) =>
      pathname.startsWith("/photos") && search.mode === "favorites",
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
    isActive: (pathname, search) =>
      pathname.startsWith("/photos") && search.mode === "screenshots",
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
  const isAdmin = capabilities.includes("system.manageUsers");
  const canManageJobs = capabilities.includes("system.manageJobs");
  const visibleNav = getNavForApp(activeApp, capabilities);

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
          buttonVariants({ variant: active ? "secondary" : "ghost" }),
          "h-10 w-full justify-start rounded-full px-3 text-sm font-medium",
          active
            ? "bg-accent/10 text-accent"
            : "text-muted hover:bg-default/30 hover:text-foreground",
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

      {mobile && (
        <div className="mx-3 mb-2 rounded-2xl border border-border/50 bg-surface-secondary/50 p-2">
          <p className="mb-1.5 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
            {t("apps.workspaceSwitch")}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              to="/files"
              search={{ path: "/", query: "", view: "list" }}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
                activeApp === "drive"
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted hover:bg-surface/60 hover:text-foreground",
              )}
            >
              <GoogleDriveBrandIcon className="size-4 shrink-0" />
              <span className="truncate">{t("apps.drive")}</span>
            </Link>
            <Link
              to="/photos"
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
                activeApp === "photos"
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted hover:bg-surface/60 hover:text-foreground",
              )}
            >
              <GooglePhotosBrandIcon className="size-4 shrink-0" />
              <span className="truncate">{t("apps.photos")}</span>
            </Link>
            <Link
              to={isAdmin ? "/admin" : "/storage"}
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
                activeApp === "one"
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted hover:bg-surface/60 hover:text-foreground",
              )}
            >
              <GoogleOneBrandIcon className="size-4 shrink-0" />
              <span className="truncate">{t("apps.one")}</span>
            </Link>
            <Link
              to="/docs"
              onClick={() => onNavigate?.()}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2.5 py-2 text-xs font-medium transition-colors",
                activeApp === "docs"
                  ? "bg-surface text-foreground shadow-xs"
                  : "text-muted hover:bg-surface/60 hover:text-foreground",
              )}
            >
              <GoogleDocsBrandIcon className="size-4 shrink-0" />
              <span className="truncate">{t("apps.docs")}</span>
            </Link>
          </div>
          {canManageJobs && activeApp !== "one" ? (
            <Link
              to="/tasks"
              search={{ status: "running", query: "" }}
              onClick={() => onNavigate?.()}
              className="mt-1.5 flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface/60 hover:text-foreground"
            >
              <TasksIcon className="size-3.5 shrink-0" />
              <span>{t("nav.tasks")}</span>
            </Link>
          ) : null}
        </div>
      )}

      {activeApp === "drive" && (
        <div className="px-3 pt-1">
          <Dropdown>
            <Button
              variant="secondary"
              aria-label={t("nav.newAction")}
              className={cn(
                "h-13 rounded-2xl border border-border/50 bg-surface font-medium text-foreground shadow-sm transition-shadow hover:bg-surface hover:shadow-md",
                collapsed && !mobile
                  ? "w-10 min-w-0 justify-center px-0"
                  : "w-32 justify-start gap-3 px-4",
              )}
            >
              <PlusIcon className="size-5 shrink-0 text-foreground" />
              {(!collapsed || mobile) && <span className="text-sm">{t("nav.newAction")}</span>}
            </Button>
            <Dropdown.Popover placement="bottom start" className="min-w-56 rounded-2xl p-1.5">
              <Dropdown.Menu
                aria-label={t("nav.newAction")}
                onAction={(key) => {
                  if (key === "folder") void triggerDriveAction("drive:new-folder");
                  if (key === "files") void triggerDriveAction("drive:upload-files");
                  if (key === "uploadFolder") void triggerDriveAction("drive:upload-folder");
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
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>
        </div>
      )}

      {activeApp === "photos" && (
        <div className="px-3 pt-1">
          <Dropdown>
            <Button
              variant="secondary"
              aria-label={t("photos.newAlbum")}
              className={cn(
                "h-13 rounded-2xl border border-border/50 bg-surface font-medium text-foreground shadow-sm transition-shadow hover:bg-surface hover:shadow-md",
                collapsed && !mobile
                  ? "w-10 min-w-0 justify-center px-0"
                  : "w-44 justify-start gap-3 px-4",
              )}
            >
              <PlusIcon className="size-5 shrink-0 text-accent" />
              {(!collapsed || mobile) && <span className="text-sm">{t("photos.newAlbum")}</span>}
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
        <Dropdown isOpen={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
          {collapsed && !mobile ? (
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
        {(!collapsed || mobile) && (
          <p className="mt-2 truncate px-2 text-xs text-muted" title={versionLabel}>
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
        <InputGroup
          className={cn(
            "w-full rounded-full border-0 shadow-none transition-shadow",
            desktop
              ? "h-11 bg-[#e9eef6] px-2 focus-within:bg-surface focus-within:shadow-md dark:bg-[#282a2c]"
              : "h-10 bg-transparent px-1 focus-within:bg-transparent",
          )}
          variant="secondary"
        >
          {desktop && (
            <InputGroup.Prefix>
              <SearchIcon className="size-4 text-muted" />
            </InputGroup.Prefix>
          )}
          <InputGroup.Input
            ref={searchRef}
            aria-label={t("search.aria")}
            value={searchText}
            maxLength={512}
            enterKeyHint="search"
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
            className="min-w-0 text-sm"
          />
          {desktop && (
            <InputGroup.Suffix className="hidden md:flex">
              <Kbd>Ctrl K</Kbd>
            </InputGroup.Suffix>
          )}
        </InputGroup>
      </form>
    </search>
  );

  if (!desktop) {
    return (
      <header className="shrink-0 bg-sidebar px-3 pb-1.5 pt-2.5">
        <div className="flex h-12 items-center gap-1 rounded-full border border-border/50 bg-[#e9eef6] px-1.5 shadow-xs dark:bg-[#282a2c]">
          <Button
            isIconOnly
            variant="ghost"
            size="sm"
            className="size-9 shrink-0 rounded-full"
            onPress={onOpenMobile}
            aria-label={t("sidebar.open")}
          >
            <MenuIcon className="size-4.5" />
          </Button>
          {searchForm}
          <div className="flex shrink-0 items-center gap-0.5 pr-0.5">
            <AppSwitcher />
            <Button
              isIconOnly
              variant="ghost"
              size="sm"
              className="size-9 rounded-full"
              onPress={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label={t("theme.toggle")}
            >
              {resolvedTheme === "dark" ? (
                <SunIcon className="size-4" />
              ) : (
                <MoonIcon className="size-4" />
              )}
            </Button>
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
        className="size-9 rounded-full"
        onPress={onToggleSidebar}
        aria-label={collapsed ? t("sidebar.expand") : t("sidebar.collapse")}
      >
        {collapsed ? <ChevronRightIcon className="size-4" /> : <ChevronLeftIcon className="size-4" />}
      </Button>

      {searchForm}

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button
          isIconOnly
          variant="ghost"
          className="size-9 rounded-full"
          onPress={() => void navigate({ to: "/settings" })}
          aria-label={t("title.settings")}
        >
          <SettingsIcon className="size-4.5" />
        </Button>
        <AppSwitcher />
        <Button
          isIconOnly
          variant="ghost"
          className="size-9 rounded-full"
          onPress={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label={t("theme.toggle")}
        >
          {resolvedTheme === "dark" ? (
            <SunIcon className="size-4.5" />
          ) : (
            <MoonIcon className="size-4.5" />
          )}
        </Button>
      </div>
    </header>
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

  const go = (path: "/files" | "/photos" | "/admin" | "/storage" | "/docs" | "/tasks" | "/settings") => {
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
              activeApp === "drive"
                ? "bg-accent/10 text-foreground"
                : "hover:bg-surface-secondary",
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
              activeApp === "one"
                ? "bg-accent/10 text-foreground"
                : "hover:bg-surface-secondary",
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
              activeApp === "docs"
                ? "bg-accent/10 text-foreground"
                : "hover:bg-surface-secondary",
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

function MobileBottomBar() {
  const { t } = useAppLocale();
  const pathname = useLocation({ select: (location) => location.pathname });
  const routeSearch = useLocation({
    select: (location) => location.search as Record<string, unknown>,
  });
  const activeApp = getWorkspaceApp(pathname);
  const { data: user } = useQuery(currentUserQueryOptions());
  const capabilities = user?.capabilities ?? [];
  const items = getNavForApp(activeApp, capabilities).slice(0, 4);

  if (items.length === 0) return null;

  return (
    <nav
      aria-label={t("apps.companionRail")}
      className="flex h-16 shrink-0 items-center justify-around border-t border-border/50 bg-sidebar/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {items.map((item) => {
        const active = item.isActive(pathname, routeSearch);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            to={item.to}
            search={(item.search ?? {}) as never}
            className="flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-center"
          >
            <div
              className={cn(
                "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                active ? "bg-accent/15 text-accent" : "text-muted",
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
              {t(item.labelKey)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

function MobileFloatingActionButton() {
  const { t } = useAppLocale();
  const pathname = useLocation({ select: (location) => location.pathname });

  if (pathname === "/files") {
    return (
      <div className="fixed bottom-20 right-4 z-30 lg:hidden">
        <Dropdown>
          <Button
            isIconOnly
            variant="secondary"
            aria-label={t("drive.openNewMenu")}
            className="size-14 rounded-2xl border border-border/40 bg-[#c2e7ff] text-[#001d35] shadow-lg hover:shadow-xl dark:bg-[#004a77] dark:text-[#c2e7ff]"
          >
            <PlusIcon className="size-6" />
          </Button>
          <Dropdown.Popover placement="top end" className="min-w-52 rounded-2xl p-1.5">
            <Dropdown.Menu
              aria-label={t("drive.openNewMenu")}
              onAction={(key) => {
                if (key === "folder") dispatchWorkspaceAction("drive:new-folder");
                if (key === "files") dispatchWorkspaceAction("drive:upload-files");
                if (key === "uploadFolder") dispatchWorkspaceAction("drive:upload-folder");
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
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown>
      </div>
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
      <div className="flex h-dvh w-full overflow-hidden bg-sidebar text-foreground">
        {desktop && <Sidebar collapsed={collapsed} />}
        {!desktop && mobileOpen && (
          <div
            className="fixed inset-0 z-50 flex"
            role="dialog"
            aria-modal="true"
            aria-label={t("sidebar.dialog")}
          >
            <Button
              type="button"
              variant="ghost"
              aria-label={t("sidebar.close")}
              className="absolute inset-0 h-full w-full rounded-none bg-black/55 backdrop-blur-sm"
              onPress={() => setMobileOpen(false)}
            />
            <div className="relative z-10 h-full animate-in slide-in-from-left duration-200">
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

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <TopBar
            collapsed={collapsed}
            desktop={desktop}
            onToggleSidebar={() => setCollapsed((value) => !value)}
            onOpenMobile={() => setMobileOpen(true)}
          />
          <main className="min-w-0 flex-1 select-none overflow-hidden px-2 pb-2 pt-1 sm:px-4 sm:pb-4 lg:px-5 lg:pb-5 lg:pt-0">
            <div className="flex h-full min-h-0 flex-col overflow-y-auto rounded-3xl bg-background/60 p-2 sm:p-4 lg:bg-surface lg:p-5 lg:shadow-xs lg:ring-1 lg:ring-border/35">
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
