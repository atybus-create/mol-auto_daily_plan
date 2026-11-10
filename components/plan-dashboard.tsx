"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { OrdersView } from "@/components/orders-view";
import { SettingsPanel } from "@/components/settings-panel";
import { WorkPlan } from "@/components/work-plan";
import type { AppTab, Employee, EmployeeProfile, OrdersDemandResponse, OrdersDemandSnapshot, PlannerNorms } from "@/types/plan";

type ScheduleEntry = { id: string; name: string; area: string; start: string | null; end: string | null; duty: boolean; absence: string | null };
type ScheduleResponse = { ok: boolean; error?: string; date: string; version: number | null; source_sheet: string | null; employees: ScheduleEntry[] };
type ConfigResponse = { ok: boolean; error?: string; profiles: EmployeeProfile[]; norms: PlannerNorms; version: number };

const defaultNorms: PlannerNorms = { pick_per_hour: 210, pack_per_hour: 70, pick_seconds: 22, pack_seconds: 50 };
const leaderKeys = new Set(["magda_w", "aso", "alina"]);
const receivingKeys = new Set(["mateusz", "nikita", "murat"]);

function defaultGroup(key: string) {
  return leaderKeys.has(key) ? "Lider / Specjalista" : receivingKeys.has(key) ? "Przyjęcia" : "Wydanie";
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
  const [configVersion, setConfigVersion] = useState(0);
  const [configLoading, setConfigLoading] = useState(true);
  const [configError, setConfigError] = useState("");
  const [reload, setReload] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState("");
  const [demand, setDemand] = useState<OrdersDemandSnapshot | null>(null);
  const [demandLoading, setDemandLoading] = useState(true);
  const [demandError, setDemandError] = useState("");

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
    async function readDemand() {
      setDemandLoading(true);
      try {
        const response = await fetch(`/api/orders?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as OrdersDemandResponse;
        if (!response.ok || !result.ok) throw new Error(result.ok ? "Nie udało się pobrać planu zamówień." : result.error);
        setDemand(result);
        setDemandError("");
      } catch (err) {
        if (!controller.signal.aborted) {
          setDemand(null);
          setDemandError(err instanceof Error ? err.message : "Brak planu zamówień.");
        }
      } finally {
        if (!controller.signal.aborted) setDemandLoading(false);
      }
    }
    readDemand();
    return () => controller.abort();
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

  const refresh = () => { setReload(x => x + 1); };
  const navItems: { tab: AppTab; title: string; hint?: string }[] = [
    { tab: "work", title: "Plan pracy" },
    { tab: "orders", title: "Zamówienia", hint: "06:00 + realny spływ" },
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
          <button className="button button-secondary" type="button" disabled={scheduleLoading || configLoading} onClick={refresh}>↻ Odśwież dane</button>
          <button className="button button-primary" type="button" disabled title="Uruchomienie po podłączeniu algorytmu planowania">Przelicz plan</button>
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
              onClick={() => { setActiveTab(tab); setToast(""); }}>
              {title} {hint && <span className="tab-hint">{hint}</span>}
            </button>
          ))}
        </nav>

        {activeTab === "work" && (
          <WorkPlan employees={employees} norms={norms} date={date} demand={demand} collapsed={collapsed} editingEnabled={false}
            onToggleCollapsed={() => setCollapsed(x => !x)}
            onBlockClick={() => setToast("Edycja planu będzie możliwa po podłączeniu algorytmu.")}/>
        )}
        {activeTab === "orders" && <OrdersView demand={demand} loading={demandLoading} error={demandError} />}
        {activeTab === "settings" && <SettingsPanel profiles={profiles} norms={norms} version={configVersion}
          loading={configLoading} error={configError} onReload={refresh}/>}

        <footer className="page-footer">
          <span>ESTYL.PL <b>·</b> MOL Plan Dnia</span>
          <span>{scheduleVersion ? `Grafik v${scheduleVersion} · ${sourceSheet || ""}` : "Brak danych dla wybranego dnia"} · konfiguracja v{configVersion || "—"}</span>
        </footer>
      </main>
      {toast && <div className="toast visible" role="status" aria-live="polite">{toast}</div>}
    </>
  );
}
