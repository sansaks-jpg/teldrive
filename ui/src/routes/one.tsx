import { Button, Card, Chip, Input, Label, Spinner, Tabs, TextField } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import LogoutIcon from "~icons/gravity-ui/arrow-right-from-square";
import RefreshIcon from "~icons/gravity-ui/arrow-rotate-left";
import KeyIcon from "~icons/gravity-ui/key";
import LockIcon from "~icons/gravity-ui/lock";
import MailIcon from "~icons/gravity-ui/envelope";
import PlusIcon from "~icons/gravity-ui/plus";
import ShieldIcon from "~icons/gravity-ui/shield-check";
import { $api, fetchClient } from "@/api/client";
import { unwrap, userMessage } from "@/api/errors";
import type { components } from "@/api/schema";
import { currentUserQueryOptions } from "@/auth/queries";
import { AppDialog } from "@/components/dialogs/app-dialog";
import {
  GoogleOneBrandIcon,
  GoogleOneSegmentedBar,
  type StorageSegment,
} from "@/components/google-workspace";
import { LinkButton } from "@/components/link-button";
import { SettingsRow, SettingsSection } from "@/components/settings-layout";
import { BotsPanel } from "@/features/admin/bots-panel";
import { ChannelsPanel } from "@/features/admin/channels-panel";
import { PeriodicJobsPanel } from "@/features/admin/periodic-jobs-panel";
import { clearDocumentCache } from "@/features/files/document-cache";
import { newIdempotencyKey } from "@/features/shared/idempotency";
import { useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";
import { useDebouncedValue } from "@/lib/use-debounced-value";

type OneTab = "overview" | "users" | "telegram" | "bots" | "jobs" | "audit";
type UserRoleFilter = "all" | "admin" | "member" | "disabled" | "quota";
type UserSortKey = "storage" | "files" | "newest" | "name";
type AdminUserSummary = components["schemas"]["AdminUserSummary"];
type TgStep = "phone" | "code" | "password";

const USER_BAR_COLORS = [
  { colorClass: "bg-[#1a73e8]", dotClass: "bg-[#1a73e8]" },
  { colorClass: "bg-[#34a853]", dotClass: "bg-[#34a853]" },
  { colorClass: "bg-[#fbbc04]", dotClass: "bg-[#fbbc04]" },
  { colorClass: "bg-[#ea4335]", dotClass: "bg-[#ea4335]" },
] as const;

const VALID_TABS: readonly OneTab[] = ["overview", "users", "telegram", "bots", "jobs", "audit"];

function normalizeTab(value: unknown): OneTab {
  if (typeof value === "string" && (VALID_TABS as readonly string[]).includes(value)) {
    return value as OneTab;
  }
  return "overview";
}

export const Route = createFileRoute("/one")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: normalizeTab(search.tab),
  }),
  component: OneConsolePage,
});

function OneConsolePage() {
  const navigate = useNavigate();
  const { t } = useAppLocale();
  const { tab } = Route.useSearch();

  const bootstrapQuery = useQuery({
    queryKey: ["one", "bootstrap-status"],
    queryFn: () => unwrap(fetchClient.GET("/v1/auth/bootstrap-status")),
    staleTime: 5_000,
  });

  const sessionQuery = useQuery({
    queryKey: ["one", "me-optional"],
    queryFn: async () => {
      const res = await fetchClient.GET("/v1/me");
      if (res.error || !res.data) {
        return null;
      }
      return res.data;
    },
    staleTime: 10_000,
    retry: false,
  });

  const me = sessionQuery.data ?? null;
  const isAdmin = Boolean(me?.capabilities.includes("system.manageUsers"));

  useEffect(() => {
    if (sessionQuery.isSuccess && me && !isAdmin) {
      void navigate({
        to: "/drive/files",
        search: { path: "/", query: "", view: "list" },
        replace: true,
      });
    }
  }, [isAdmin, me, navigate, sessionQuery.isSuccess]);

  const refreshAuth = async () => {
    const qc = getQueryClient();
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["one", "bootstrap-status"] }),
      qc.invalidateQueries({ queryKey: ["one", "me-optional"] }),
      qc.invalidateQueries({ queryKey: currentUserQueryOptions().queryKey }),
    ]);
  };

  if (bootstrapQuery.isPending || sessionQuery.isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f0f4f9] dark:bg-[#131314]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (me && !isAdmin) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#f0f4f9] dark:bg-[#131314]">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!me) {
    const bootstrap = bootstrapQuery.data ?? { telegramLinked: false, emailAuthReady: false };
    return (
      <OneAuthGate
        telegramLinked={bootstrap.telegramLinked}
        emailAuthReady={bootstrap.emailAuthReady}
        onSuccess={() => void refreshAuth()}
        t={t}
      />
    );
  }

  return (
    <OneWorkspaceDashboard
      me={me}
      tab={tab}
      onTabChange={(nextTab) =>
        void navigate({ to: "/one", search: { tab: nextTab }, replace: true })
      }
      onRefreshAuth={() => void refreshAuth()}
    />
  );
}

