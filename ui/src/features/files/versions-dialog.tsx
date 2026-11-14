import { Button, Chip, Spinner } from "@heroui/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { $api } from "@/api/client";
import { userMessage } from "@/api/errors";
import type { FileEntry } from "@/api/types";
import { AppDialog } from "@/components/dialogs/app-dialog";
import { useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";

export function VersionsDialog({
  file,
  onOpenChange,
}: {
  file?: FileEntry;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useAppLocale();
  const formatBytes = useFormatBytes();
  const [restoringId, setRestoringId] = useState<string>();
  const queryClient = getQueryClient();

  const formatDateTime = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const versionsQuery = $api.useQuery(
    "get",
    "/v1/files/{fileId}/versions",
    { params: { path: { fileId: file?.id ?? "" } } },
    { enabled: Boolean(file && file.kind === "file") },
  );

  const createVersion = $api.useMutation("post", "/v1/files/{fileId}/versions");
  const restoreVersion = $api.useMutation("post", "/v1/files/{fileId}/versions/{versionId}/restore");

  const refreshVersions = async () => {
    await queryClient.invalidateQueries({ queryKey: ["get", "/v1/files/{fileId}/versions"] });
    await queryClient.invalidateQueries({ queryKey: ["get", "/v1/files"] });
  };

  const handleSnapshot = async () => {
    if (!file) return;
    try {
      await createVersion.mutateAsync({ params: { path: { fileId: file.id } } });
      await refreshVersions();
      toast.success(t("versions.snapshotCreated"));
    } catch (error) {
      toast.error(t("versions.snapshotFailed"), { description: userMessage(error) });
    }
  };

  const handleRestore = async (versionId: string) => {
    if (!file) return;
    setRestoringId(versionId);
    try {
      await restoreVersion.mutateAsync({
        params: { path: { fileId: file.id, versionId } },
      });
      await refreshVersions();
      toast.success(t("versions.restored"));
      onOpenChange(false);
    } catch (error) {
      toast.error(t("versions.restoreFailed"), { description: userMessage(error) });
    } finally {
      setRestoringId(undefined);
    }
  };

  const versions = versionsQuery.data ?? [];

  return (
    <AppDialog
      open={Boolean(file)}
      onOpenChange={onOpenChange}
      title={t("versions.title")}
      description={file ? t("versions.subtitle", { name: file.name }) : undefined}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onPress={() => onOpenChange(false)}>
            {t("dialog.cancel")}
          </Button>
          <Button
            variant="primary"
            isDisabled={file?.kind !== "file" || createVersion.isPending}
            onPress={() => void handleSnapshot()}
          >
            {createVersion.isPending ? t("versions.saving") : t("versions.saveSnapshot")}
          </Button>
        </>
      }
    >
      {versionsQuery.isPending ? (
        <div className="flex min-h-28 items-center justify-center">
          <Spinner size="sm" />
        </div>
      ) : versions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{t("versions.empty")}</p>
      ) : (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
          {versions.map((ver) => (
            <div
              key={ver.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-secondary/40 px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Chip size="sm" variant="soft">
                    v{ver.versionNumber}
                  </Chip>
                  <span className="truncate text-sm font-medium">{ver.name}</span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {formatBytes(ver.size)} · {formatDateTime.format(new Date(ver.createdAt))}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                isDisabled={Boolean(restoringId) || restoreVersion.isPending}
                onPress={() => void handleRestore(ver.id)}
              >
                {restoringId === ver.id ? t("versions.restoring") : t("versions.restore")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </AppDialog>
  );
}
