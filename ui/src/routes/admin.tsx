import { Button, Card, Chip, Input, Label, Spinner, TextField } from "@heroui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { $api } from "@/api/client";
import { userMessage } from "@/api/errors";
import { currentUserQueryOptions } from "@/auth/queries";
import { SettingsRow, SettingsSection } from "@/components/settings-layout";
import { formatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import RefreshIcon from "~icons/gravity-ui/arrow-rotate-left";

export const Route = createFileRoute("/admin")({
  beforeLoad: async ({ context }) => {
    const user = await context.queryClient.ensureQueryData(currentUserQueryOptions());
    if (!user.capabilities.includes("system.manageUsers")) {
      throw redirect({ to: "/files" });
    }
  },
  component: AdminConsole,
});

function AdminConsole() {
  const { t, locale } = useAppLocale();
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("admin.title")}</h1>
          <p className="text-sm text-muted">{t("admin.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/tasks">
            <Button variant="secondary">{t("nav.tasks")}</Button>
          </Link>
          <Link to="/settings">
            <Button variant="secondary">{t("nav.settings")}</Button>
          </Link>
          <Button variant="primary" onPress={() => void refreshAll()}>
            <RefreshIcon className="size-4" />
            {t("users.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricUsers")}</p>
          <p className="mt-1 text-2xl font-semibold">
            {overview ? overview.totalUsers : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview
              ? t("admin.metricUsersDisabled", { count: overview.disabledUsers })
              : ""}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricStorage")}</p>
          <p className="mt-1 text-2xl font-semibold">
            {overview ? formatBytes(overview.totalActiveBytes) : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview
              ? t("admin.metricFilesCount", { count: overview.totalActiveFiles })
              : ""}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricChannels")}</p>
          <p className="mt-1 text-2xl font-semibold">
            {overview ? `${overview.healthyChannels}/${overview.totalChannels}` : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview ? t("admin.metricBotsCount", { count: overview.totalBots }) : ""}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-muted">{t("admin.metricShares")}</p>
          <p className="mt-1 text-2xl font-semibold">
            {overview ? overview.activeShares : "—"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overview ? formatBytes(overview.totalTrashBytes) : ""}
          </p>
        </Card>
      </div>

      <SettingsSection title={t("users.users")} description={t("admin.usersDesc")}>
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
            return (
              <SettingsRow
                key={user.userId}
                label={displayName}
                description={`${user.username ? `@${user.username} · ` : ""}${formatBytes(user.storageUsedBytes)} ${user.storageQuotaBytes !== undefined ? `/ ${formatBytes(user.storageQuotaBytes)}` : `· ${t("admin.quotaUnlimited")}`}`}
              >
                <div className="flex flex-wrap items-center justify-end gap-2">
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
                        {user.role === "admin" ? t("users.demote") : t("users.promote")}
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
