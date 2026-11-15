import { Button, ListBox, Select, Switch } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import type { components } from "@/api/schema";
import { LinkButton } from "@/components/link-button";
import { SettingsPageHeader, SettingsRow, SettingsSection } from "@/components/settings-layout";
import { useAppLocale } from "@/lib/locale";
import { usePreferences, useUpdatePreferences } from "@/lib/preferences";
import { useTheme } from "@/lib/theme";
import BookIcon from "~icons/gravity-ui/book-open";
import StorageIcon from "~icons/gravity-ui/database";
import KeyIcon from "~icons/gravity-ui/key";
import MoonIcon from "~icons/gravity-ui/moon";
import PersonIcon from "~icons/gravity-ui/person";
import PlayIcon from "~icons/gravity-ui/play";
import SunIcon from "~icons/gravity-ui/sun";
import UploadIcon from "~icons/gravity-ui/arrow-up-from-line";

export const Route = createFileRoute("/drive/settings")({
  component: DriveSettingsPage,
});

function DriveSettingsPage() {
  const { t } = useAppLocale();
  const { theme, setTheme } = useTheme();
  const preferences = usePreferences();
  const updatePreferences = useUpdatePreferences();

  const sortField = preferences?.files.sort ?? "name";
  const sortOrder = preferences?.files.order ?? "asc";
  const encryptionEnabled = preferences?.uploads.encryption ?? false;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <SettingsPageHeader
        title="Drive Settings"
        description="Configure your file browser defaults, upload behavior, media playback, and API access."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/drive/storage" size="sm" variant="secondary">
              <StorageIcon className="size-4" />
              Storage
            </LinkButton>
            <LinkButton to="/settings" size="sm" variant="secondary">
              <PersonIcon className="size-4" />
              Account & Sessions
            </LinkButton>
          </div>
        }
      />

      <SettingsSection
        title="General & File Browser"
        description="Default sorting and appearance for My Drive and shared folders."
      >
        <SettingsRow
          label="Default sort field"
          description="Applied when opening folders without an explicit sort parameter."
        >
          <Select
            aria-label="Default sort field"
            selectedKey={sortField}
            onSelectionChange={(key) => {
              if (typeof key === "string") {
                updatePreferences.mutate({
                  files: { sort: key as components["schemas"]["FileBrowserSort"] },
                });
              }
            }}
            className="w-44"
          >
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="name" textValue="Name">
                  Name
                </ListBox.Item>
                <ListBox.Item id="updatedAt" textValue="Last modified">
                  Last modified
                </ListBox.Item>
                <ListBox.Item id="size" textValue="Size">
                  Size
                </ListBox.Item>
              </ListBox>
            </Select.Popover>
          </Select>
        </SettingsRow>

        <SettingsRow label="Default sort order" description="Ascending or descending order.">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={sortOrder === "asc" ? "primary" : "secondary"}
              onPress={() =>
                updatePreferences.mutate({
                  files: { order: "asc" as components["schemas"]["SortOrder"] },
                })
              }
            >
              Ascending
            </Button>
            <Button
              size="sm"
              variant={sortOrder === "desc" ? "primary" : "secondary"}
              onPress={() =>
                updatePreferences.mutate({
                  files: { order: "desc" as components["schemas"]["SortOrder"] },
                })
              }
            >
              Descending
            </Button>
          </div>
        </SettingsRow>

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
      </SettingsSection>

      <SettingsSection
        title="Uploads & Encryption"
        description="Control how new files are uploaded and encrypted."
      >
        <SettingsRow
          label="Encrypt new uploads by default"
          description="Encrypts file payloads before storing them in Telegram."
        >
          <Switch
            isSelected={encryptionEnabled}
            onChange={(selected) => updatePreferences.mutate({ uploads: { encryption: selected } })}
          />
        </SettingsRow>

        <SettingsRow
          label="Advanced upload settings"
          description="Configure conflict policy, concurrency, and part size."
        >
          <LinkButton to="/settings/uploads" size="sm" variant="secondary">
            <UploadIcon className="size-4" />
            Configure Uploads
          </LinkButton>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Viewers & Integrations"
        description="Customize built-in media playback, document reading, and API keys."
      >
        <SettingsRow
          label="Video player & captions"
          description="Font, size, background, and embedded audio/subtitle track behavior."
        >
          <LinkButton to="/settings/player" size="sm" variant="secondary">
            <PlayIcon className="size-4" />
            Player Settings
          </LinkButton>
        </SettingsRow>

        <SettingsRow label="Document & ebook reader" description="PDF and EPUB reader defaults.">
          <LinkButton to="/settings/reader" size="sm" variant="secondary">
            <BookIcon className="size-4" />
            Reader Settings
          </LinkButton>
        </SettingsRow>

        <SettingsRow
          label="API keys & rclone"
          description="Create or revoke API keys for rclone and external clients."
        >
          <LinkButton to="/settings/api-keys" size="sm" variant="secondary">
            <KeyIcon className="size-4" />
            Manage API Keys
          </LinkButton>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
