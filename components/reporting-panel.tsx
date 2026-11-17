"use client";

import { useMemo, useState } from "react";
import { Schedule } from "@/components/schedule";
import { planEmployeeToScheduleEmployee, productivityPercent, reportingDateLabel, reportingDateRange, warsawBusinessDate } from "@/lib/reporting-utils";
import type { ReportingError, ReportingPerformanceResponse, ReportingPerformanceRow, ReportingPlansResponse, ReportingPlanVersion } from "@/types/reporting";

type ReportingSection = "performance" | "plans";
type RangeMode = "day" | "range";

function formatHours(value: number) {
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null) {
  return value === null ? "—" : `${new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)}%`;
}

function productivityClass(value: number | null) {
  if (value === null) return "unavailable";
  if (value >= 100) return "good";
  if (value >= 90) return "near";
  return "behind";
}

function formatWarsawTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportPerformanceExcel(rows: ReportingPerformanceRow[], from: string, to: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MOL // AUTO DAILY PLAN";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Wydajność", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Data", key: "business_date", width: 14 },
    { header: "Pracownik", key: "display_name", width: 28 },
    { header: "Operator ES", key: "operator", width: 22 },
    { header: "Plan PICK h", key: "plan_pick_hours", width: 15 },
    { header: "Plan PAK h", key: "plan_pack_hours", width: 15 },
    { header: "Wykonanie PICK", key: "pick_completed", width: 19 },
    { header: "Wykonanie PAK", key: "pack_completed", width: 19 },
    { header: "Produktywność dnia", key: "productivity_percent", width: 21 },
    { header: "Wersja planu", key: "plan_version", width: 16 },
    { header: "Ostatni snapshot", key: "snapshot_collected_at", width: 22 },
    { header: "ID planu", key: "plan_id", width: 39 },
    { header: "ID snapshotu", key: "snapshot_id", width: 39 },
    { header: "Status danych", key: "data_status", width: 18 },
  ];
  for (const row of rows) {
    const productivity = productivityPercent(row);
    const sheetRow = sheet.addRow({
      ...row,
      productivity_percent: productivity,
      business_date: new Date(`${row.business_date}T12:00:00Z`),
      operator: row.operator || "—",
      snapshot_collected_at: row.snapshot_collected_at ? new Date(row.snapshot_collected_at) : null,
    });
    const productivityCell = sheetRow.getCell("productivity_percent");
    productivityCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: productivity === null ? "FFF1F2F5" : productivity >= 100 ? "FFE8F3EC" : productivity >= 90 ? "FFFFF5DF" : "FFFFF0F2" } };
    productivityCell.font = { bold: true, color: { argb: productivity === null ? "FF9295A1" : productivity >= 100 ? "FF2E6A45" : productivity >= 90 ? "FF8A6517" : "FFA23F50" } };
  }
  sheet.autoFilter = { from: "A1", to: "M1" };
  sheet.getRow(1).height = 24;
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF303348" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  sheet.getColumn("business_date").numFmt = "dd.mm.yyyy";
  sheet.getColumn("snapshot_collected_at").numFmt = "dd.mm.yyyy hh:mm:ss";
  sheet.getColumn("plan_pick_hours").numFmt = "0.00";
  sheet.getColumn("plan_pack_hours").numFmt = "0.00";
  sheet.getColumn("productivity_percent").numFmt = "0.0\"%\"";
  sheet.eachRow((row, index) => {
    if (index > 1) row.alignment = { vertical: "middle" };
  });
  const buffer = await workbook.xlsx.writeBuffer();
  const filename = from === to ? `MOL_wydajnosc_${from}.xlsx` : `MOL_wydajnosc_${from}_${to}.xlsx`;
  downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename);
}

async function exportPlansPdf(date: string, versions: ReportingPlanVersion[], selectedOnly: boolean) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  const candidates = selectedOnly ? versions.slice(0, 1) : versions;
  const elements = candidates.map(version => document.querySelector<HTMLElement>(`[data-report-plan-export="${CSS.escape(version.plan_id)}"]`)).filter((element): element is HTMLElement => Boolean(element));
  if (!elements.length) throw new Error("Brak planu gotowego do eksportu.");

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3", compress: true });
  for (let index = 0; index < elements.length; index += 1) {
    const canvas = await html2canvas(elements[index], { scale: 1.5, backgroundColor: "#ffffff", useCORS: true, logging: false });
    if (index > 0) pdf.addPage("a3", "landscape");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const ratio = Math.min((pageWidth - margin * 2) / canvas.width, (pageHeight - margin * 2) / canvas.height);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, canvas.width * ratio, canvas.height * ratio, undefined, "FAST");
  }
  const filename = selectedOnly
    ? `MOL_plan_${date}_v${candidates[0].version}.pdf`
    : `MOL_plan_${date}_wszystkie_wersje.pdf`;
  pdf.save(filename);
}

