import { Button, Card, Chip } from "@heroui/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useAppLocale } from "@/lib/locale";

export const Route = createFileRoute("/photos")({
  component: PhotosWorkspacePage,
});

function PhotosWorkspacePage() {
  const { t } = useAppLocale();
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{t("apps.photos")}</h1>
              <Chip size="sm" variant="soft" color="accent">
                {t("apps.phase2Badge")}
              </Chip>
            </div>
            <p className="mt-2 text-sm text-muted">{t("apps.photosDesc")}</p>
          </div>
          <Link to="/files">
            <Button variant="primary">{t("apps.openDrive")}</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