function OneAuthGate({
  telegramLinked,
  emailAuthReady,
  onSuccess,
  t,
}: {
  telegramLinked: boolean;
  emailAuthReady: boolean;
  onSuccess: () => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const [authMode, setAuthMode] = useState<"telegram" | "email">(
    telegramLinked ? "email" : "telegram",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tgStep, setTgStep] = useState<TgStep>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [tgPassword, setTgPassword] = useState("");
  const [flowId, setFlowId] = useState<string | null>(null);

  const emailLogin = $api.useMutation("post", "/v1/auth/cookie/password/login");
  const startTg = $api.useMutation("post", "/v1/auth/telegram/start");
  const verifyCode = $api.useMutation("post", "/v1/auth/cookie/telegram/verify-code");
  const verifyTgPassword = $api.useMutation("post", "/v1/auth/cookie/telegram/verify-password");

  const handleEmailSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      toast.error(t("login.emailPasswordRequired"));
      return;
    }
    try {
      await emailLogin.mutateAsync({ body: { email: email.trim().toLowerCase(), password } });
      toast.success(t("login.signedIn"));
      onSuccess();
    } catch (error) {
      toast.error(t("login.signInFailed"), { description: userMessage(error) });
    }
  };

  const handleTelegramStep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (tgStep === "phone") {
        let normalized = phone.replace(/[\s().-]/g, "");
        if (/^[1-9][0-9]{7,14}$/.test(normalized)) normalized = `+${normalized}`;
        if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
          toast.error(t("login.phoneInvalid"));
          return;
        }
        const flow = await startTg.mutateAsync({
          params: { header: { "Idempotency-Key": newIdempotencyKey() } },
          body: { phoneNumber: normalized },
        });
        setPhone(normalized);
        setFlowId(flow.flowId);
        setTgStep("code");
        return;
      }
      if (!flowId) return;
      if (tgStep === "code") {
        const res = await verifyCode.mutateAsync({
          params: { header: { "Idempotency-Key": newIdempotencyKey() } },
          body: { flowId, code: code.trim() },
        });
        if ("passwordRequired" in res && res.passwordRequired) {
          setTgStep("password");
          return;
        }
        toast.success(t("login.signedIn"));
        onSuccess();
        return;
      }
      await verifyTgPassword.mutateAsync({
        params: { header: { "Idempotency-Key": newIdempotencyKey() } },
        body: { flowId, password: tgPassword },
      });
      toast.success(t("login.signedIn"));
      onSuccess();
    } catch (error) {
      toast.error(t("login.signInFailed"), { description: userMessage(error) });
    }
  };

  const tgBusy = startTg.isPending || verifyCode.isPending || verifyTgPassword.isPending;

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#f0f4f9] px-4 py-10 dark:bg-[#131314]">
      <Card className="w-full max-w-[28rem] rounded-3xl border border-border/50 bg-surface p-7 shadow-xl sm:p-9">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-surface-secondary shadow-xs ring-1 ring-border/40">
            <GoogleOneBrandIcon className="size-8" />
          </div>
          <h1 className="text-2xl font-normal tracking-tight text-foreground">
            {!telegramLinked ? t("one.setupTitle") : t("one.adminSignInTitle")}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {!telegramLinked ? t("one.setupDesc") : t("one.adminSignInDesc")}
          </p>
        </div>

        {telegramLinked && !emailAuthReady ? (
          <div className="mb-5 flex gap-2 rounded-full bg-surface-secondary p-1">
            <Button
              size="sm"
              variant={authMode === "email" ? "primary" : "ghost"}
              className="flex-1 rounded-full"
              onPress={() => setAuthMode("email")}
            >
              Email & Password
            </Button>
            <Button
              size="sm"
              variant={authMode === "telegram" ? "primary" : "ghost"}
              className="flex-1 rounded-full"
              onPress={() => setAuthMode("telegram")}
            >
              Owner Telegram Phone
            </Button>
          </div>
        ) : null}

        {telegramLinked && (emailAuthReady || authMode === "email") ? (
          <form className="grid gap-4" onSubmit={handleEmailSignIn}>
            <TextField isDisabled={emailLogin.isPending}>
              <Label>{t("login.emailLabel")}</Label>
              <div className="relative flex items-center">
                <MailIcon className="pointer-events-none absolute left-3 size-4 text-muted" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  placeholder="admin@workspace.local"
                  autoComplete="username"
                  autoFocus
                  className="w-full pl-9"
                />
              </div>
            </TextField>
            <TextField isDisabled={emailLogin.isPending}>
              <Label>{t("login.passwordLabel")}</Label>
              <div className="relative flex items-center">
                <LockIcon className="pointer-events-none absolute left-3 size-4 text-muted" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full pl-9"
                />
              </div>
            </TextField>
            <Button
              type="submit"
              variant="primary"
              className="mt-2 h-11 w-full rounded-full font-medium"
              isPending={emailLogin.isPending}
            >
              {t("login.signIn")}
            </Button>
          </form>
        ) : (
          <form className="grid gap-4" onSubmit={handleTelegramStep}>
            {tgStep === "phone" ? (
              <TextField isDisabled={tgBusy}>
                <Label>Telegram Phone Number</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.currentTarget.value)}
                  placeholder="+6281234567890"
                  autoFocus
                />
              </TextField>
            ) : tgStep === "code" ? (
              <TextField isDisabled={tgBusy}>
                <Label>Verification Code sent to {phone}</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  placeholder="12345"
                  autoFocus
                />
              </TextField>
            ) : (
              <TextField isDisabled={tgBusy}>
                <Label>Telegram 2FA Password</Label>
                <Input
                  type="password"
                  value={tgPassword}
                  onChange={(e) => setTgPassword(e.currentTarget.value)}
                  placeholder="••••••••"
                  autoFocus
                />
              </TextField>
            )}
            <Button
              type="submit"
              variant="primary"
              className="mt-2 h-11 w-full rounded-full font-medium"
              isPending={tgBusy}
            >
              {tgStep === "phone"
                ? "Send Telegram Code"
                : tgStep === "code"
                  ? "Verify Code"
                  : "Verify 2FA & Continue"}
            </Button>
            {tgStep !== "phone" ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onPress={() => {
                  setTgStep("phone");
                  setFlowId(null);
                  setCode("");
                  setTgPassword("");
                }}
              >
                Use another phone number
              </Button>
            ) : null}
          </form>
        )}
      </Card>
    </div>
  );
}

