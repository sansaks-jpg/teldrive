import { Button, Switch } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { LinkButton } from "@/components/link-button";
import { SettingsPageHeader, SettingsRow, SettingsSection } from "@/components/settings-layout";
import { useDocsSettings } from "@/lib/app-settings";
import { useAppLocale } from "@/lib/locale";
import { useTheme } from "@/lib/theme";
import BookIcon from "~icons/gravity-ui/book-open";
import MoonIcon from "~icons/gravity-ui/moon";
import PersonIcon from "~icons/gravity-ui/person";
import SunIcon from "~icons/gravity-ui/sun";

export const Route = createFileRoute("/docs/settings")({
  component: DocsSettingsPage,
});

function DocsSettingsPage() {
  const { t } = useAppLocale();
  const { theme, setTheme } = useTheme();
  const [settings, update] = useDocsSettings();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-8">
      <SettingsPageHeader
        title="Docs Settings"
        description="Configure document editor layout, reader preferences, and appearance for Teldrive Docs."
        actions={
          <div className="flex flex-wrap gap-2">
            <LinkButton to="/docs" size="sm" variant="secondary">
              Back to Docs
            </LinkButton>
            <LinkButton to="/settings" size="sm" variant="secondary">
              <PersonIcon className="size-4" />
              Account
            </LinkButton>
          </div>
        }
      />

      <SettingsSection
        title="Editor & Document Layout"
        description="Control how documents are displayed and saved."
      >
        <SettingsRow
          label="Paginated page layout"
          description="Show documents with page boundaries instead of continuous pageless scrolling."
        >
          <Switch
            isSelected={settings.paginatedLayout}
            onChange={(selected) => update({ paginatedLayout: selected })}
          />
        </SettingsRow>

        <SettingsRow
          label="Display word count"
          description="Keep live word and character counts visible while editing."
        >
          <Switch
            isSelected={settings.showWordCount}
            onChange={(selected) => update({ showWordCount: selected })}
          />
        </SettingsRow>

        <SettingsRow
          label="Auto-save drafts"
          description="Keep unsaved edits in this browser and restore them if you leave before saving."
        >
          <Switch
            isSelected={settings.autoSaveDrafts}
            onChange={(selected) => update({ autoSaveDrafts: selected })}
          />
        </SettingsRow>
      </SettingsSection>

      <SettingsSection
        title="Reader & Appearance"
        description="Theme and document viewer defaults."
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
          label="PDF & Ebook reader"
          description="Configure reader defaults shared across Drive and Docs."
        >
          <LinkButton to="/settings/reader" size="sm" variant="secondary">
            <BookIcon className="size-4" />
            Reader Settings
          </LinkButton>
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
