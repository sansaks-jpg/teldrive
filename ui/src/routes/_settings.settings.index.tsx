import { Button, Input, Label, Spinner, TextField } from "@heroui/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { $api } from "@/api/client";
import { userMessage } from "@/api/errors";
import { currentUserQueryOptions } from "@/auth/queries";
import { useCurrentUser } from "@/auth/use-current-user";
import { SettingsPageHeader, SettingsRow, SettingsSection } from "@/components/settings-layout";
import { clearDocumentCache } from "@/features/files/document-cache";
import { useCountFormatter, useDateTimeFormatter, useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";
import LogoutIcon from "~icons/gravity-ui/arrow-right-from-square";

export const Route = createFileRoute("/_settings/settings/")({
  component: AccountSettings,
  pendingComponent: () => (
    <div className="flex justify-center py-16">
      <Spinner size="lg" />
    </div>
  ),
});

function AccountSettings() {
  const navigate = useNavigate();
  const { t } = useAppLocale();
  const formatBytes = useFormatBytes();
  const formatCount = useCountFormatter();
  const formatDateTime = useDateTimeFormatter();
  const user = useCurrentUser();
  const stats = $api.useSuspenseQuery(
    "get",
    "/v1/files/statistics/drive",
    {},
    { staleTime: 30_000 },
  );
  const logout = $api.useMutation("post", "/v1/auth/cookie/logout");
  const changePassword = $api.useMutation("post", "/v1/me/password");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const logOut = async () => {
    try {
      await logout.mutateAsync({});
      await clearDocumentCache().catch(() => {});
      getQueryClient().clear();
      await navigate({ to: "/login", search: { redirect: "/drive/files" }, replace: true });
    } catch (error) {
      toast.error(t("account.logoutFailed"), { description: userMessage(error) });
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || newPassword.length < 6) {
      toast.error(t("account.passwordMin"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("account.passwordMismatch"));
      return;
    }
    try {
      await changePassword.mutateAsync({ body: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      await getQueryClient().invalidateQueries({ queryKey: currentUserQueryOptions().queryKey });
      toast.success(t("account.passwordChanged"));
    } catch (error) {
      toast.error(t("account.passwordFailed"), { description: userMessage(error) });
    }
  };

  const displayName =
    user.data.displayName ||
    user.data.email ||
    user.data.username ||
    t("account.userFallback", { id: user.data.userId });

  const secondaryText = user.data.email
    ? user.data.email
    : user.data.username
      ? `@${user.data.username}`
      : t("account.userFallback", { id: user.data.userId });

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title={t("account.title")}
        description={t("account.desc")}
        actions={
          <Button variant="danger" onPress={logOut} isDisabled={logout.isPending}>
            <LogoutIcon className="size-4" />
            {t("account.logout")}
          </Button>
        }
      />
      <SettingsSection title={t("account.profile")} description={t("account.profileDesc")}>
        <SettingsRow label={displayName} description={secondaryText}>
          <p className="text-right text-sm text-muted">
            {user.data.email || (user.data.username ? `@${user.data.username}` : "—")}
          </p>
        </SettingsRow>
        <SettingsRow label={t("account.created")} description={t("account.createdDesc")}>
          <p className="text-right text-sm text-muted">
            {formatDateTime.format(new Date(user.data.createdAt))}
          </p>
        </SettingsRow>
      </SettingsSection>

      {user.data.hasPassword ? (
        <SettingsSection title={t("account.passwordTitle")} description={t("account.passwordDesc")}>
          <SettingsRow label={t("account.currentPassword")}>
            <TextField>
              <Label className="sr-only">{t("account.currentPassword")}</Label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.currentTarget.value)}
                autoComplete="current-password"
              />
            </TextField>
          </SettingsRow>
          <SettingsRow label={t("account.newPassword")} description={t("account.passwordMin")}>
            <TextField>
              <Label className="sr-only">{t("account.newPassword")}</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.currentTarget.value)}
                autoComplete="new-password"
              />
            </TextField>
          </SettingsRow>
          <SettingsRow label={t("account.confirmPassword")}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <TextField className="flex-1">
                <Label className="sr-only">{t("account.confirmPassword")}</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                  autoComplete="new-password"
                />
              </TextField>
              <Button
                variant="primary"
                isPending={changePassword.isPending}
                onPress={handlePasswordChange}
              >
                {t("account.updatePassword")}
              </Button>
            </div>
          </SettingsRow>
        </SettingsSection>
      ) : null}

      <SettingsSection title={t("account.stats")} description={t("account.statsDesc")}>
        <SettingsRow label={t("account.files")}>
          <p className="text-right font-mono text-sm">
            {formatCount.format(stats.data.totalFiles)}
          </p>
        </SettingsRow>
        <SettingsRow label={t("account.stored")}>
          <p className="text-right font-mono text-sm">
            {user.data.storageQuotaBytes != null
              ? `${formatBytes(stats.data.totalBytes)} / ${formatBytes(user.data.storageQuotaBytes)}`
              : formatBytes(stats.data.totalBytes)}
          </p>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