function OneWorkspaceDashboard({
  me,
  tab,
  onTabChange,
  onRefreshAuth,
}: {
  me: components["schemas"]["UserProfile"];
  tab: OneTab;
  onTabChange: (tab: OneTab) => void;
  onRefreshAuth: () => void;
}) {
  const navigate = useNavigate();
  const { t, locale } = useAppLocale();
  const formatBytes = useFormatBytes();
  const queryClient = getQueryClient();

  const [bindEmail, setBindEmail] = useState(me.email ?? "");
  const [bindPassword, setBindPassword] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState<UserRoleFilter>("all");
  const [userSort, setUserSort] = useState<UserSortKey>("storage");
  const [actionFilter, setActionFilter] = useState("");
  const [quotaInputs, setQuotaInputs] = useState<Record<number, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [newQuotaGb, setNewQuotaGb] = useState("");
  const [editUserTarget, setEditUserTarget] = useState<AdminUserSummary | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const [relinkStep, setRelinkStep] = useState<TgStep>("phone");
  const [relinkPhone, setRelinkPhone] = useState("");
  const [relinkCode, setRelinkCode] = useState("");
  const [relinkPassword, setRelinkPassword] = useState("");
  const [relinkFlowId, setRelinkFlowId] = useState<string | null>(null);

  const debouncedAction = useDebouncedValue(actionFilter.trim(), 300);

  const overviewQuery = $api.useQuery("get", "/v1/admin/overview", {}, { staleTime: 10_000 });
  const tgStatusQuery = $api.useQuery("get", "/v1/admin/telegram", {}, { staleTime: 10_000 });
  const usersQuery = $api.useQuery(
    "get",
    "/v1/admin/users",
    {},
    { staleTime: 10_000, placeholderData: keepPreviousData },
  );
  const auditQuery = $api.useQuery(
    "get",
    "/v1/admin/audit-events",
    { params: { query: { action: debouncedAction || undefined, limit: 30 } } },
    { staleTime: 10_000, placeholderData: keepPreviousData },
  );

  const setupCreds = $api.useMutation("post", "/v1/me/setup-credentials");
  const createUser = $api.useMutation("post", "/v1/admin/users");
  const updateUser = $api.useMutation("patch", "/v1/admin/users/{userId}");
  const revokeAccess = $api.useMutation("post", "/v1/admin/users/{userId}/revoke-access");
  const relinkStart = $api.useMutation("post", "/v1/admin/telegram/start");
  const relinkVerifyCode = $api.useMutation("post", "/v1/admin/telegram/verify-code");
  const relinkVerifyPassword = $api.useMutation("post", "/v1/admin/telegram/verify-password");
  const logout = $api.useMutation("post", "/v1/auth/cookie/logout");

  const formatDateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/admin/overview"] }),
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/admin/telegram"] }),
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/admin/users"] }),
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/admin/audit-events"] }),
    ]);
  };

  const handleBindCredentials = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!bindEmail.trim().includes("@") || bindPassword.length < 6) {
      toast.error(t("account.passwordMin"));
      return;
    }
    try {
      await setupCreds.mutateAsync({
        body: { email: bindEmail.trim().toLowerCase(), password: bindPassword },
      });
      setBindPassword("");
      toast.success(t("one.bindSuccess"));
      onRefreshAuth();
    } catch (error) {
      toast.error(userMessage(error));
    }
  };

  const handleCreateUser = async () => {
    const trimmedEmail = newEmail.trim().toLowerCase();
    if (!trimmedEmail.includes("@") || newPassword.length < 6) {
      toast.error("Valid email and password (min 6 chars) are required.");
      return;
    }
    let storageQuotaBytes: number | undefined;
    if (newQuotaGb.trim()) {
      const gb = Number(newQuotaGb.trim());
      if (!Number.isFinite(gb) || gb < 0) {
        toast.error(t("admin.quotaInvalid"));
        return;
      }
      storageQuotaBytes = Math.round(gb * 1024 * 1024 * 1024);
    }
    try {
      await createUser.mutateAsync({
        body: {
          email: trimmedEmail,
          displayName: newDisplayName.trim() || undefined,
          password: newPassword,
          role: newRole,
          storageQuotaBytes,
        },
      });
      setCreateOpen(false);
      setNewEmail("");
      setNewDisplayName("");
      setNewPassword("");
      setNewRole("user");
      setNewQuotaGb("");
      await refreshAll();
      toast.success(t("one.userCreated"));
    } catch (error) {
      toast.error(userMessage(error));
    }
  };

  const handleSaveEditUser = async () => {
    if (!editUserTarget) return;
    const body: components["schemas"]["UserAdminUpdateRequest"] = {};
    if (editEmail.trim() && editEmail.trim().toLowerCase() !== (editUserTarget.email ?? "")) {
      body.email = editEmail.trim().toLowerCase();
    }
    if (editName.trim() !== (editUserTarget.displayName ?? "")) {
      body.displayName = editName.trim();
    }
    if (editPassword) {
      if (editPassword.length < 6) {
        toast.error(t("account.passwordMin"));
        return;
      }
      body.password = editPassword;
    }
    if (Object.keys(body).length === 0) {
      setEditUserTarget(null);
      return;
    }
    try {
      await updateUser.mutateAsync({
        params: { path: { userId: editUserTarget.userId } },
        body,
      });
      setEditUserTarget(null);
      await refreshAll();
      toast.success(t("users.updated"));
    } catch (error) {
      toast.error(t("users.updateFailed"), { description: userMessage(error) });
    }
  };

  const handleUpdateUser = async (
    userId: number,
    body: components["schemas"]["UserAdminUpdateRequest"],
  ) => {
    try {
      await updateUser.mutateAsync({ params: { path: { userId } }, body });
      await refreshAll();
      toast.success(t("users.updated"));
    } catch (error) {
      toast.error(t("users.updateFailed"), { description: userMessage(error) });
    }
  };

  const handleSaveQuota = async (userId: number) => {
    const raw = (quotaInputs[userId] ?? "").trim();
    if (!raw) {
      await handleUpdateUser(userId, { clearStorageQuota: true });
      return;
    }
    const gb = Number(raw);
    if (!Number.isFinite(gb) || gb < 0) {
      toast.error(t("admin.quotaInvalid"));
      return;
    }
    await handleUpdateUser(userId, { storageQuotaBytes: Math.round(gb * 1024 * 1024 * 1024) });
  };

  const handleRelinkStep = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (relinkStep === "phone") {
        let normalized = relinkPhone.replace(/[\s().-]/g, "");
        if (/^[1-9][0-9]{7,14}$/.test(normalized)) normalized = `+${normalized}`;
        if (!/^\+[1-9][0-9]{7,14}$/.test(normalized)) {
          toast.error(t("login.phoneInvalid"));
          return;
        }
        const flow = await relinkStart.mutateAsync({
          params: { header: { "Idempotency-Key": newIdempotencyKey() } },
          body: { phoneNumber: normalized },
        });
        setRelinkPhone(normalized);
        setRelinkFlowId(flow.flowId);
        setRelinkStep("code");
        return;
      }
      if (!relinkFlowId) return;
      if (relinkStep === "code") {
        const res = await relinkVerifyCode.mutateAsync({
          params: { header: { "Idempotency-Key": newIdempotencyKey() } },
          body: { flowId: relinkFlowId, code: relinkCode.trim() },
        });
        if (res.passwordRequired) {
          setRelinkStep("password");
          return;
        }
        setRelinkStep("phone");
        setRelinkPhone("");
        setRelinkCode("");
        setRelinkFlowId(null);
        await refreshAll();
        toast.success("Workspace Telegram account updated");
        return;
      }
      await relinkVerifyPassword.mutateAsync({
        params: { header: { "Idempotency-Key": newIdempotencyKey() } },
        body: { flowId: relinkFlowId, password: relinkPassword },
      });
      setRelinkStep("phone");
      setRelinkPhone("");
      setRelinkCode("");
      setRelinkPassword("");
      setRelinkFlowId(null);
      await refreshAll();
      toast.success("Workspace Telegram account updated");
    } catch (error) {
      toast.error("Failed to link Telegram account", { description: userMessage(error) });
    }
  };

  const handleLogout = async () => {
    await logout.mutateAsync({});
    await clearDocumentCache().catch(() => {});
    queryClient.clear();
    await navigate({ to: "/login", search: { redirect: "/drive/files" }, replace: true });
  };

  const overview = overviewQuery.data;
  const tgStatus = tgStatusQuery.data;
  const segments: StorageSegment[] = overview
    ? [
        {
          id: "active",
          label: t("admin.metricStorage"),
          bytes: overview.totalActiveBytes,
          colorClass: "bg-[#1a73e8]",
          dotClass: "bg-[#1a73e8]",
        },
        {
          id: "trash",
          label: t("storage.trash"),
          bytes: overview.totalTrashBytes,
          colorClass: "bg-[#ea4335]",
          dotClass: "bg-[#ea4335]",
        },
      ]
    : [];
  const totalPoolBytes = overview ? overview.totalActiveBytes + overview.totalTrashBytes : 0;
  const relinkBusy =
    relinkStart.isPending || relinkVerifyCode.isPending || relinkVerifyPassword.isPending;

  const allUsers = usersQuery.data ?? [];
  const activeUsersCount = allUsers.filter((entry) => !entry.disabled).length;
  const disabledUsersCount = allUsers.filter((entry) => entry.disabled).length;
  const quotaLimitedCount = allUsers.filter((entry) => (entry.storageQuotaBytes ?? 0) > 0).length;
  const totalUserUsedBytes = allUsers.reduce((sum, entry) => sum + entry.storageUsedBytes, 0);

  const usersSortedByStorage = useMemo(
    () =>
      [...allUsers].sort((a, b) => b.storageUsedBytes - a.storageUsedBytes || a.userId - b.userId),
    [allUsers],
  );

  const userAllocationSegments: StorageSegment[] = useMemo(() => {
    const consumers = usersSortedByStorage.filter((entry) => entry.storageUsedBytes > 0);
    const top: StorageSegment[] = consumers.slice(0, USER_BAR_COLORS.length).map((entry, idx) => ({
      id: `user-${entry.userId}`,
      label: entry.displayName || entry.email || entry.username || `User #${entry.userId}`,
      bytes: entry.storageUsedBytes,
      colorClass: USER_BAR_COLORS[idx].colorClass,
      dotClass: USER_BAR_COLORS[idx].dotClass,
    }));
    const remainderBytes = consumers
      .slice(USER_BAR_COLORS.length)
      .reduce((sum, entry) => sum + entry.storageUsedBytes, 0);
    if (remainderBytes > 0) {
      top.push({
        id: "users-other",
        label: t("storage.cat.other"),
        bytes: remainderBytes,
        colorClass: "bg-muted/60",
        dotClass: "bg-muted/60",
      });
    }
    return top;
  }, [t, usersSortedByStorage]);

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = allUsers.filter((entry) => {
      if (userFilter === "admin" && entry.role !== "owner" && entry.role !== "admin") return false;
      if (userFilter === "member" && entry.role !== "user") return false;
      if (userFilter === "disabled" && !entry.disabled) return false;
      if (userFilter === "quota" && !(entry.storageQuotaBytes && entry.storageQuotaBytes > 0))
        return false;
      if (!q) return true;
      return (
        String(entry.userId).includes(q) ||
        (entry.displayName ?? "").toLowerCase().includes(q) ||
        (entry.email ?? "").toLowerCase().includes(q) ||
        (entry.username ?? "").toLowerCase().includes(q)
      );
    });
    return list.sort((a, b) => {
      if (userSort === "storage")
        return b.storageUsedBytes - a.storageUsedBytes || a.userId - b.userId;
      if (userSort === "files") return b.activeFiles - a.activeFiles || a.userId - b.userId;
      if (userSort === "newest")
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      const nameA = (a.displayName || a.email || a.username || `User ${a.userId}`).toLowerCase();
      const nameB = (b.displayName || b.email || b.username || `User ${b.userId}`).toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [allUsers, userFilter, userSearch, userSort]);

  return (
    <div className="min-h-dvh bg-[#f8fafd] px-4 py-6 dark:bg-[#131314] sm:px-6 lg:px-10">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-5">
          <div className="flex items-center gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-xs ring-1 ring-border/40">
              <GoogleOneBrandIcon className="size-6.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {t("one.consoleTitle")}
                </h1>
                <Chip size="sm" variant="soft" color="accent">
                  <ShieldIcon className="size-3" />
                  {me.role}
                </Chip>
              </div>
              <p className="text-xs text-muted sm:text-sm">{t("one.consoleSubtitle")}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <LinkButton
              to="/drive/files"
              search={{ path: "/", query: "", view: "list" }}
              variant="secondary"
              size="sm"
              className="rounded-full px-4"
            >
              {t("apps.openDrive")}
            </LinkButton>
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full px-4"
              onPress={() => void refreshAll()}
            >
              <RefreshIcon className="size-4" />
              {t("users.refresh")}
            </Button>
            <Button
              variant="danger-soft"
              size="sm"
              className="rounded-full px-4"
              onPress={() => void handleLogout()}
              isPending={logout.isPending}
            >
              <LogoutIcon className="size-4" />
              {t("account.logout")}
            </Button>
          </div>
        </header>

        {me.role === "owner" && !me.hasPassword ? (
          <Card className="gap-4 rounded-3xl border border-warning/40 bg-warning/10 p-5 sm:p-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("one.bindOwnerTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("one.bindOwnerDesc")}</p>
            </div>
            <form
              onSubmit={handleBindCredentials}
              className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <TextField>
                <Label>{t("login.emailLabel")}</Label>
                <Input
                  type="email"
                  value={bindEmail}
                  onChange={(e) => setBindEmail(e.currentTarget.value)}
                  placeholder="owner@workspace.local"
                />
              </TextField>
              <TextField>
                <Label>{t("login.passwordLabel")}</Label>
                <Input
                  type="password"
                  value={bindPassword}
                  onChange={(e) => setBindPassword(e.currentTarget.value)}
                  placeholder="Minimum 6 characters"
                />
              </TextField>
              <Button type="submit" variant="primary" isPending={setupCreds.isPending}>
                <KeyIcon className="size-4" />
                {t("one.bindSubmit")}
              </Button>
            </form>
          </Card>
        ) : null}

        <Tabs selectedKey={tab} onSelectionChange={(key) => onTabChange(normalizeTab(String(key)))}>
          <Tabs.ListContainer className="overflow-x-auto">
            <Tabs.List aria-label={t("one.consoleTitle")} className="flex w-max min-w-full gap-1">
              <Tabs.Tab id="overview">{t("one.tabOverview")}</Tabs.Tab>
              <Tabs.Tab id="users">{t("one.tabUsers")}</Tabs.Tab>
              <Tabs.Tab id="telegram">{t("one.tabTelegram")}</Tabs.Tab>
              <Tabs.Tab id="bots">{t("one.tabBots")}</Tabs.Tab>
              <Tabs.Tab id="jobs">{t("one.tabJobs")}</Tabs.Tab>
              <Tabs.Tab id="audit">{t("one.tabAudit")}</Tabs.Tab>
            </Tabs.List>
          </Tabs.ListContainer>

          <Tabs.Panel id="overview" className="pt-5">
            <div className="space-y-6">
              {overview ? (
                <Card className="gap-4 rounded-3xl border border-border/50 bg-surface p-5 sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                        {t("one.heroTitle")}
                      </p>
                      <p className="text-lg font-semibold tabular-nums tracking-tight sm:text-xl">
                        {t("one.heroUsed", {
                          bytes: formatBytes(overview.totalActiveBytes),
                          files: overview.totalActiveFiles,
                        })}
                      </p>
                    </div>
                    <Chip color={tgStatus?.linked ? "success" : "warning"} variant="tertiary">
                      {tgStatus?.linked
                        ? `${t("one.tgConnected")}${tgStatus.telegramUsername ? ` (@${tgStatus.telegramUsername})` : ""}`
                        : t("one.tgDisconnected")}
                    </Chip>
                  </div>
                  <GoogleOneSegmentedBar
                    segments={segments}
                    totalBytes={totalPoolBytes}
                    formatBytes={formatBytes}
                  />
                </Card>
              ) : null}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                  <p className="text-xs font-medium text-muted">{t("admin.metricUsers")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {overview ? overview.totalUsers : allUsers.length || "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {overview
                      ? t("admin.metricUsersDisabled", { count: overview.disabledUsers })
                      : ""}
                  </p>
                </Card>
                <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                  <p className="text-xs font-medium text-muted">{t("admin.metricStorage")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {overview ? formatBytes(overview.totalActiveBytes) : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {overview
                      ? t("admin.metricFilesCount", { count: overview.totalActiveFiles })
                      : ""}
                  </p>
                </Card>
                <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                  <p className="text-xs font-medium text-muted">{t("admin.metricChannels")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {overview ? `${overview.healthyChannels} / ${overview.totalChannels}` : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {overview ? t("admin.metricBotsCount", { count: overview.totalBots }) : ""}
                  </p>
                </Card>
                <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                  <p className="text-xs font-medium text-muted">{t("admin.metricShares")}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {overview ? overview.activeShares : "—"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {overview
                      ? t("admin.metricTrashBytes", {
                          bytes: formatBytes(overview.totalTrashBytes),
                        })
                      : ""}
                  </p>
                </Card>
              </div>

              {/* Per-user Storage Allocation Overview */}
              <Card className="gap-4 rounded-3xl border border-border/50 bg-surface p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {t("one.usersOverviewTitle")}
                    </h2>
                    <p className="text-xs text-muted sm:text-sm">{t("one.usersOverviewDesc")}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="rounded-full"
                    onPress={() => onTabChange("users")}
                  >
                    {t("one.manageUsers")}
                  </Button>
                </div>

                {userAllocationSegments.length > 0 ? (
                  <GoogleOneSegmentedBar
                    segments={userAllocationSegments}
                    totalBytes={Math.max(1, totalUserUsedBytes)}
                    formatBytes={formatBytes}
                  />
                ) : null}

                <div className="divide-y divide-border/50 overflow-hidden rounded-2xl border border-border/50">
                  {usersQuery.isPending ? (
                    <div className="flex justify-center p-6">
                      <Spinner />
                    </div>
                  ) : usersSortedByStorage.length === 0 ? (
                    <p className="p-6 text-sm text-muted">{t("users.empty")}</p>
                  ) : (
                    usersSortedByStorage.slice(0, 12).map((entry) => {
                      const nameLabel =
                        entry.displayName ||
                        entry.email ||
                        entry.username ||
                        `User #${entry.userId}`;
                      const usedPct =
                        entry.storageQuotaBytes && entry.storageQuotaBytes > 0
                          ? Math.min(
                              100,
                              Math.round((entry.storageUsedBytes / entry.storageQuotaBytes) * 100),
                            )
                          : null;
                      return (
                        <div
                          key={entry.userId}
                          className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {nameLabel}
                              </span>
                              <Chip
                                size="sm"
                                variant="tertiary"
                                color={
                                  entry.role === "owner"
                                    ? "accent"
                                    : entry.role === "admin"
                                      ? "warning"
                                      : "default"
                                }
                              >
                                {entry.role}
                              </Chip>
                              {entry.disabled ? (
                                <Chip size="sm" variant="tertiary" color="danger">
                                  {t("users.disabled")}
                                </Chip>
                              ) : null}
                            </div>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {[
                                entry.email,
                                entry.username ? `@${entry.username}` : null,
                                `#${entry.userId}`,
                                t("admin.metricFilesCount", { count: entry.activeFiles }),
                                entry.trashBytes > 0
                                  ? t("admin.metricTrashBytes", {
                                      bytes: formatBytes(entry.trashBytes),
                                    })
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          </div>

                          <div className="min-w-44 space-y-1 text-left sm:text-right">
                            <p className="text-xs font-medium tabular-nums text-foreground">
                              {entry.storageQuotaBytes !== undefined && entry.storageQuotaBytes > 0
                                ? `${formatBytes(entry.storageUsedBytes)} / ${formatBytes(entry.storageQuotaBytes)} (${usedPct}%)`
                                : `${formatBytes(entry.storageUsedBytes)} • ${t("admin.quotaUnlimited")}`}
                            </p>
                            {usedPct !== null ? (
                              <div className="h-1.5 w-full overflow-hidden rounded-full bg-default/35">
                                <div
                                  className={
                                    usedPct >= 95
                                      ? "h-full rounded-full bg-danger"
                                      : usedPct >= 80
                                        ? "h-full rounded-full bg-warning"
                                        : "h-full rounded-full bg-accent"
                                  }
                                  style={{ width: `${usedPct}%` }}
                                />
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            </div>
          </Tabs.Panel>

          <Tabs.Panel id="users" className="space-y-5 pt-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                <p className="text-xs font-medium text-muted">{t("one.usersRegistered")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{allUsers.length}</p>
                <p className="mt-1 text-xs text-muted">
                  {t("one.usersActiveDisabled", {
                    active: activeUsersCount,
                    disabled: disabledUsersCount,
                  })}
                </p>
              </Card>
              <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                <p className="text-xs font-medium text-muted">{t("one.usersTotalStorage")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatBytes(totalUserUsedBytes)}
                </p>
                <p className="mt-1 text-xs text-muted">{t("one.usersAcrossAccounts")}</p>
              </Card>
              <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                <p className="text-xs font-medium text-muted">{t("one.usersQuotaLimited")}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{quotaLimitedCount}</p>
                <p className="mt-1 text-xs text-muted">
                  {t("one.usersUnlimitedCount", {
                    count: Math.max(0, allUsers.length - quotaLimitedCount),
                  })}
                </p>
              </Card>
              <Card className="rounded-2xl border border-border/50 bg-surface p-4">
                <p className="text-xs font-medium text-muted">
                  {t("admin.metricFilesCount", { count: overview?.totalActiveFiles ?? 0 })}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">
                  {formatBytes(overview?.totalActiveBytes ?? 0)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {t("admin.metricTrashBytes", {
                    bytes: formatBytes(overview?.totalTrashBytes ?? 0),
                  })}
                </p>
              </Card>
            </div>

            <SettingsSection
              title={t("admin.usersTitle")}
              description={t("admin.usersDesc")}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.currentTarget.value)}
                    placeholder={t("users.search")}
                    className="w-56"
                  />
                  <Button variant="primary" size="sm" onPress={() => setCreateOpen(true)}>
                    <PlusIcon className="size-4" />
                    {t("one.createUser")}
                  </Button>
                </div>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-5 py-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      ["all", t("drive.filterAll")],
                      ["admin", t("one.filterAdmins")],
                      ["member", t("one.filterMembers")],
                      ["disabled", t("users.disabled")],
                      ["quota", t("one.filterQuota")],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={userFilter === key ? "primary" : "tertiary"}
                      className="h-7 rounded-full px-3 text-xs"
                      onPress={() => setUserFilter(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">{t("one.sortLabel")}</span>
                  {(
                    [
                      ["storage", t("one.sortStorage")],
                      ["files", t("one.sortFiles")],
                      ["newest", t("one.sortNewest")],
                      ["name", t("manager.sortName")],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      size="sm"
                      variant={userSort === key ? "secondary" : "ghost"}
                      className="h-7 rounded-full px-2.5 text-xs"
                      onPress={() => setUserSort(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>

              {usersQuery.isPending ? (
                <div className="flex justify-center p-8">
                  <Spinner />
                </div>
              ) : filteredUsers.length === 0 ? (
                <p className="p-6 text-sm text-muted">{t("users.empty")}</p>
              ) : (
                filteredUsers.map((entry) => {
                  const defaultGb =
                    entry.storageQuotaBytes !== undefined && entry.storageQuotaBytes > 0
                      ? String(
                          Math.round((entry.storageQuotaBytes / (1024 * 1024 * 1024)) * 100) / 100,
                        )
                      : "";
                  const quotaInputValue = quotaInputs[entry.userId] ?? defaultGb;
                  const usedPct =
                    entry.storageQuotaBytes && entry.storageQuotaBytes > 0
                      ? Math.min(
                          100,
                          Math.round((entry.storageUsedBytes / entry.storageQuotaBytes) * 100),
                        )
                      : null;
                  const nameLabel =
                    entry.displayName || entry.email || entry.username || `User ${entry.userId}`;
                  const identityDesc = [
                    entry.email,
                    entry.username ? `@${entry.username}` : null,
                    `#${entry.userId}`,
                    t("one.joinedOn", { date: formatDateTime.format(new Date(entry.createdAt)) }),
                  ]
                    .filter(Boolean)
                    .join(" • ");

                  return (
                    <SettingsRow key={entry.userId} label={nameLabel} description={identityDesc}>
                      <div className="space-y-3">
                        <div className="rounded-xl border border-border/50 bg-surface-secondary/50 px-3 py-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold tabular-nums text-foreground">
                              {entry.storageQuotaBytes !== undefined && entry.storageQuotaBytes > 0
                                ? `${formatBytes(entry.storageUsedBytes)} / ${formatBytes(entry.storageQuotaBytes)}${usedPct !== null ? ` (${usedPct}%)` : ""}`
                                : `${formatBytes(entry.storageUsedBytes)} • ${t("admin.quotaUnlimited")}`}
                            </span>
                            <span className="tabular-nums text-muted">
                              {t("one.userStorageBreakdown", {
                                files: entry.activeFiles,
                                active: formatBytes(entry.activeBytes),
                                trash: formatBytes(entry.trashBytes),
                              })}
                            </span>
                          </div>
                          {usedPct !== null ? (
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-default/35">
                              <div
                                className={
                                  usedPct >= 95
                                    ? "h-full rounded-full bg-danger"
                                    : usedPct >= 80
                                      ? "h-full rounded-full bg-warning"
                                      : "h-full rounded-full bg-accent"
                                }
                                style={{ width: `${usedPct}%` }}
                              />
                            </div>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <Chip
                            size="sm"
                            variant="tertiary"
                            color={
                              entry.role === "owner"
                                ? "accent"
                                : entry.role === "admin"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {entry.role}
                          </Chip>
                          <Chip
                            size="sm"
                            variant="tertiary"
                            color={entry.hasPassword ? "success" : "default"}
                          >
                            {entry.hasPassword ? t("one.authPassword") : t("one.authTelegram")}
                          </Chip>
                          {entry.disabled ? (
                            <Chip size="sm" variant="tertiary" color="danger">
                              {t("users.disabled")}
                            </Chip>
                          ) : null}

                          <Input
                            type="number"
                            min={0}
                            step="0.5"
                            placeholder={t("admin.quotaGbPlaceholder")}
                            value={quotaInputValue}
                            onChange={(e) =>
                              setQuotaInputs((prev) => ({
                                ...prev,
                                [entry.userId]: e.target.value,
                              }))
                            }
                            className="w-24 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={updateUser.isPending}
                            onPress={() => void handleSaveQuota(entry.userId)}
                          >
                            {t("admin.saveQuota")}
                          </Button>

                          <Button
                            size="sm"
                            variant="tertiary"
                            onPress={() => {
                              setEditUserTarget(entry);
                              setEditEmail(entry.email ?? "");
                              setEditName(entry.displayName ?? "");
                              setEditPassword("");
                            }}
                          >
                            {t("one.editUserBtn")}
                          </Button>

                          {entry.role !== "owner" && entry.userId !== me.userId ? (
                            <>
                              <Button
                                size="sm"
                                variant="tertiary"
                                isDisabled={updateUser.isPending}
                                onPress={() =>
                                  void handleUpdateUser(entry.userId, {
                                    role: entry.role === "admin" ? "user" : "admin",
                                  })
                                }
                              >
                                {entry.role === "admin"
                                  ? t("users.makeUser")
                                  : t("users.makeAdmin")}
                              </Button>
                              <Button
                                size="sm"
                                variant={entry.disabled ? "secondary" : "danger-soft"}
                                isDisabled={updateUser.isPending}
                                onPress={() =>
                                  void handleUpdateUser(entry.userId, { disabled: !entry.disabled })
                                }
                              >
                                {entry.disabled ? t("users.enable") : t("users.disable")}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                isDisabled={revokeAccess.isPending}
                                onPress={async () => {
                                  await revokeAccess.mutateAsync({
                                    params: { path: { userId: entry.userId } },
                                  });
                                  await refreshAll();
                                  toast.success(t("users.revoked"));
                                }}
                              >
                                {t("users.revoke")}
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </SettingsRow>
                  );
                })
              )}
            </SettingsSection>
          </Tabs.Panel>

          <Tabs.Panel id="telegram" className="space-y-6 pt-5">
            <SettingsSection title={t("one.tgRelinkTitle")} description={t("one.tgRelinkDesc")}>
              <SettingsRow
                label="Workspace Telegram Session"
                description={
                  tgStatus?.linked
                    ? `Telegram ID: ${tgStatus.telegramUserId ?? "—"}${tgStatus.telegramUsername ? ` (@${tgStatus.telegramUsername})` : ""}`
                    : "Not connected yet"
                }
              >
                <div className="flex justify-end">
                  <Chip color={tgStatus?.linked ? "success" : "warning"} variant="tertiary">
                    {tgStatus?.linked ? t("one.tgConnected") : t("one.tgDisconnected")}
                  </Chip>
                </div>
              </SettingsRow>
              <div className="p-5">
                <form onSubmit={handleRelinkStep} className="flex flex-wrap items-end gap-3">
                  {relinkStep === "phone" ? (
                    <TextField className="min-w-64 flex-1" isDisabled={relinkBusy}>
                      <Label>New Telegram Phone Number</Label>
                      <Input
                        type="tel"
                        value={relinkPhone}
                        onChange={(e) => setRelinkPhone(e.currentTarget.value)}
                        placeholder="+6281234567890"
                      />
                    </TextField>
                  ) : relinkStep === "code" ? (
                    <TextField className="min-w-64 flex-1" isDisabled={relinkBusy}>
                      <Label>Verification Code sent to {relinkPhone}</Label>
                      <Input
                        value={relinkCode}
                        onChange={(e) => setRelinkCode(e.currentTarget.value)}
                        placeholder="12345"
                      />
                    </TextField>
                  ) : (
                    <TextField className="min-w-64 flex-1" isDisabled={relinkBusy}>
                      <Label>Telegram 2FA Password</Label>
                      <Input
                        type="password"
                        value={relinkPassword}
                        onChange={(e) => setRelinkPassword(e.currentTarget.value)}
                        placeholder="••••••••"
                      />
                    </TextField>
                  )}
                  <Button type="submit" variant="primary" isPending={relinkBusy}>
                    {relinkStep === "phone"
                      ? "Send Code"
                      : relinkStep === "code"
                        ? "Verify Code"
                        : "Confirm 2FA Password"}
                  </Button>
                  {relinkStep !== "phone" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onPress={() => {
                        setRelinkStep("phone");
                        setRelinkFlowId(null);
                        setRelinkCode("");
                        setRelinkPassword("");
                      }}
                    >
                      {t("dialog.cancel")}
                    </Button>
                  ) : null}
                </form>
              </div>
            </SettingsSection>

            <Suspense
              fallback={
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              }
            >
              <ChannelsPanel />
            </Suspense>
          </Tabs.Panel>

          <Tabs.Panel id="bots" className="pt-5">
            <Suspense
              fallback={
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              }
            >
              <BotsPanel />
            </Suspense>
          </Tabs.Panel>

          <Tabs.Panel id="jobs" className="pt-5">
            <Suspense
              fallback={
                <div className="flex justify-center py-12">
                  <Spinner size="lg" />
                </div>
              }
            >
              <PeriodicJobsPanel />
            </Suspense>
          </Tabs.Panel>

          <Tabs.Panel id="audit" className="pt-5">
            <SettingsSection
              title={t("admin.auditTitle")}
              description={t("admin.auditDesc")}
              actions={
                <Input
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.currentTarget.value)}
                  placeholder={t("admin.auditFilterPlaceholder")}
                  className="w-56"
                />
              }
            >
              {auditQuery.isPending ? (
                <div className="flex justify-center p-8">
                  <Spinner />
                </div>
              ) : (auditQuery.data?.items ?? []).length === 0 ? (
                <p className="p-6 text-sm text-muted">{t("admin.auditEmpty")}</p>
              ) : (
                (auditQuery.data?.items ?? []).map((ev) => (
                  <SettingsRow
                    key={ev.id}
                    label={ev.action}
                    description={`${ev.resourceType}${ev.resourceId ? ` (${ev.resourceId})` : ""} • ${ev.displayName || (ev.username ? `@${ev.username}` : ev.userId ? `User ${ev.userId}` : "System")}`}
                  >
                    <p className="text-right text-xs text-muted">
                      {formatDateTime.format(new Date(ev.createdAt))}
                    </p>
                  </SettingsRow>
                ))
              )}
            </SettingsSection>
          </Tabs.Panel>
        </Tabs>
      </div>

      <AppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title={t("one.createUserTitle")}
        description={t("one.createUserDesc")}
        footer={
          <>
            <Button variant="tertiary" onPress={() => setCreateOpen(false)}>
              {t("dialog.cancel")}
            </Button>
            <Button isPending={createUser.isPending} onPress={() => void handleCreateUser()}>
              {t("one.createUser")}
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <TextField>
            <Label>{t("login.emailLabel")}</Label>
            <Input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.currentTarget.value)}
              placeholder="member@workspace.local"
            />
          </TextField>
          <TextField>
            <Label>Display Name</Label>
            <Input
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.currentTarget.value)}
              placeholder="Alex Rivera"
            />
          </TextField>
          <TextField>
            <Label>{t("login.passwordLabel")}</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.currentTarget.value)}
              placeholder="Minimum 6 characters"
            />
          </TextField>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={newRole === "user" ? "primary" : "tertiary"}
                  onPress={() => setNewRole("user")}
                >
                  User
                </Button>
                <Button
                  size="sm"
                  variant={newRole === "admin" ? "primary" : "tertiary"}
                  onPress={() => setNewRole("admin")}
                >
                  Admin
                </Button>
              </div>
            </div>
            <TextField>
              <Label>Storage Quota (GB)</Label>
              <Input
                type="number"
                min={0}
                step="1"
                value={newQuotaGb}
                onChange={(e) => setNewQuotaGb(e.currentTarget.value)}
                placeholder="Unlimited"
              />
            </TextField>
          </div>
        </div>
      </AppDialog>

      <AppDialog
        open={editUserTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditUserTarget(null);
        }}
        title={`Edit ${editUserTarget?.displayName || editUserTarget?.email || "User"}`}
        description="Update email, display name, or set a new password."
        footer={
          <>
            <Button variant="tertiary" onPress={() => setEditUserTarget(null)}>
              {t("dialog.cancel")}
            </Button>
            <Button isPending={updateUser.isPending} onPress={() => void handleSaveEditUser()}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="grid gap-3">
          <TextField>
            <Label>{t("login.emailLabel")}</Label>
            <Input
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.currentTarget.value)}
            />
          </TextField>
          <TextField>
            <Label>Display Name</Label>
            <Input value={editName} onChange={(e) => setEditName(e.currentTarget.value)} />
          </TextField>
          <TextField>
            <Label>{t("one.resetPassword")} (optional)</Label>
            <Input
              type="password"
              value={editPassword}
              onChange={(e) => setEditPassword(e.currentTarget.value)}
              placeholder="Leave blank to keep existing password"
            />
          </TextField>
        </div>
      </AppDialog>
    </div>
  );
}
