import { Button, Switch } from "@heroui/react";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { LinkButton } from "@/components/link-button";
import { SettingsPageHeader, SettingsRow, SettingsSection } from "@/components/settings-layout";
import { useAppLocale } from "@/lib/locale";
import { useTheme } from "@/lib/theme";
import BookIcon from "~icons/gravity-ui/book-open";
import MoonIcon from "~icons/gravity-ui/moon";
import PersonIcon from "~icons/gravity-ui/person";
import SunIcon from "~icons/gravity-ui/sun";

const DOCS_SETTINGS_KEY = "teldrive:docs-settings:v1";

type DocsSettingsState = {
  paginatedLayout: boolean;
  showWordCount: boolean;
  autoSaveDrafts: boolean;
};

const DEFAULT_DOCS_SETTINGS: DocsSettingsState = {
  paginatedLayout: true,
  showWordCount: true,
  autoSaveDrafts: true,
};

function loadDocsSettings(): DocsSettingsState {
  try {
    const raw = localStorage.getItem(DOCS_SETTINGS_KEY);
    if (!raw) return DEFAULT_DOCS_SETTINGS;
    return { ...DEFAULT_DOCS_SETTINGS, ...(JSON.parse(raw) as Partial<DocsSettingsState>) };
  } catch {
    return DEFAULT_DOCS_SETTINGS;
  }
}

export const Route = createFileRoute("/docs/settings")({
  component: DocsSettingsPage,
});

function DocsSettingsPage() {
  const { t } = useAppLocale();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<DocsSettingsState>(loadDocsSettings);

  const update = (patch: Partial<DocsSettingsState>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(DOCS_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors.
      }
      return next;
    });
  };

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
          description="Automatically preserve local edits before syncing to Drive."
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
