import { Button, Card, Chip, Input, Label, Spinner, TextArea, TextField } from "@heroui/react";
import { keepPreviousData } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { $api } from "@/api/client";
import { userMessage } from "@/api/errors";
import { AppDialog } from "@/components/dialogs/app-dialog";
import { useFormatBytes } from "@/lib/format";
import { useAppLocale } from "@/lib/locale";
import { getQueryClient } from "@/lib/queryClient";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import DownloadIcon from "~icons/gravity-ui/arrow-down-to-line";
import ArrowLeftIcon from "~icons/gravity-ui/chevron-left";
import PlusIcon from "~icons/gravity-ui/plus";
import FileExcelIcon from "~icons/icon-park-outline/file-excel";
import FileTextIcon from "~icons/icon-park-outline/file-text";

export const Route = createFileRoute("/docs")({
  component: DocsWorkspacePage,
});

type DocFilter = "all" | "doc" | "sheet";

const COLS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const;

type SheetData = { cells: Record<string, string> };

function parseSheetContent(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<SheetData>;
    if (parsed && typeof parsed.cells === "object" && parsed.cells !== null) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed.cells)) {
        if (typeof v === "string") out[k] = v;
      }
      return out;
    }
  } catch {
    // Fallback to empty sheet if stored text isn't JSON
  }
  return {};
}

function expandRange(startRef: string, endRef: string): string[] {
  const m1 = /^([A-Z])(\d+)$/.exec(startRef.toUpperCase());
  const m2 = /^([A-Z])(\d+)$/.exec(endRef.toUpperCase());
  if (!m1 || !m2) return [];
  const c1 = m1[1].charCodeAt(0);
  const c2 = m2[1].charCodeAt(0);
  const r1 = Number(m1[2]);
  const r2 = Number(m2[2]);
  const refs: string[] = [];
  for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) {
    for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
      refs.push(`${String.fromCharCode(c)}${r}`);
    }
  }
  return refs;
}

function evaluateCell(
  ref: string,
  cells: Record<string, string>,
  visited = new Set<string>(),
): string {
  const raw = cells[ref] ?? "";
  if (!raw.startsWith("=")) return raw;
  if (visited.has(ref)) return "#CYCLE!";
  const nextVisited = new Set(visited);
  nextVisited.add(ref);

  const expr = raw.slice(1).trim();
  const sumMatch = /^SUM\(\s*([A-Z]\d+)\s*:\s*([A-Z]\d+)\s*\)$/i.exec(expr);
  if (sumMatch) {
    const nums = expandRange(sumMatch[1], sumMatch[2]).map(
      (id) => Number(evaluateCell(id, cells, nextVisited)) || 0,
    );
    return String(nums.reduce((a, b) => a + b, 0));
  }
  const avgMatch = /^(?:AVG|AVERAGE)\(\s*([A-Z]\d+)\s*:\s*([A-Z]\d+)\s*\)$/i.exec(expr);
  if (avgMatch) {
    const refs = expandRange(avgMatch[1], avgMatch[2]);
    if (refs.length === 0) return "0";
    const sum = refs.reduce(
      (acc, id) => acc + (Number(evaluateCell(id, cells, nextVisited)) || 0),
      0,
    );
    return String(Math.round((sum / refs.length) * 1000) / 1000);
  }
  const mathExpr = expr.replace(/\b([A-Z]\d+)\b/gi, (match) => {
    const val = Number(evaluateCell(match.toUpperCase(), cells, nextVisited));
    return Number.isFinite(val) ? String(val) : "0";
  });
  if (/^[0-9+\-*/().\s]+$/.test(mathExpr)) {
    try {
      const tokens = mathExpr.replace(/\s+/g, "");
      const result = evalSimpleArithmetic(tokens);
      return Number.isFinite(result) ? String(result) : "#ERR";
    } catch {
      return "#ERR";
    }
  }
  return raw;
}

