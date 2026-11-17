"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { ManualPlanDialog } from "@/components/manual-plan-dialog";
import { OrdersView } from "@/components/orders-view";
import { ReportingPanel } from "@/components/reporting-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { SettingsPinDialog } from "@/components/settings-pin-dialog";
import { WorkPlan } from "@/components/work-plan";
import { formatWarsawSourceTime } from "@/lib/live-update";
import { DEFAULT_PLANNING_AUTOMATION_SETTINGS, normalizePlanningAutomationSettings } from "@/lib/planning-settings";
import type { ActivityBlock, AppTab, Employee, EmployeeProfile, ExecutionSnapshotError, ExecutionSnapshotResponse, GeneratedPlanError, GeneratedPlanResponse, LatestGeneratedPlanResponse, OrdersDemandResponse, OrdersDemandSnapshot, PlanManualOverride, PlannerNorms, PlanningAutomationSettings } from "@/types/plan";

type ScheduleEntry = { id: string; name: string; area: string; start: string | null; end: string | null; duty: boolean; absence: string | null };
type ScheduleResponse = { ok: boolean; error?: string; date: string; version: number | null; source_sheet: string | null; employees: ScheduleEntry[] };
type ConfigResponse = { ok: boolean; error?: string; profiles: EmployeeProfile[]; norms: PlannerNorms; planning?: PlanningAutomationSettings; version: number };

const defaultNorms: PlannerNorms = { pick_per_hour: 210, pack_per_hour: 70, pick_seconds: 22, pack_seconds: 50 };
const EXECUTION_REFRESH_MS = 60 * 1000;
const PLAN_REFRESH_MS = 5 * 60 * 1000;
const DEMAND_REFRESH_MS = 60 * 1000;
const leaderKeys = new Set(["magda_w", "aso", "alina"]);
const receivingKeys = new Set(["mateusz", "nikita", "murat"]);

function defaultGroup(key: string) {
  return leaderKeys.has(key) ? "Lider / Specjalista" : receivingKeys.has(key) ? "Przyjęcia" : "Wydanie";
}

function buildWorkTarget(demand: OrdersDemandSnapshot | null) {
  if (!demand) return { plan: null as number | null, current: null as number | null, difference: null as number | null };

  const plan = demand.required_today_baseline;
  const current = demand.corrected_required_today;
  return {
    plan,
    current,
    difference: typeof plan === "number" && typeof current === "number" ? current - plan : null,
  };
}

