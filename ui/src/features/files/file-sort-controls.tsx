import { Button, Dropdown, Label } from "@heroui/react";
import type { FileBrowserPreferences } from "@/api/types";
import { useAppLocale } from "@/lib/locale";
import ArrowDownIcon from "~icons/gravity-ui/arrow-down";
import ArrowUpIcon from "~icons/gravity-ui/arrow-up";
import type { FileSort } from "./sort-preference";

export function FileSortControls({
  sorting,
  onChange,
}: {
  sorting: FileBrowserPreferences;
  onChange: (sorting: FileBrowserPreferences) => void;
}) {
  const { t } = useAppLocale();
  return (
    <>
      <Dropdown>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1 rounded-full px-1.5 text-[14px] font-medium text-foreground hover:bg-default/40 sm:bg-secondary/60 sm:px-3 sm:text-xs"
          aria-label={t("manager.sortFiles")}
        >
          {sorting.sort === "updatedAt"
            ? t("manager.sortModified")
            : sorting.sort === "size"
              ? t("search.sortSize")
              : t("search.sortName")}
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            aria-label={t("manager.sortBy")}
            selectionMode="single"
            selectedKeys={new Set([sorting.sort])}
            onAction={(key) => onChange({ ...sorting, sort: key as FileSort })}
          >
            <Dropdown.Item id="name" textValue={t("search.sortName")}>
              <Label>{t("search.sortName")}</Label>
            </Dropdown.Item>
            <Dropdown.Item id="updatedAt" textValue={t("manager.sortModified")}>
              <Label>{t("manager.sortModified")}</Label>
            </Dropdown.Item>
            <Dropdown.Item id="size" textValue={t("search.sortSize")}>
              <Label>{t("search.sortSize")}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
      <Button
        isIconOnly
        size="sm"
        variant="secondary"
        className="size-7 rounded-full bg-[#e3edf5] text-[#1f1f1f] dark:bg-[#233236] dark:text-[#cbe2e8] sm:size-8"
        aria-label={t(sorting.order === "asc" ? "manager.orderToDesc" : "manager.orderToAsc")}
        onPress={() => onChange({ ...sorting, order: sorting.order === "asc" ? "desc" : "asc" })}
      >
        {sorting.order === "asc" ? (
          <ArrowUpIcon className="size-4" aria-hidden="true" />
        ) : (
          <ArrowDownIcon className="size-4" aria-hidden="true" />
        )}
      </Button>
    </>
  );
}