export function ReportingPanel() {
  const today = warsawBusinessDate();
  const [section, setSection] = useState<ReportingSection>("performance");
  const [rangeMode, setRangeMode] = useState<RangeMode>("day");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [performance, setPerformance] = useState<ReportingPerformanceResponse | null>(null);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceError, setPerformanceError] = useState("");
  const [planDate, setPlanDate] = useState(today);
  const [plans, setPlans] = useState<ReportingPlansResponse | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState("");
  const [exportBusy, setExportBusy] = useState<"xlsx" | "pdf" | "pdf-all" | "">("");

  const selectedPlan = useMemo(() => plans?.versions.find(version => version.plan_id === selectedPlanId) ?? null, [plans, selectedPlanId]);
  const includesToday = Boolean(performance && performance.from <= today && performance.to >= today);

  async function loadPerformance() {
    const rangeTo = rangeMode === "day" ? from : to;
    setPerformanceLoading(true);
    setPerformanceError("");
    try {
      const dates = reportingDateRange(from, rangeTo);
      if (!dates.length) throw new Error("Data „Od” nie może być późniejsza niż data „Do”.");
      const dailyReports: ReportingPerformanceResponse[] = [];
      for (let index = 0; index < dates.length; index += 4) {
        const batch = dates.slice(index, index + 4);
        const results = await Promise.all(batch.map(async date => {
          const response = await fetch(`/api/reporting/performance?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`, { cache: "no-store" });
          const data = await response.json() as ReportingPerformanceResponse | ReportingError;
          if (!response.ok || !data.ok) throw new Error(data.ok ? `${reportingDateLabel(date)}: nie udało się pobrać raportu.` : `${reportingDateLabel(date)}: ${data.message || data.error}`);
          return data;
        }));
        dailyReports.push(...results);
      }
      setPerformance({
        ok: true,
        from,
        to: rangeTo,
        generated_at: dailyReports.map(report => report.generated_at).sort().at(-1) ?? new Date().toISOString(),
        rows: dailyReports.flatMap(report => report.rows).sort((left, right) => left.business_date.localeCompare(right.business_date) || left.display_name.localeCompare(right.display_name, "pl")),
        warnings: [...new Set(dailyReports.flatMap(report => report.warnings))],
      });
    } catch (error) {
      setPerformance(null);
      setPerformanceError(error instanceof Error ? error.message : "Nie udało się pobrać raportu.");
    } finally {
      setPerformanceLoading(false);
    }
  }

  async function loadPlans() {
    setPlansLoading(true);
    setPlansError("");
    try {
      const response = await fetch(`/api/reporting/plans?date=${encodeURIComponent(planDate)}`, { cache: "no-store" });
      const data = await response.json() as ReportingPlansResponse | ReportingError;
      if (!response.ok || !data.ok) throw new Error(data.ok ? "Nie udało się pobrać historii planów." : (data.message || data.error));
      setPlans(data);
      setSelectedPlanId(data.versions.at(-1)?.plan_id ?? "");
    } catch (error) {
      setPlans(null);
      setSelectedPlanId("");
      setPlansError(error instanceof Error ? error.message : "Nie udało się pobrać historii planów.");
    } finally {
      setPlansLoading(false);
    }
  }

  async function handleExcel() {
    if (!performance?.rows.length) return;
    setExportBusy("xlsx");
    setPerformanceError("");
    try {
      await exportPerformanceExcel(performance.rows, performance.from, performance.to);
    } catch (error) {
      setPerformanceError(error instanceof Error ? error.message : "Nie udało się wygenerować XLSX.");
    } finally {
      setExportBusy("");
    }
  }

  async function handlePdf(all: boolean) {
    if (!plans || !selectedPlan) return;
    const versions = all ? plans.versions : [selectedPlan];
    setExportBusy(all ? "pdf-all" : "pdf");
    setPlansError("");
    try {
      await exportPlansPdf(plans.business_date, versions, !all);
    } catch (error) {
      setPlansError(error instanceof Error ? error.message : "Nie udało się wygenerować PDF.");
    } finally {
      setExportBusy("");
    }
  }

  return (
    <section id="reporting-panel" className="tab-panel reporting-screen" role="tabpanel" aria-labelledby="tab-reporting">
      <section className="page-intro">
        <div>
          <p className="eyebrow">READ ONLY · HISTORIA OPERACJI</p>
          <h1>Raportowanie</h1>
          <p className="subtitle">Wydajność pracowników i historyczne wersje planu bez ingerencji w bieżący planer.</p>
        </div>
        <span className="reporting-readonly-badge">Tylko odczyt</span>
      </section>

      <div className="reporting-nav" role="tablist" aria-label="Sekcje raportowania">
        <button className={`settings-nav-item${section === "performance" ? " active" : ""}`} type="button" role="tab" aria-selected={section === "performance"} onClick={() => setSection("performance")}>Wydajność</button>
        <button className={`settings-nav-item${section === "plans" ? " active" : ""}`} type="button" role="tab" aria-selected={section === "plans"} onClick={() => setSection("plans")}>Plan</button>
      </div>

      {section === "performance" ? (
        <>
          <section className="card reporting-filters">
            <div className="reporting-filter-mode" aria-label="Tryb zakresu dat">
              <button className={rangeMode === "day" ? "active" : ""} type="button" onClick={() => { setRangeMode("day"); setTo(from); }}>Jeden dzień</button>
              <button className={rangeMode === "range" ? "active" : ""} type="button" onClick={() => setRangeMode("range")}>Zakres dat</button>
            </div>
            <label>Od<input type="date" value={from} onChange={event => { const value = event.target.value; setFrom(value); if (rangeMode === "day" || value > to) setTo(value); }} /></label>
            {rangeMode === "range" && <label>Do<input type="date" min={from} value={to} onChange={event => setTo(event.target.value)} /></label>}
            <button className="button button-primary" type="button" onClick={() => void loadPerformance()} disabled={performanceLoading}>{performanceLoading ? "Pobieranie…" : "Pokaż raport"}</button>
            <button className="button button-secondary" type="button" onClick={() => void handleExcel()} disabled={!performance?.rows.length || Boolean(exportBusy)}>{exportBusy === "xlsx" ? "Tworzenie XLSX…" : "Eksportuj Excel (.xlsx)"}</button>
          </section>

          {includesToday && (
            <div className="reporting-current-day" role="status">
              <b>Dzień w trakcie — dane wykonania są częściowe.</b>
              <span>Ostatni snapshot: {formatWarsawTime(performance?.rows.find(row => row.business_date === today)?.snapshot_collected_at ?? null)}</span>
            </div>
          )}
          {performanceError && <div className="settings-alert error">{performanceError}</div>}
          {performance?.warnings.map(warning => <div className="settings-alert" key={warning}>{warning}</div>)}

          <section className="card reporting-table-card">
            <div className="section-heading">
              <div><p className="eyebrow">PLAN VS WYKONANIE</p><h2>Wydajność pracowników</h2></div>
              <span>{performance ? `${reportingDateLabel(performance.from)}${performance.from !== performance.to ? ` — ${reportingDateLabel(performance.to)}` : ""} · ${performance.rows.length} wierszy` : "Wybierz zakres"}</span>
            </div>
            <div className="reporting-table-wrap">
              <table>
                <thead><tr><th>Data</th><th>Pracownik</th><th>Plan PICK h</th><th>Plan PAK h</th><th>Wykonanie PICK</th><th>Wykonanie PAK</th><th title="(PICK + 3 × PAK) / (210 × zaplanowane godziny PICK i PAK)">Produktywność dnia</th><th>Wersja planu</th><th>Operator ES</th><th>Snapshot</th><th>Status</th></tr></thead>
                <tbody>
                  {performance?.rows.map((row, index) => (
                    <tr key={`${row.business_date}-${row.employee_key || row.operator || index}`}>
                      <td>{reportingDateLabel(row.business_date)}</td>
                      <td><strong>{row.display_name}</strong>{!row.mapped && <small className="mapping-warning">Niezmapowany operator</small>}</td>
                      <td>{formatHours(row.plan_pick_hours)}</td><td>{formatHours(row.plan_pack_hours)}</td>
                      <td>{formatInteger(row.pick_completed)}</td><td>{formatInteger(row.pack_completed)}</td>
                      <td><span className={`realization-badge ${productivityClass(productivityPercent(row))}`} title="Norma: 210 PICK/h lub 70 PAK/h; 1 PAK = 3 PICK">{formatPercent(productivityPercent(row))}</span></td>
                      <td>{row.plan_version === null ? "—" : `v${row.plan_version}`}</td>
                      <td>{row.operator || "—"}</td><td>{formatWarsawTime(row.snapshot_collected_at)}</td><td>{row.data_status}</td>
                    </tr>
                  ))}
                  {performance && performance.rows.length === 0 && <tr><td colSpan={11} className="reporting-empty">Brak danych dla wybranego zakresu.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="card reporting-filters reporting-plan-filters">
            <label>Dzień planu<input type="date" value={planDate} onChange={event => setPlanDate(event.target.value)} /></label>
            <button className="button button-primary" type="button" onClick={() => void loadPlans()} disabled={plansLoading}>{plansLoading ? "Pobieranie…" : "Pokaż wersje"}</button>
            <button className="button button-secondary" type="button" onClick={() => void handlePdf(false)} disabled={!selectedPlan || Boolean(exportBusy)}>{exportBusy === "pdf" ? "Tworzenie PDF…" : "Eksportuj PDF"}</button>
            <button className="button button-secondary" type="button" onClick={() => void handlePdf(true)} disabled={!plans?.versions.length || Boolean(exportBusy)}>{exportBusy === "pdf-all" ? "Tworzenie PDF…" : "Eksportuj wszystkie wersje do PDF"}</button>
          </section>
          {plansError && <div className="settings-alert error">{plansError}</div>}

          <section className="reporting-plan-layout">
            <div className="card reporting-version-list">
              <div className="section-heading"><div><p className="eyebrow">HISTORIA</p><h2>Wersje planu</h2></div><span>{plans?.versions.length ?? 0}</span></div>
              <div className="reporting-version-table">
                <table><thead><tr><th>Wersja</th><th>Godzina</th><th>Typ</th><th>Target</th><th>Status</th></tr></thead>
                  <tbody>{plans?.versions.map(version => (
                    <tr key={version.plan_id} className={selectedPlanId === version.plan_id ? "selected" : ""} onClick={() => setSelectedPlanId(version.plan_id)}>
                      <td><button type="button" onClick={() => setSelectedPlanId(version.plan_id)}>v{version.version}</button></td>
                      <td>{formatWarsawTime(version.generated_at)}</td><td>{version.trigger || version.mode || "—"}</td><td>{version.target_orders === null ? "—" : formatInteger(version.target_orders)}</td><td>{version.status || "—"}</td>
                    </tr>
                  ))}</tbody>
                </table>
                {plans && plans.versions.length === 0 && <div className="reporting-empty">Brak zapisanych wersji planu dla tego dnia.</div>}
              </div>
            </div>
            <div>{selectedPlan ? <PlanVersionCard version={selectedPlan} /> : <div className="card reporting-empty reporting-plan-empty">Wybierz dzień i wersję planu.</div>}</div>
          </section>

          <div className="reporting-pdf-staging" aria-hidden="true">
            {plans?.versions.map(version => <PlanVersionCard version={version} exportMode key={`export-${version.plan_id}`} />)}
          </div>
        </>
      )}
    </section>
  );
}

