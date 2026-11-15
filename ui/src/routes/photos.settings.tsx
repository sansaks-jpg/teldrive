import { Button, Switch } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { LinkButton } from "@/components/link-button";
import { SettingsPageHeader, SettingsRow, SettingsSection } from "@/components/settings-layout";
import { usePhotosSettings } from "@/lib/app-settings";
import { useAppLocale } from "@/lib/locale";
import { useTheme } from "@/lib/theme";
import StorageIcon from "~icons/gravity-ui/database";
import MoonIcon from "~icons/gravity-ui/moon";
import PersonIcon from "~icons/gravity-ui/person";
import SunIcon from "~icons/gravity-ui/sun";

export const Route = createFileRoute("/photos/settings")({
  component: PhotosSettingsPage,
});

function PhotosSettingsPage() {
  const { t } = useAppLocale();
  const { theme, setTheme } = useTheme();
  const [settings, update] = usePhotosSettings();
  const notificationsSupported = typeof window !== "undefined" && "Notification" in window;

  const setBrowserNotifications = async (selected: boolean) => {
    if (!selected) {
      update({ browserNotifications: false });
      return;
    }
    if (!notificationsSupported) return;
    const permission =
      Notification.permission === "default"
        ? await Notification.requestPermission()
        : Notification.permission;
    if (permission !== "granted") {
      toast.error("Browser notifications are blocked", {
        description: "Allow notifications for this site in your browser settings, then try again.",
      });
      update({ browserNotifications: false });
      return;
    }
    update({ browserNotifications: true });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <SettingsPageHeader
        title="Photos Settings"
        description="Manage timeline display, notifications, and appearance for Teldrive Photos."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/photos" size="sm" variant="secondary">
              Back to Photos
            </LinkButton>
            <LinkButton to="/settings" size="sm" variant="secondary">
              <PersonIcon className="size-4" />
              Account
            </LinkButton>
          </div>
        }
      />

      <SettingsSection
        title="Appearance & Timeline"
        description="Customize theme and what appears in your main Photos timeline."
      >
        <SettingsRow label={t("appearance.themeLabel")} description={t("appearance.themeHint")}>
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              variant={theme === "system" ? "primary" : "secondary"}
              onPress={() => setTheme("system")}
            >
              {t("appearance.system")}
            </Button>
            <Button
              size="sm"
              variant={theme === "light" ? "primary" : "secondary"}
              onPress={() => setTheme("light")}
            >
              <SunIcon className="size-4" />
              {t("appearance.light")}
            </Button>
            <Button
              size="sm"
              variant={theme === "dark" ? "primary" : "secondary"}
              onPress={() => setTheme("dark")}
            >
              <MoonIcon className="size-4" />
              {t("appearance.dark")}
            </Button>
          </div>
        </SettingsRow>

        <SettingsRow
          label="Show videos in main timeline"
          description="Include video files alongside photos in the chronological grid."
        >
          <Switch
            isSelected={settings.showVideosInTimeline}
            onChange={(selected) => update({ showVideosInTimeline: selected })}
          />
        </SettingsRow>

        <SettingsRow
          label="Show screenshots in timeline"
          description="Display detected screenshot files in the main photo stream."
        >
          <Switch
            isSelected={settings.showScreenshots}
            onChange={(selected) => update({ showScreenshots: selected })}
          />
        </SettingsRow>

        <SettingsRow
          label="Memories & highlights"
          description="Show featured photo highlights at the top of the Photos view."
        >
          <Switch
            isSelected={settings.memoriesBanner}
            onChange={(selected) => update({ memoriesBanner: selected })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Notifications & Storage"
        description="Upload notifications and storage quota."
      >
        <SettingsRow
          label="Browser notifications"
          description={
            notificationsSupported
              ? "Get a desktop notification on this computer when uploads finish."
              : "This browser does not support desktop notifications."
          }
        >
          <Switch
            isDisabled={!notificationsSupported}
            isSelected={settings.browserNotifications}
            onChange={(selected) => void setBrowserNotifications(selected)}
          />
        </SettingsRow>

        <SettingsRow
          label="Storage & quota"
          description="Inspect photo, video, and Drive storage usage."
        >
          <LinkButton to="/drive/storage" size="sm" variant="secondary">
            <StorageIcon className="size-4" />
            Manage Storage
          </LinkButton>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
