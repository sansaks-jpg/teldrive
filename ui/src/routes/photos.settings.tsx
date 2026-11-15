import { Button, Switch } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LinkButton } from "@/components/link-button";
import { SettingsPageHeader, SettingsRow, SettingsSection } from "@/components/settings-layout";
import { useAppLocale } from "@/lib/locale";
import { useTheme } from "@/lib/theme";
import StorageIcon from "~icons/gravity-ui/database";
import MoonIcon from "~icons/gravity-ui/moon";
import PersonIcon from "~icons/gravity-ui/person";
import SunIcon from "~icons/gravity-ui/sun";

const PHOTOS_SETTINGS_KEY = "teldrive:photos-settings:v1";

type PhotosSettingsState = {
  backupQuality: "original" | "storage_saver";
  showVideosInTimeline: boolean;
  showScreenshots: boolean;
  memoriesBanner: boolean;
  shareLocationMetadata: boolean;
  browserNotifications: boolean;
};

const DEFAULT_PHOTOS_SETTINGS: PhotosSettingsState = {
  backupQuality: "original",
  showVideosInTimeline: true,
  showScreenshots: true,
  memoriesBanner: true,
  shareLocationMetadata: false,
  browserNotifications: false,
};

function loadPhotosSettings(): PhotosSettingsState {
  try {
    const raw = localStorage.getItem(PHOTOS_SETTINGS_KEY);
    if (!raw) return DEFAULT_PHOTOS_SETTINGS;
    return { ...DEFAULT_PHOTOS_SETTINGS, ...(JSON.parse(raw) as Partial<PhotosSettingsState>) };
  } catch {
    return DEFAULT_PHOTOS_SETTINGS;
  }
}

export const Route = createFileRoute("/photos/settings")({
  component: PhotosSettingsPage,
});

function PhotosSettingsPage() {
  const { t } = useAppLocale();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<PhotosSettingsState>(loadPhotosSettings);

  const update = (patch: Partial<PhotosSettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(PHOTOS_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors.
      }
      return next;
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <SettingsPageHeader
        title="Photos Settings"
        description="Manage backup quality, timeline display, sharing privacy, and appearance for Teldrive Photos."
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
        title="Backup & Upload Quality"
        description="Choose how photos and videos uploaded through Photos are stored."
      >
        <SettingsRow
          label="Original quality"
          description="Store photos and videos without changing resolution or quality."
        >
          <Button
            size="sm"
            variant={settings.backupQuality === "original" ? "primary" : "secondary"}
            onPress={() => update({ backupQuality: "original" })}
          >
            {settings.backupQuality === "original" ? "Selected" : "Select"}
          </Button>
        </SettingsRow>
        <SettingsRow
          label="Storage saver"
          description="Prefer compact uploads when client-side optimization is available."
        >
          <Button
            size="sm"
            variant={settings.backupQuality === "storage_saver" ? "primary" : "secondary"}
            onPress={() => update({ backupQuality: "storage_saver" })}
          >
            {settings.backupQuality === "storage_saver" ? "Selected" : "Select"}
          </Button>
        </SettingsRow>
      </SettingsSection>

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
        title="Sharing, Privacy & Storage"
        description="Control shared metadata, notifications, and storage quota."
      >
        <SettingsRow
          label="Include location metadata when sharing"
          description="Allow EXIF location details to remain visible on shared photo links."
        >
          <Switch
            isSelected={settings.shareLocationMetadata}
            onChange={(selected) => update({ shareLocationMetadata: selected })}
          />
        </SettingsRow>

        <SettingsRow
          label="Browser notifications"
          description="Receive desktop notifications when photo uploads or imports finish."
        >
          <Switch
            isSelected={settings.browserNotifications}
            onChange={(selected) => update({ browserNotifications: selected })}
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