function PlanVersionCard({ version, exportMode = false }: { version: ReportingPlanVersion; exportMode?: boolean }) {
  const employees = useMemo(() => version.employees.map(planEmployeeToScheduleEmployee), [version.employees]);
  return (
    <section className={`card reporting-plan-preview${exportMode ? " reporting-plan-export" : ""}`} data-report-plan-export={exportMode ? version.plan_id : undefined}>
      <div className="reporting-plan-header">
        <div><p className="eyebrow">MOL // PLAN DNIA</p><h2>{reportingDateLabel(version.business_date)} · v{version.version}</h2></div>
        <dl>
          <div><dt>Wygenerowano</dt><dd>{formatWarsawTime(version.generated_at)}</dd></div>
          <div><dt>Target</dt><dd>{version.target_orders === null ? "—" : formatInteger(version.target_orders)}</dd></div>
          <div><dt>planning_from</dt><dd>{version.planning_from || "—"}</dd></div>
          <div><dt>Trigger / typ</dt><dd>{[version.trigger, version.trigger_ref || version.mode].filter(Boolean).join(" · ") || "—"}</dd></div>
          <div><dt>Status</dt><dd>{version.status || "—"}</dd></div>
        </dl>
      </div>
      <div className="reporting-plan-legend"><span><i className="legend-swatch pick" />PICK</span><span><i className="legend-swatch pack" />PAK</span><span><i className="legend-swatch break" />Przerwa</span><span><i className="legend-swatch duty" />Dyżur</span><span><i className="legend-swatch warehouse" />Magazyn / inne</span><span>◆ blok ręczny</span></div>
      <div className="reporting-schedule-readonly">
        <Schedule employees={employees} date={version.business_date} collapsed={false} editingEnabled={false} onBlockClick={() => undefined} />
      </div>
    </section>
  );
}