export function PlanDashboard() {
  const [activeTab, setActiveTab] = useState<AppTab>("work");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Warsaw", year: "numeric", month: "2-digit", day: "2-digit" }));
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([]);
  const [scheduleVersion, setScheduleVersion] = useState<number | null>(null);
  const [sourceSheet, setSourceSheet] = useState<string | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
  const [norms, setNorms] = useState<PlannerNorms>(defaultNorms);
  const [planningSettings, setPlanningSettings] = useState<PlanningAutomationSettings>(DEFAULT_PLANNING_AUTOMATION_SETTINGS);
  const [configVersion, setConfigVersion] = useState(0);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const [reload, setReload] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState("");
  const [demand, setDemand] = useState<OrdersDemandSnapshot | null>(null);
  const [demandLoading, setDemandLoading] = useState(true);
  const [demandError, setDemandError] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<GeneratedPlanResponse | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planRestoreLoading, setPlanRestoreLoading] = useState(true);
  const [planRestoreError, setPlanRestoreError] = useState("");
  const [execution, setExecution] = useState<ExecutionSnapshotResponse | null>(null);
  const [executionLoading, setExecutionLoading] = useState(true);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<{ employee: Employee; block: ActivityBlock } | null>(null);
  const [settingsPinOpen, setSettingsPinOpen] = useState(false);
  const [settingsPinBusy, setSettingsPinBusy] = useState(false);
  const [settingsPinError, setSettingsPinError] = useState("");
  const latestPlanRequest = useRef(0);
  const demandSourceTime = formatWarsawSourceTime(demand?.actual_as_of ?? demand?.source_as_of);
  const executionSourceTime = formatWarsawSourceTime(execution?.latest?.collected_at);

  useEffect(() => {
    void fetch("/api/settings-access", { method: "DELETE" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function readConfig() {
      setConfigLoading(true);
      try {
        const res = await fetch("/api/config", { cache: "no-store", signal: controller.signal });
        const data = await res.json() as ConfigResponse;
        if (!res.ok || !data.ok || !Array.isArray(data.profiles)) throw new Error(data.error || "Nie udało się pobrać ustawień.");
        setProfiles(data.profiles);
        setNorms(data.norms);
        setPlanningSettings(normalizePlanningAutomationSettings(data.planning));
        setConfigVersion(data.version);
        setConfigError("");
      } catch (err) {
        if (!controller.signal.aborted) setConfigError(err instanceof Error ? err.message : "Brak konfiguracji.");
      } finally {
        if (!controller.signal.aborted) setConfigLoading(false);
      }
    }
    readConfig();
    return () => controller.abort();
  }, [reload]);

  useEffect(() => {
    const controller = new AbortController();
    async function readSchedule() {
      setScheduleLoading(true);
      try {
        const response = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json() as ScheduleResponse;
        if (!response.ok || !result.ok) throw new Error(result.error || "Nie udało się pobrać grafiku.");
        setSchedule(result.employees ?? []);
        setScheduleVersion(result.version);
        setSourceSheet(result.source_sheet);
      } catch (err) {
        if (!controller.signal.aborted) {
          setSchedule([]);
          setScheduleVersion(null);
          setSourceSheet(null);
          setToast(err instanceof Error ? err.message : "Błąd grafiku.");
        }
      } finally {
        if (!controller.signal.aborted) setScheduleLoading(false);
      }
    }
    readSchedule();
    return () => controller.abort();
  }, [date, reload]);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;

    async function readDemand(initial: boolean) {
      if (inFlight) return;
      inFlight = true;
      if (initial) setDemandLoading(true);
      try {
        const response = await fetch(`/api/orders?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as OrdersDemandResponse;
        if (!response.ok || !result.ok) throw new Error(result.ok ? "Nie udało się pobrać planu zamówień." : result.error);
        setDemand(result);
        setDemandError("");
      } catch (err) {
        if (!controller.signal.aborted && initial) {
          setDemand(null);
          setDemandError(err instanceof Error ? err.message : "Brak planu zamówień.");
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted && initial) setDemandLoading(false);
      }
    }

    void readDemand(true);
    const timer = window.setInterval(() => { void readDemand(false); }, DEMAND_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [date, reload]);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;

    async function readExecution(initial: boolean) {
      if (inFlight) return;
      inFlight = true;
      if (initial) setExecutionLoading(true);
      try {
        const response = await fetch(`/api/execution?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as ExecutionSnapshotResponse | ExecutionSnapshotError;
        if (!response.ok || !result.ok) throw new Error(result.ok ? "Nie udało się pobrać wykonania ES." : (result.message || result.error));
        setExecution(result);
      } catch {
        if (!controller.signal.aborted && initial) setExecution(null);
      } finally {
        inFlight = false;
        if (!controller.signal.aborted && initial) setExecutionLoading(false);
      }
    }
    void readExecution(true);
    const timer = window.setInterval(() => { void readExecution(false); }, EXECUTION_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [date, reload]);

  const employees = useMemo<Employee[]>(() => {
    const profileMap = new Map(profiles.map(p => [p.employee_key, p]));
    return schedule
      .filter(row => row.start && row.end && profileMap.get(row.id)?.active !== false)
      .map(row => ({
        id: row.id,
        name: row.name,
        group: profileMap.get(row.id)?.group_name || defaultGroup(row.id),
        duty: Boolean(row.duty),
        progress: { pick: 0, pack: 0 },
        blocks: [{ start: row.start!, end: row.end!, kind: "presence" as const }],
      }));
  }, [profiles, schedule]);

  useEffect(() => {
    const controller = new AbortController();
    let inFlight = false;

    async function readLatestPlan(initial: boolean) {
      if (inFlight) return;
      inFlight = true;
      const requestId = ++latestPlanRequest.current;
      if (initial) {
        setPlanRestoreLoading(true);
        setPlanRestoreError("");
      }
      try {
        const response = await fetch(`/api/plan?date=${encodeURIComponent(date)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json() as LatestGeneratedPlanResponse | GeneratedPlanError;
        if (!response.ok || !result.ok) {
          throw new Error(result.ok ? "Nie udało się odczytać zapisanego planu." : (result.message || result.error));
        }
        if (requestId === latestPlanRequest.current) {
          setGeneratedPlan(result.plan);
          setPlanRestoreError("");
        }
      } catch (err) {
        if (!controller.signal.aborted && requestId === latestPlanRequest.current && initial) {
          const message = err instanceof Error ? err.message : "Nie udało się odczytać zapisanego planu.";
          setPlanRestoreError(message);
          setGeneratedPlan(null);
        }
      } finally {
        inFlight = false;
        if (!controller.signal.aborted && requestId === latestPlanRequest.current && initial) {
          setPlanRestoreLoading(false);
        }
      }
    }

    void readLatestPlan(true);
    const timer = window.setInterval(() => { void readLatestPlan(false); }, PLAN_REFRESH_MS);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [date, reload]);

  const currentGeneratedPlan = generatedPlan?.business_date === date ? generatedPlan : null;
  const workTarget = buildWorkTarget(demand);
  const targetOrders = workTarget.current;
  const pickFactor = norms.pick_per_hour * norms.pick_seconds / 3600;
  const livePickRemaining = targetOrders !== null && execution?.latest
    ? Math.max(0, targetOrders * pickFactor - execution.latest.pick_completed)
    : currentGeneratedPlan?.summary.initial_pick_remaining ?? null;
  const livePackRemaining = targetOrders !== null && execution?.latest
    ? Math.max(0, targetOrders - execution.latest.pack_completed)
    : currentGeneratedPlan?.summary.initial_pack_remaining ?? null;

  const plannedEmployees = useMemo<Employee[]>(() => {
    if (!currentGeneratedPlan) return employees;
    const scheduleMap = new Map(schedule.map(row => [row.id, row]));
    return currentGeneratedPlan.employees.map(person => ({
      id: person.employee_key,
      name: person.display_name,
      group: person.group_name,
      duty: Boolean(scheduleMap.get(person.employee_key)?.duty),
      progress: { pick: 0, pack: 0 },
      blocks: person.blocks.map(block => ({
        start: block.start,
        end: block.end,
        kind: block.activity,
        source: block.source,
        reason: block.reason,
        locked: block.locked,
        override_id: block.override_id,
      })),
    }));
  }, [currentGeneratedPlan, employees, schedule]);

  async function generatePlan() {
    if (planLoading || !demand || demand.status !== "ready") return;
    latestPlanRequest.current += 1;
    setPlanLoading(true);
    setToast("");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, demand, trigger: "BUTTON", trigger_ref: "ui_button" }),
      });
      const result = await response.json() as GeneratedPlanResponse | GeneratedPlanError;
      if (!response.ok || !result.ok) {
        throw new Error(result.ok ? "Nie udało się wygenerować planu." : (result.message || result.error));
      }
      setGeneratedPlan(result);
      setActiveTab("work");
      const detail = result.status === "DRAFT_READY"
        ? "Plan roboczy wygenerowany."
        : `Plan wygenerowany z brakiem capacity: ${result.shortages.map(item => `${item.process} ${item.missing_rbh} RBH`).join(" · ")}`;
      setToast(detail);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Błąd generatora planu.");
    } finally {
      setPlanLoading(false);
    }
  }

  async function recalculateAfterCutoff() {
    if (planLoading) throw new Error("Plan jest już przeliczany.");
    latestPlanRequest.current += 1;
    setPlanLoading(true);
    setToast("");
    try {
      const demandResponse = await fetch(`/api/orders?date=${encodeURIComponent(date)}&cutoff_refresh=${Date.now()}`, { cache: "no-store" });
      const freshDemand = await demandResponse.json() as OrdersDemandResponse;
      if (!demandResponse.ok || !freshDemand.ok || freshDemand.status !== "ready") {
        throw new Error(freshDemand.ok ? "DAY DEMAND nie jest gotowy do przeliczenia." : freshDemand.error);
      }
      setDemand(freshDemand);

      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, demand: freshDemand, trigger: "BUTTON", trigger_ref: "ui_cutoff" }),
      });
      const result = await response.json() as GeneratedPlanResponse | GeneratedPlanError;
      if (!response.ok || !result.ok) {
        throw new Error(result.ok ? "Nie udało się przeliczyć planu po zmianie cut-offu." : (result.message || result.error));
      }
      setGeneratedPlan(result);
      setActiveTab("work");
      setToast("Skrócony cut-off zapisany. Target, RBH i przyszła część planu zostały przeliczone.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Nie udało się przeliczyć planu po zmianie cut-offu.";
      setToast(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setPlanLoading(false);
    }
  }

  function openManualCorrection(employeeId: string, blockIndex: number) {
    if (!currentGeneratedPlan || planLoading) return;
    const employee = plannedEmployees.find(item => item.id === employeeId);
    const block = employee?.blocks[blockIndex];
    if (!employee || !block) return;
    if (block.kind === "duty") {
      setToast("Dyżur pochodzi z grafiku i nie podlega ręcznej korekcie planu.");
      return;
    }
    setEditTarget({ employee, block });
  }

  async function submitManualCorrection(override: PlanManualOverride, removeOverrideIds: string[] = []) {
    if (planLoading || !demand || demand.status !== "ready") return;
    latestPlanRequest.current += 1;
    setPlanLoading(true);
    setToast("");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          demand,
          trigger: "MANUAL",
          trigger_ref: "ui_manual",
          manual_overrides: removeOverrideIds.length ? [] : [override],
          remove_override_ids: removeOverrideIds,
        }),
      });
      const result = await response.json() as GeneratedPlanResponse | GeneratedPlanError;
      if (!response.ok || !result.ok) {
        throw new Error(result.ok ? "Nie udało się zapisać korekty." : (result.message || result.error));
      }
      setGeneratedPlan(result);
      setEditTarget(null);
      setActiveTab("work");
      setToast(removeOverrideIds.length
        ? "Ręczna blokada zdjęta. Pozostała część planu została przeliczona."
        : "Ręczna korekta zapisana. Pozostałe bloki planu nie zostały zmienione.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Błąd ręcznej korekty planu.");
    } finally {
      setPlanLoading(false);
    }
  }

  async function unlockSettings(pin: string) {
    if (settingsPinBusy) return;
    setSettingsPinBusy(true);
    setSettingsPinError("");
    try {
      const response = await fetch("/api/settings-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Nieprawidłowy PIN.");
      setSettingsPinOpen(false);
      setActiveTab("settings");
    } catch (err) {
      setSettingsPinError(err instanceof Error ? err.message : "Nie udało się odblokować ustawień.");
    } finally {
      setSettingsPinBusy(false);
    }
  }

  function selectMainTab(tab: AppTab) {
    setToast("");
    if (tab === "settings") {
      if (activeTab === "settings") return;
      setSettingsPinError("");
      setSettingsPinOpen(true);
      return;
    }
    if (activeTab === "settings") {
      void fetch("/api/settings-access", { method: "DELETE" }).catch(() => undefined);
    }
    setSettingsPinOpen(false);
    setActiveTab(tab);
  }

  async function refresh() {
    if (refreshLoading) return;
    setRefreshLoading(true);
    setToast("");
    try {
      const response = await fetch("/api/execution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const result = await response.json() as { ok?: boolean; error?: string; message?: string };
      if (!response.ok || !result.ok) throw new Error(result.message || result.error || "Nie udało się odświeżyć danych.");
      setReload(x => x + 1);
      setToast("Dane live odświeżone z EasyStorage.");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Nie udało się odświeżyć danych.");
    } finally {
      setRefreshLoading(false);
    }
  }
  const navItems: { tab: AppTab; title: string; hint?: string }[] = [
    { tab: "work", title: "Plan pracy" },
    { tab: "orders", title: "Zamówienia" },
    { tab: "reporting", title: "Raportowanie" },
    { tab: "settings", title: "Ustawienia" },
  ];

  return (
    <>
      <div className="utility-bar">
        <span>ESTYL · OPERACJE MAGAZYNOWE</span>
        <span className="utility-status"><i /><span>{scheduleLoading ? "Pobieranie grafiku…" : scheduleVersion ? "Grafik źródłowy aktywny" : "Brak grafiku dla daty"}</span></span>
        <span>{sourceSheet || "MOL / Plan dnia"}</span>
      </div>
      <header className="site-header">
        <div className="brand" aria-label="ESTYL.PL">
          <Image src="/estyl-pl-logo.png" alt="ESTYL.PL" width={320} height={102} priority />
        </div>
        <div className="header-divider" />
        <div className="module-name"><span className="module-eyebrow">MOL / WYDANIE</span><strong>Plan dnia</strong></div>
        <div className="header-actions">
          <label className="date-picker">Dzień pracy
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          {activeTab !== "reporting" && <div className="live-refresh-control">
            <button className="button button-secondary" type="button" disabled={refreshLoading || scheduleLoading || configLoading} onClick={() => { void refresh(); }}>{refreshLoading ? "Odświeżanie…" : "↻ Odśwież dane"}</button>
            <small>
              Auto co 30 min (06:00–18:00) · ostatnie: zam. {demandSourceTime ?? "—"} · ES {executionSourceTime ?? "—"}
            </small>
          </div>}
          {activeTab !== "reporting" && <button className="button button-primary" type="button" disabled={planLoading || scheduleLoading || configLoading || demandLoading || executionLoading || !demand || demand.status !== "ready"} onClick={generatePlan}>{planLoading ? "Przeliczanie…" : "Przelicz plan"}</button>}
          <form action="/api/auth/logout" method="post" className="logout-form">
            <button className="button button-secondary logout-button" type="submit">Wyloguj</button>
          </form>
        </div>
      </header>
      <main className="page-shell">
        <nav className="page-tabs" role="tablist" aria-label="Widoki planu dnia">
          {navItems.map(({ tab, title, hint }) => (
            <button key={tab} className={`page-tab${activeTab === tab ? " is-active" : ""}`}
              type="button" role="tab" id={`tab-${tab}`}
              aria-selected={activeTab===tab} aria-controls={`${tab}-panel`}
              onClick={() => selectMainTab(tab)}>
              {title} {hint && <span className="tab-hint">{hint}</span>}
            </button>
          ))}
        </nav>

        {activeTab === "work" && (
          <WorkPlan employees={plannedEmployees} profiles={profiles} execution={execution} norms={norms} date={date} targetPlan={workTarget.plan} targetCurrent={workTarget.current} targetDifference={workTarget.difference} pickRemaining={livePickRemaining} packRemaining={livePackRemaining} planSummary={currentGeneratedPlan?.summary ?? null} planStatus={currentGeneratedPlan?.status ?? null} planGeneratedAt={currentGeneratedPlan?.generated_at ?? null} planningFrom={currentGeneratedPlan?.planning_from ?? null} planAvailable={Boolean(currentGeneratedPlan)} planRestoreLoading={planRestoreLoading} planRestoreError={planRestoreError} collapsed={collapsed} editingEnabled={Boolean(currentGeneratedPlan) && !planLoading}
            onToggleCollapsed={() => setCollapsed(x => !x)}
            onBlockClick={(employeeId, blockIndex) => openManualCorrection(employeeId, blockIndex)}/>
        )}
        {activeTab === "orders" && <OrdersView demand={demand} loading={demandLoading} error={demandError} />}
        {activeTab === "reporting" && <ReportingPanel />}
        {activeTab === "settings" && <SettingsPanel profiles={profiles} norms={norms} planning={planningSettings} version={configVersion}
          date={date} loading={configLoading} error={configError} onReload={refresh} onCutoffApplied={recalculateAfterCutoff}/>} 

        <footer className="page-footer">
          <span>ESTYL.PL <b>·</b> MOL Plan Dnia</span>
          <span>{scheduleVersion ? `Grafik v${scheduleVersion} · ${sourceSheet || ""}` : "Brak danych dla wybranego dnia"} · konfiguracja v{configVersion || "—"}</span>
        </footer>
      </main>
      {settingsPinOpen && (
        <SettingsPinDialog
          busy={settingsPinBusy}
          error={settingsPinError}
          onClose={() => { if (!settingsPinBusy) { setSettingsPinOpen(false); setSettingsPinError(""); } }}
          onSubmit={pin => { void unlockSettings(pin); }}
        />
      )}
      {editTarget && (
        <ManualPlanDialog
          employee={editTarget.employee}
          block={editTarget.block}
          profile={profiles.find(profile => profile.employee_key === editTarget.employee.id) ?? null}
          saving={planLoading}
          onClose={() => setEditTarget(null)}
          onSave={override => { void submitManualCorrection(override); }}
          onRemove={overrideId => {
            const placeholder: PlanManualOverride = {
              override_id: overrideId,
              employee_key: editTarget.employee.id,
              start: editTarget.block.start,
              end: editTarget.block.end,
              activity: editTarget.block.kind,
              locked: true,
              created_at: new Date().toISOString(),
              reason: editTarget.block.reason || "Korekta lidera",
            };
            void submitManualCorrection(placeholder, [overrideId]);
          }}
        />
      )}
      {toast && <div className="toast visible" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}
