import { Button, Card, Chip, Input, Label, Spinner, TextField } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { $api } from "@/api/client";
import { userMessage } from "@/api/errors";
import { currentUserQueryOptions } from "@/auth/queries";
import {
  GoogleOneBrandIcon,
  GoogleOneSegmentedBar,
  type StorageSegment,
} from "@/components/google-workspace";
import { LinkButton } from "@/components/link-button";
import { SettingsRow, SettingsSection } from "@/components/settings-layout";
import { useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import RefreshIcon from "~icons/gravity-ui/arrow-rotate-left";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions());
    if (!user.capabilities.includes("system.manageUsers")) {
      throw redirect({ to: "/files", search: { path: "/", query: "", view: "list" } });
    }
  },
  component: AdminConsole,
});

function AdminConsole() {
  const { t, locale } = useAppLocale();
  const formatBytes = useFormatBytes();
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [quotaInputs, setQuotaInputs] = useState<Record<number, string>>({});
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const debouncedAction = useDebouncedValue(actionFilter.trim(), 300);
  const queryClient = getQueryClient();

  const { data: currentUser } = useQuery(currentUserQueryOptions());
  const overviewQuery = $api.useQuery("get", "/v1/admin/overview", {}, { staleTime: 10_000 });
  const usersQuery = $api.useQuery(
    "get",
    "/v1/admin/users",
    { params: { query: { search: debouncedSearch || undefined } } },
    { staleTime: 10_000, placeholderData: keepPreviousData },
  );
  const auditQuery = $api.useQuery(
    "get",
    "/v1/admin/audit-events",
    { params: { query: { action: debouncedAction || undefined, limit: 25 } } },
    { staleTime: 10_000, placeholderData: keepPreviousData },
  );

  const updateUser = $api.useMutation("patch", "/v1/admin/users/{userId}");
  const revokeAccess = $api.useMutation("post", "/v1/admin/users/{userId}/revoke-access");

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
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/admin/users"] }),
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/admin/audit-events"] }),
    ]);
  };

  const handleUpdateUser = async (
    userId: number,
    body: {
      role?: "admin" | "user";
      disabled?: boolean;
      storageQuotaBytes?: number;
      clearStorageQuota?: boolean;
    },
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
    const bytes = Math.round(gb * 1024 * 1024 * 1024);
    await handleUpdateUser(userId, { storageQuotaBytes: bytes });
  };

  const overview = overviewQuery.data;
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-16 sm:p-4 sm:pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-surface-secondary shadow-xs ring-1 ring-border/40">
            <GoogleOneBrandIcon className="size-6.5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("admin.title")}</h1>
            <p className="text-xs text-muted sm:text-sm">{t("admin.subtitle")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LinkButton to="/storage" variant="secondary" size="sm" className="rounded-full px-4">
            {t("nav.storage")}
          </LinkButton>
          <LinkButton
            to="/tasks"
            search={{ status: "running", query: "" }}
            variant="secondary"
            size="sm"
            className="rounded-full px-4"
          >
            {t("nav.tasks")}
          </LinkButton>
          <LinkButton to="/settings" variant="secondary" size="sm" className="rounded-full px-4">
            {t("title.settings")}
          </LinkButton>
          <Button
            variant="primary"
            size="sm"
            className="rounded-full px-4"
            onPress={() => void refreshAll()}
          >
            <RefreshIcon className="size-4" />
            {t("users.refresh")}
          </Button>
        </div>
      </div>

      {overview ? (
        <Card className="gap-4 rounded-3xl border border-border/50 bg-surface-secondary/35 p-5 sm:p-6">
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
            {overview.totalTrashBytes > 0 ? (
              <LinkButton to="/trash" size="sm" variant="secondary" className="rounded-full px-4">
                {t("one.trashReclaim", { bytes: formatBytes(overview.totalTrashBytes) })}
              </LinkButton>
            ) : null}
          </div>
          <GoogleOneSegmentedBar
            segments={segments}
            totalBytes={totalPoolBytes}
            formatBytes={formatBytes}
          />
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <Card className="rounded-2xl border border-border/50 bg-surface-secondary/25 p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricUsers")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {overview ? overview.totalUsers : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview ? t("admin.metricUsersDisabled", { count: overview.disabledUsers }) : ""}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border/50 bg-surface-secondary/25 p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricStorage")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {overview ? formatBytes(overview.totalActiveBytes) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview ? t("admin.metricFilesCount", { count: overview.totalActiveFiles }) : ""}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border/50 bg-surface-secondary/25 p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricChannels")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {overview ? `${overview.healthyChannels}/${overview.totalChannels}` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview ? t("admin.metricBotsCount", { count: overview.totalBots }) : ""}
          </p>
        </Card>
        <Card className="rounded-2xl border border-border/50 bg-surface-secondary/25 p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricShares")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {overview ? overview.activeShares : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview ? formatBytes(overview.totalTrashBytes) : ""}
          </p>
        </Card>
      </div>

      <SettingsSection title={t("one.familyTitle")} description={t("admin.usersDesc")}>
        <div className="border-b border-border p-4">
          <TextField value={search} onChange={setSearch} className="max-w-md">
            <Label>{t("users.search")}</Label>
            <Input placeholder={t("users.searchPh")} />
          </TextField>
        </div>
        {usersQuery.isPending ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : usersQuery.data?.length ? (
          usersQuery.data.map((user) => {
            const displayName =
              user.displayName?.trim() ||
              user.username?.trim() ||
              t("account.userFallback", { id: user.userId });
            const owner = user.role === "owner";
            const isSelf = currentUser?.userId === user.userId;
            const quotaValue =
              quotaInputs[user.userId] ??
              (user.storageQuotaBytes !== undefined
                ? String(Math.round((user.storageQuotaBytes / (1024 * 1024 * 1024)) * 100) / 100)
                : "");
            const quotaPct =
              user.storageQuotaBytes && user.storageQuotaBytes > 0
                ? Math.min(100, Math.round((user.storageUsedBytes / user.storageQuotaBytes) * 100))
                : 0;
            return (
              <SettingsRow
                key={user.userId}
                label={displayName}
                description={`${user.username ? `@${user.username} · ` : ""}${formatBytes(user.storageUsedBytes)} ${user.storageQuotaBytes !== undefined ? `/ ${formatBytes(user.storageQuotaBytes)}` : `· ${t("admin.quotaUnlimited")}`}`}
              >
                <div className="flex flex-col gap-2 sm:items-end">
                  {user.storageQuotaBytes !== undefined ? (
                    <div className="h-1.5 w-44 max-w-full overflow-hidden rounded-full bg-default/40">
                      <div
                        className={`h-full rounded-full transition-[width] ${quotaPct >= 90 ? "bg-danger" : "bg-accent"}`}
                        style={{ width: `${Math.max(4, quotaPct)}%` }}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                    <Chip
                      variant="tertiary"
                      color={owner ? "accent" : user.role === "admin" ? "warning" : "default"}
                    >
                      {user.role}
                    </Chip>
                    {user.disabled ? (
                      <Chip variant="tertiary" color="danger">
                        {t("users.disabled")}
                      </Chip>
                    ) : null}
                    <div className="flex items-center gap-1.5">
                      <Input
                        aria-label={t("admin.quotaGbLabel")}
                        className="w-24"
                        placeholder="GB"
                        value={quotaValue}
                        onChange={(event) =>
                          setQuotaInputs((prev) => ({
                            ...prev,
                            [user.userId]: event.target.value,
                          }))
                        }
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        isDisabled={updateUser.isPending}
                        onPress={() => void handleSaveQuota(user.userId)}
                      >
                        {t("admin.saveQuota")}
                      </Button>
                    </div>
                    {!owner && !isSelf ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={updateUser.isPending}
                          onPress={() =>
                            void handleUpdateUser(user.userId, {
                              role: user.role === "admin" ? "user" : "admin",
                            })
                          }
                        >
                          {t(user.role === "admin" ? "users.makeUser" : "users.makeAdmin")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          isDisabled={updateUser.isPending}
                          onPress={() =>
                            void handleUpdateUser(user.userId, { disabled: !user.disabled })
                          }
                        >
                          {user.disabled ? t("users.enable") : t("users.disable")}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          isDisabled={revokeAccess.isPending}
                          onPress={() =>
                            void revokeAccess
                              .mutateAsync({ params: { path: { userId: user.userId } } })
                              .then(() => {
                                toast.success(t("users.revoked"));
                                return refreshAll();
                              })
                              .catch((error) =>
                                toast.error(t("users.revokeFailed"), {
                                  description: userMessage(error),
                                }),
                              )
                          }
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
        ) : (
          <p className="p-6 text-center text-sm text-muted">{t("users.empty")}</p>
        )}
      </SettingsSection>

      <SettingsSection title={t("admin.auditTitle")} description={t("admin.auditDesc")}>
        <div className="border-b border-border p-4">
          <TextField value={actionFilter} onChange={setActionFilter} className="max-w-md">
            <Label>{t("admin.auditFilter")}</Label>
            <Input placeholder="admin.user.updated / file.version" />
          </TextField>
        </div>
        {auditQuery.isPending ? (
          <div className="flex justify-center p-6">
            <Spinner />
          </div>
        ) : auditQuery.data?.items.length ? (
          auditQuery.data.items.map((event) => (
            <SettingsRow
              key={event.id}
              label={event.action}
              description={`${event.username ? `@${event.username} · ` : ""}${event.resourceType}${event.resourceId ? ` (${event.resourceId})` : ""}`}
            >
              <span className="text-xs text-muted">
                {formatDateTime.format(new Date(event.createdAt))}
              </span>
            </SettingsRow>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-muted">{t("admin.auditEmpty")}</p>
        )}
      </SettingsSection>
    </div>
  );
}
