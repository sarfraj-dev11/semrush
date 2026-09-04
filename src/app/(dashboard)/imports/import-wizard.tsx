"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  CheckCircle2,
  FileSpreadsheet,
  Save,
  Upload,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/input";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import {
  autoDetectMapping,
  parseCsvText,
  SOURCE_FIELD_DEFINITIONS,
  validateImportRows,
  type ImportSourceType,
} from "@/lib/importer/csv";
import { executeImportAction, saveMappingAction } from "./actions";

interface ProjectOption {
  id: number;
  name: string;
  domain: string;
}

interface MappingPreset {
  id: number;
  name: string;
  sourceType: string;
  mapping: Record<string, string>;
}

export function ImportWizard({
  projects,
  presets,
}: {
  projects: ProjectOption[];
  presets: MappingPreset[];
}) {
  const [projectId, setProjectId] = useState<number>(projects[0]?.id ?? 0);
  const [sourceType, setSourceType] = useState<ImportSourceType>("keywords");
  const [fileName, setFileName] = useState<string>("");
  const [csvContent, setCsvContent] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [presetName, setPresetName] = useState<string>("");
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: boolean;
    imported: number;
    skipped: number;
    error?: string;
  } | null>(null);

  const fields = SOURCE_FIELD_DEFINITIONS[sourceType];

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvContent(text);
      const parsed = parseCsvText(text);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      const detected = autoDetectMapping(sourceType, parsed.headers);
      setMapping(detected);
    };
    reader.readAsText(file);
  }

  function handleSourceTypeChange(type: ImportSourceType) {
    setSourceType(type);
    setImportResult(null);
    if (headers.length > 0) {
      setMapping(autoDetectMapping(type, headers));
    }
  }

  function handlePresetSelect(presetId: number) {
    const p = presets.find((item) => item.id === presetId);
    if (p) {
      setSourceType(p.sourceType as ImportSourceType);
      setMapping(p.mapping);
    }
  }

  async function handleSavePreset() {
    if (!presetName.trim()) return;
    setIsSavingPreset(true);
    try {
      await saveMappingAction(presetName, sourceType, mapping);
      setPresetName("");
    } catch (err) {
      console.error("❌ Failed to save preset:", err);
    } finally {
      setIsSavingPreset(false);
    }
  }

  async function handleExecuteImport() {
    if (!projectId || !csvContent) return;
    setIsImporting(true);
    setImportResult(null);

    try {
      const res = await executeImportAction(
        projectId,
        sourceType,
        fileName || "manual_import.csv",
        csvContent,
        mapping,
      );
      setImportResult(res);
    } catch (err) {
      console.error("❌ Import error:", err);
      setImportResult({
        success: false,
        imported: 0,
        skipped: 0,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsImporting(false);
    }
  }

  const validation =
    rows.length > 0 ? validateImportRows(sourceType, rows, mapping) : null;
  const filteredPresets = presets.filter((p) => p.sourceType === sourceType);

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="size-4 text-accent" />
            1. Target Project & Source File
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                Target Project
              </label>
              <NativeSelect
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.domain})
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-1.5">
              <label className="text-[13px] font-medium text-muted-foreground">
                Import Data Type
              </label>
              <NativeSelect
                value={sourceType}
                onChange={(e) =>
                  handleSourceTypeChange(e.target.value as ImportSourceType)
                }
              >
                <option value="keywords">Keywords (Search volume, KD, CPC, Intent)</option>
                <option value="rankings">Rankings (Historical positions, URLs, Dates)</option>
                <option value="backlinks">Backlinks (Referring URLs, Domains, DR, Anchors)</option>
                <option value="competitors">Competitors (Domains, Brand Names)</option>
              </NativeSelect>
            </div>
          </div>

          {/* File input */}
          <div className="rounded-xl border border-dashed border-border bg-surface-muted/50 p-6 text-center">
            <FileSpreadsheet className="mx-auto size-8 text-muted-foreground/60 mb-2" />
            <p className="text-[14px] font-medium text-foreground">
              {fileName ? fileName : "Select or drop a CSV export file"}
            </p>
            <p className="text-[12px] text-subtle-foreground mt-0.5">
              Supports standard exports from Semrush, Ahrefs, Moz, or custom CSVs.
            </p>
            <label className="mt-3 inline-block">
              <span className="inline-flex cursor-pointer items-center justify-center rounded-[10px] bg-surface border border-border px-3.5 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-raised shadow-xs">
                Browse CSV file
              </span>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Mapping Card */}
      {headers.length > 0 ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ArrowDownToLine className="size-4 text-accent" />
                2. Column Mapping & Schema Matching
              </CardTitle>
              <p className="text-[13px] text-muted-foreground mt-1">
                Detected {headers.length} columns and {rows.length} rows in{" "}
                <span className="font-mono text-[12px]">{fileName}</span>.
              </p>
            </div>

            {filteredPresets.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-subtle-foreground">Preset:</span>
                <NativeSelect
                  className="w-44 text-[13px]"
                  onChange={(e) => handlePresetSelect(Number(e.target.value))}
                >
                  <option value="">Load saved preset…</option>
                  {filteredPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((field) => {
                const currentVal = mapping[field.key] ?? "";
                return (
                  <div
                    key={field.key}
                    className="rounded-[10px] border border-border bg-surface-muted/40 p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[13px] font-semibold text-foreground">
                        {field.label}
                      </span>
                      {field.required ? (
                        <Badge tone="critical">Required</Badge>
                      ) : (
                        <span className="text-[11px] text-subtle-foreground uppercase">
                          {field.type}
                        </span>
                      )}
                    </div>
                    <NativeSelect
                      value={currentVal}
                      onChange={(e) =>
                        setMapping({ ...mapping, [field.key]: e.target.value })
                      }
                      className="text-[13px]"
                    >
                      <option value="">(Skip / Not in CSV)</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                );
              })}
            </div>

            {/* Save preset inline */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Input
                placeholder="Name this mapping preset (e.g. Semrush Keywords Export)"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="max-w-sm text-[13px]"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSavePreset}
                disabled={!presetName.trim() || isSavingPreset}
              >
                <Save className="size-3.5" />
                Save Preset
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Validation & Dry-Run Preview */}
      {validation ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>3. Dry-Run Preview</CardTitle>
              <div className="flex items-center gap-2">
                <Badge tone="success">{validation.validCount} valid rows</Badge>
                {validation.invalidCount > 0 ? (
                  <Badge tone="critical">
                    {validation.invalidCount} invalid rows
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {validation.errors.length > 0 ? (
              <div className="rounded-[10px] border border-critical/30 bg-critical-subtle/20 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-critical">
                  <AlertTriangle className="size-4" />
                  Validation Warnings
                </div>
                {validation.errors.map((err, i) => (
                  <p key={i} className="text-[12px] text-muted-foreground">
                    {err}
                  </p>
                ))}
              </div>
            ) : null}

            {validation.sampleRows.length > 0 ? (
              <TableWrap>
                <Table>
                  <Thead>
                    <tr>
                      {fields
                        .filter((f) => mapping[f.key])
                        .map((f) => (
                          <Th key={f.key}>{f.label}</Th>
                        ))}
                    </tr>
                  </Thead>
                  <Tbody>
                    {validation.sampleRows.map((sample, idx) => (
                      <Tr key={idx}>
                        {fields
                          .filter((f) => mapping[f.key])
                          .map((f) => (
                            <Td key={f.key} className="truncate max-w-xs text-[13px]">
                              {String(sample[f.key] ?? "—")}
                            </Td>
                          ))}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            ) : null}

            {/* Execute Import Action */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
              <div>
                {importResult ? (
                  <div className="flex items-center gap-2 text-[14px]">
                    {importResult.success ? (
                      <>
                        <CheckCircle2 className="size-5 text-success" />
                        <span className="font-semibold text-success">
                          Successfully imported {importResult.imported} records!
                        </span>
                        {importResult.skipped > 0 ? (
                          <span className="text-muted-foreground text-[13px]">
                            ({importResult.skipped} skipped)
                          </span>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="size-5 text-critical" />
                        <span className="font-semibold text-critical">
                          Import failed: {importResult.error}
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">
                    Ready to insert {validation.validCount} valid rows into SQLite.
                  </p>
                )}
              </div>

              <Button
                variant="primary"
                onClick={handleExecuteImport}
                disabled={validation.validCount === 0 || isImporting}
              >
                <Upload className="size-4" />
                {isImporting
                  ? "Importing…"
                  : `Execute Import (${validation.validCount} rows)`}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