function evalSimpleArithmetic(expr: string): number {
  let pos = 0;
  function parseExpr(): number {
    let val = parseTerm();
    while (pos < expr.length && (expr[pos] === "+" || expr[pos] === "-")) {
      const op = expr[pos++];
      const right = parseTerm();
      val = op === "+" ? val + right : val - right;
    }
    return val;
  }
  function parseTerm(): number {
    let val = parseFactor();
    while (pos < expr.length && (expr[pos] === "*" || expr[pos] === "/")) {
      const op = expr[pos++];
      const right = parseFactor();
      val = op === "*" ? val * right : right === 0 ? Number.NaN : val / right;
    }
    return val;
  }
  function parseFactor(): number {
    if (expr[pos] === "(") {
      pos++;
      const val = parseExpr();
      if (expr[pos] === ")") pos++;
      return val;
    }
    if (expr[pos] === "-") {
      pos++;
      return -parseFactor();
    }
    const start = pos;
    while (pos < expr.length && /[0-9.]/.test(expr[pos])) pos++;
    return Number(expr.slice(start, pos));
  }
  return parseExpr();
}

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function DocsWorkspacePage() {
  const { t, locale } = useAppLocale();
  const formatBytes = useFormatBytes();
  const queryClient = getQueryClient();

  const [filter, setFilter] = useState<DocFilter>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const [createDialogType, setCreateDialogType] = useState<"doc" | "sheet">();
  const [newTitle, setNewTitle] = useState("");

  const [activeDocId, setActiveDocId] = useState<string>();
  const [editorTitle, setEditorTitle] = useState("");
  const [editorContent, setEditorContent] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [sheetCells, setSheetCells] = useState<Record<string, string>>({});
  const [activeCell, setActiveCell] = useState<string>("A1");

  const listQuery = $api.useQuery(
    "get",
    "/v1/docs",
    {
      params: {
        query: {
          docType: filter === "all" ? undefined : filter,
          search: debouncedSearch || undefined,
          limit: 200,
        },
      },
    },
    { staleTime: 5_000, placeholderData: keepPreviousData },
  );

  const detailQuery = $api.useQuery(
    "get",
    "/v1/docs/{fileId}",
    { params: { path: { fileId: activeDocId ?? "" } } },
    { enabled: Boolean(activeDocId) },
  );

  const createDoc = $api.useMutation("post", "/v1/docs");
  const updateDoc = $api.useMutation("put", "/v1/docs/{fileId}");
  const createSnapshot = $api.useMutation("post", "/v1/files/{fileId}/versions");

  useEffect(() => {
    const doc = detailQuery.data;
    if (!doc) return;
    setEditorTitle(doc.name);
    setEditorContent(doc.content);
    if (doc.docType === "sheet") {
      setSheetCells(parseSheetContent(doc.content));
    }
  }, [detailQuery.data]);

  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const refreshDocs = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/docs"] }),
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/docs/{fileId}"] }),
      queryClient.invalidateQueries({ queryKey: ["get", "/v1/files"] }),
    ]);
  };

  const handleCreate = async () => {
    if (!createDialogType || !newTitle.trim()) return;
    const rawName = newTitle.trim();
    const docType = createDialogType;
    const name =
      docType === "doc" && !rawName.endsWith(".md")
        ? `${rawName}.md`
        : docType === "sheet" && !rawName.endsWith(".sheet.json")
          ? `${rawName}.sheet.json`
          : rawName;
    const initialContent = docType === "doc" ? `# ${rawName}\n\n` : `{"cells":{}}`;
    try {
      const created = await createDoc.mutateAsync({
        body: { name, docType, content: initialContent },
      });
      setCreateDialogType(undefined);
      setNewTitle("");
      setActiveDocId(created.fileId);
      setEditorTitle(created.name);
      setEditorContent(created.content);
      setSheetCells(docType === "sheet" ? parseSheetContent(created.content) : {});
      await refreshDocs();
      toast.success(t("docs.created"));
    } catch (error) {
      toast.error(t("docs.saveFailed"), { description: userMessage(error) });
    }
  };

  const handleCreateTemplate = async (
    docType: "doc" | "sheet",
    titleBase: string,
    initialContent: string,
  ) => {
    const stamp = Date.now().toString(36).slice(-4);
    const ext = docType === "sheet" ? ".sheet.json" : ".md";
    const name = `${titleBase} ${stamp}${ext}`;
    try {
      const created = await createDoc.mutateAsync({
        body: { name, docType, content: initialContent },
      });
      setActiveDocId(created.fileId);
      setEditorTitle(created.name);
      setEditorContent(created.content);
      setSheetCells(docType === "sheet" ? parseSheetContent(created.content) : {});
      await refreshDocs();
      toast.success(t("docs.created"));
    } catch (error) {
      toast.error(t("docs.saveFailed"), { description: userMessage(error) });
    }
  };

  const handleSave = async () => {
    if (!activeDocId || !detailQuery.data) return;
    const payloadContent =
      detailQuery.data.docType === "sheet" ? JSON.stringify({ cells: sheetCells }) : editorContent;
    try {
      await updateDoc.mutateAsync({
        params: { path: { fileId: activeDocId } },
        body: {
          name: editorTitle.trim() || detailQuery.data.name,
          content: payloadContent,
        },
      });
      await refreshDocs();
      toast.success(t("docs.saved"));
    } catch (error) {
      toast.error(t("docs.saveFailed"), { description: userMessage(error) });
    }
  };

  const handleSaveSnapshot = async () => {
    if (!activeDocId) return;
    try {
      await handleSave();
      await createSnapshot.mutateAsync({ params: { path: { fileId: activeDocId } } });
      toast.success(t("versions.snapshotCreated"));
    } catch (error) {
      toast.error(t("versions.snapshotFailed"), { description: userMessage(error) });
    }
  };

  const handleExport = () => {
    if (!detailQuery.data) return;
    if (detailQuery.data.docType === "sheet") {
      const csv = ROWS.map((row) =>
        COLS.map((col) => {
          const val = evaluateCell(`${col}${row}`, sheetCells);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(","),
      ).join("\n");
      const base = editorTitle.replace(/\.sheet\.json$/i, "");
      triggerDownload(`${base || "sheet"}.csv`, csv, "text/csv;charset=utf-8");
      return;
    }
    triggerDownload(editorTitle || "document.md", editorContent, "text/markdown;charset=utf-8");
  };

  const appendMarkdown = (snippet: string) => {
    setPreviewMode(false);
    setEditorContent((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  };

  if (activeDocId) {
    const doc = detailQuery.data;
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onPress={() => {
                setActiveDocId(undefined);
                setPreviewMode(false);
              }}
            >
              <ArrowLeftIcon className="size-4" />
              {t("docs.backToList")}
            </Button>
            <Input
              aria-label={t("docs.docTitle")}
              value={editorTitle}
              onChange={(event) => setEditorTitle(event.currentTarget.value)}
              className="max-w-md font-medium"
            />
            {doc ? (
              <Chip size="sm" variant="soft">
                {doc.docType === "sheet" ? t("docs.typeSheet") : t("docs.typeDoc")}
              </Chip>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {doc?.docType === "doc" ? (
              <Button size="sm" variant="secondary" onPress={() => setPreviewMode((prev) => !prev)}>
                {previewMode ? t("docs.editMode") : t("docs.previewMode")}
              </Button>
            ) : null}
            <Button size="sm" variant="secondary" onPress={handleExport}>
              <DownloadIcon className="size-4" />
              {doc?.docType === "sheet" ? t("docs.exportCsv") : t("docs.exportMd")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={createSnapshot.isPending || updateDoc.isPending}
              onPress={() => void handleSaveSnapshot()}
            >
              {t("versions.saveSnapshot")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              isDisabled={updateDoc.isPending}
              onPress={() => void handleSave()}
            >
              {updateDoc.isPending ? t("docs.saving") : t("docs.save")}
            </Button>
          </div>
        </div>

        {detailQuery.isPending || !doc ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : doc.docType === "doc" ? (
          <div className="space-y-4">
            <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-1 rounded-full border border-border/60 bg-surface-secondary/70 px-3 py-1.5 backdrop-blur-sm">
              <Button size="sm" variant="ghost" onPress={() => appendMarkdown("# ")}>
                H1
              </Button>
              <Button size="sm" variant="ghost" onPress={() => appendMarkdown("## ")}>
                H2
              </Button>
              <Button size="sm" variant="ghost" onPress={() => appendMarkdown("**bold**")}>
                B
              </Button>
              <Button size="sm" variant="ghost" onPress={() => appendMarkdown("*italic*")}>
                I
              </Button>
              <Button size="sm" variant="ghost" onPress={() => appendMarkdown("- ")}>
                List
              </Button>
              <Button size="sm" variant="ghost" onPress={() => appendMarkdown("```\n\n```")}>
                Code
              </Button>
            </div>
            <Card className="mx-auto w-full max-w-4xl rounded-2xl border border-border/70 bg-surface p-6 shadow-sm sm:p-10">
              {previewMode ? (
                <div className="min-h-[30rem] space-y-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {editorContent.split("\n").map((line, index) => {
                    const key = `${index}-${line.slice(0, 12)}`;
                    if (line.startsWith("# ")) {
                      return (
                        <h2 key={key} className="text-xl font-bold">
                          {line.slice(2)}
                        </h2>
                      );
                    }
                    if (line.startsWith("## ")) {
                      return (
                        <h3 key={key} className="text-lg font-semibold">
                          {line.slice(3)}
                        </h3>
                      );
                    }
                    return <p key={key}>{line || "\u00a0"}</p>;
                  })}
                </div>
              ) : (
                <TextArea
                  aria-label={t("docs.editorAria")}
                  rows={20}
                  value={editorContent}
                  onChange={(event) => setEditorContent(event.currentTarget.value)}
                  className="min-h-[30rem] w-full border-0 bg-transparent p-0 font-mono text-sm shadow-none focus-visible:ring-0"
                />
              )}
            </Card>
          </div>
        ) : (
          <Card className="space-y-3 rounded-2xl border border-border/60 bg-surface p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-surface-secondary/50 px-2.5 py-1.5">
              <Chip size="sm" variant="soft" color="accent">
                {activeCell}
              </Chip>
              <span className="font-mono text-xs font-semibold text-muted">fx</span>
              <Input
                aria-label={t("docs.formulaBarAria")}
                className="flex-1 bg-transparent font-mono text-sm"
                placeholder="=SUM(A1:A5) | =AVG(B1:B4) | 100"
                value={sheetCells[activeCell] ?? ""}
                onChange={(event) =>
                  setSheetCells((prev) => ({
                    ...prev,
                    [activeCell]: event.currentTarget.value,
                  }))
                }
              />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="w-10 border border-border bg-surface-secondary/80 p-1.5 text-center font-semibold text-muted">
                      #
                    </th>
                    {COLS.map((col) => (
                      <th
                        key={col}
                        className="min-w-28 border border-border bg-surface-secondary/80 p-1.5 text-center font-semibold text-muted"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row}>
                      <td className="border border-border bg-surface-secondary/60 p-1.5 text-center font-semibold text-muted">
                        {row}
                      </td>
                      {COLS.map((col) => {
                        const ref = `${col}${row}`;
                        const isSelected = activeCell === ref;
                        const displayVal = isSelected
                          ? (sheetCells[ref] ?? "")
                          : evaluateCell(ref, sheetCells);
                        return (
                          <td
                            key={ref}
                            className={`border border-border p-0 transition-colors ${
                              isSelected ? "bg-accent/10 ring-2 ring-inset ring-accent" : ""
                            }`}
                          >
                            <Input
                              aria-label={ref}
                              value={displayVal}
                              onFocus={() => setActiveCell(ref)}
                              onChange={(event) =>
                                setSheetCells((prev) => ({
                                  ...prev,
                                  [ref]: event.currentTarget.value,
                                }))
                              }
                              className="h-8 rounded-none border-0 bg-transparent px-2 text-xs shadow-none"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    );
  }

  const docs = listQuery.data ?? [];
  const docTemplates: {
    id: string;
    title: string;
    docType: "doc" | "sheet";
    content: string;
  }[] = [
    {
      id: "blank-doc",
      title: t("docs.templateBlankDoc"),
      docType: "doc",
      content: `# ${t("docs.templateBlankDoc")}\n\n`,
    },
    {
      id: "meeting-notes",
      title: t("docs.templateMeetingNotes"),
      docType: "doc",
      content: `# ${t("docs.templateMeetingNotes")}\n\n## Attendees\n- \n\n## Agenda\n1. \n\n## Action Items\n- [ ] \n`,
    },
    {
      id: "roadmap",
      title: t("docs.templateRoadmap"),
      docType: "doc",
      content: `# ${t("docs.templateRoadmap")}\n\n## Objectives\n- \n\n## Milestones\n- [ ] Phase 1\n- [ ] Phase 2\n`,
    },
    {
      id: "blank-sheet",
      title: t("docs.templateBlankSheet"),
      docType: "sheet",
      content: `{"cells":{}}`,
    },
    {
      id: "budget",
      title: t("docs.templateBudget"),
      docType: "sheet",
      content: JSON.stringify({
        cells: {
          A1: "Category",
          B1: "Planned",
          C1: "Actual",
          A2: "Infrastructure",
          B2: "120",
          C2: "110",
          A3: "Storage",
          B3: "80",
          C3: "75",
          A4: "Total",
          B4: "=SUM(B2:B3)",
          C4: "=SUM(C2:C3)",
        },
      }),
    },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-2 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("apps.docs")}</h1>
          <p className="text-sm text-muted">{t("docs.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full px-4"
            onPress={() => {
              setNewTitle("");
              setCreateDialogType("sheet");
            }}
          >
            <PlusIcon className="size-4" />
            {t("docs.newSheet")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="rounded-full px-4"
            onPress={() => {
              setNewTitle("");
              setCreateDialogType("doc");
            }}
          >
            <PlusIcon className="size-4" />
            {t("docs.newDoc")}
          </Button>
        </div>
      </div>

      <section className="space-y-3 rounded-3xl border border-border/50 bg-surface-secondary/50 p-4 sm:p-5">
        <h2 className="text-sm font-medium text-foreground">{t("docs.templateGalleryTitle")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {docTemplates.map((tpl) => {
            const isSheet = tpl.docType === "sheet";
            return (
              <Button
                key={tpl.id}
                variant="ghost"
                isDisabled={createDoc.isPending}
                className="flex h-auto flex-col items-start justify-between gap-3 rounded-2xl border border-border/60 bg-surface p-3.5 text-left shadow-sm transition-all hover:border-accent/60 hover:bg-surface hover:shadow-md"
                onPress={() => void handleCreateTemplate(tpl.docType, tpl.title, tpl.content)}
              >
                <div
                  className={`flex h-16 w-full items-center justify-center rounded-xl ${
                    isSheet
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                  }`}
                >
                  {isSheet ? (
                    <FileExcelIcon className="size-7" />
                  ) : (
                    <FileTextIcon className="size-7" />
                  )}
                </div>
                <div className="w-full space-y-1">
                  <p className="truncate text-xs font-semibold text-foreground">{tpl.title}</p>
                  <p className="text-[11px] text-muted">
                    {isSheet ? t("docs.typeSheet") : t("docs.typeDoc")}
                  </p>
                </div>
              </Button>
            );
          })}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TextField value={search} onChange={setSearch} className="w-full max-w-sm">
          <Input placeholder={t("docs.searchPh")} aria-label={t("docs.searchPh")} />
        </TextField>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filter === "all" ? "primary" : "secondary"}
            className="rounded-full"
            onPress={() => setFilter("all")}
          >
            {t("docs.filterAll")}
          </Button>
          <Button
            size="sm"
            variant={filter === "doc" ? "primary" : "secondary"}
            className="rounded-full"
            onPress={() => setFilter("doc")}
          >
            {t("docs.typeDoc")}
          </Button>
          <Button
            size="sm"
            variant={filter === "sheet" ? "primary" : "secondary"}
            className="rounded-full"
            onPress={() => setFilter("sheet")}
          >
            {t("docs.typeSheet")}
          </Button>
        </div>
      </div>

      {listQuery.isPending ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : docs.length === 0 ? (
        <Card className="rounded-2xl p-8 text-center">
          <p className="text-sm text-muted">{t("docs.empty")}</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((item) => (
            <Card
              key={item.fileId}
              className="flex flex-col justify-between gap-3 rounded-2xl border border-border/60 bg-surface p-4 shadow-sm"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate text-base font-semibold">{item.name}</h2>
                  <Chip
                    size="sm"
                    variant="soft"
                    color={item.docType === "sheet" ? "success" : "accent"}
                  >
                    {item.docType === "sheet" ? t("docs.typeSheet") : t("docs.typeDoc")}
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {formatBytes(item.size)} · {dateTimeFormatter.format(new Date(item.updatedAt))}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-full"
                onPress={() => setActiveDocId(item.fileId)}
              >
                {t("docs.openEditor")}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <AppDialog
        open={Boolean(createDialogType)}
        onOpenChange={(open) => {
          if (!open) setCreateDialogType(undefined);
        }}
        title={createDialogType === "sheet" ? t("docs.newSheet") : t("docs.newDoc")}
        size="md"
        footer={
          <>
            <Button variant="secondary" onPress={() => setCreateDialogType(undefined)}>
              {t("dialog.cancel")}
            </Button>
            <Button
              variant="primary"
              isDisabled={!newTitle.trim() || createDoc.isPending}
              onPress={() => void handleCreate()}
            >
              {t("docs.create")}
            </Button>
          </>
        }
      >
        <TextField value={newTitle} onChange={setNewTitle} autoFocus>
          <Label>{t("docs.docTitle")}</Label>
          <Input placeholder={createDialogType === "sheet" ? "Budget 2026" : "Meeting Notes"} />
        </TextField>
      </AppDialog>
    </div>
  );
}
