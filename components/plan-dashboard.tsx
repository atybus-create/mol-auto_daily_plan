"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { OrdersView } from "@/components/orders-view";
import { WorkPlan } from "@/components/work-plan";
import { DEMO_DATE, demoOrderFlow } from "@/lib/demo-data";
import { activityLabels } from "@/lib/plan-utils";
import type { ActivityKind, AppTab, Employee } from "@/types/plan";

type ScheduleApiEmployee = { id: string; name: string; area: string; start: string | null; end: string | null; duty: boolean; absence: string | null };
type ScheduleApiResponse = { ok: boolean; error?: string; date: string; version: number | null; snapshot_at: string | null; source_sheet: string | null; employees: ScheduleApiEmployee[] };

type Selection = {
  employeeId: string;
  blockIndex: number;
  returnFocus: HTMLButtonElement;
};

export function PlanDashboard() {
  const [activeTab, setActiveTab] = useState<AppTab>("work");
  const [date, setDate] = useState(DEMO_DATE);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [scheduleMeta, setScheduleMeta] = useState<{ version: number | null; snapshotAt: string | null; sourceSheet: string | null }>({ version: null, snapshotAt: null, sourceSheet: null });
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleReload, setScheduleReload] = useState(0);
  const [editingEnabled, setEditingEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [toast, setToast] = useState("");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityKind | "remove">("pick");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef<Record<AppTab, HTMLButtonElement | null>>({ work: null, orders: null });

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3300);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSchedule() {
      setScheduleLoading(true);
      try {
        const response = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date }),
          signal: controller.signal,
        });
        const result = await response.json() as ScheduleApiResponse;

        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Nie udało się pobrać grafiku.");
        }

        const mapped: Employee[] = result.employees
          .filter((employee) => employee.start && employee.end)
          .map((employee) => ({
            id: employee.id,
            name: employee.name,
            group: employee.area === "PRZYJĘCIE" ? "Przyjęcie" : employee.area === "WYDANIE" ? "Wydanie" : employee.area,
            progress: { pick: 0, pack: 0 },
            blocks: [{
              start: employee.start!,
              end: employee.end!,
              kind: employee.duty ? "duty" : "presence",
            }],
          }));

        setEmployees(mapped);
        setScheduleMeta({ version: result.version, snapshotAt: result.snapshot_at, sourceSheet: result.source_sheet });
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setEmployees([]);
          setScheduleMeta({ version: null, snapshotAt: null, sourceSheet: null });
          showToast(error instanceof Error ? error.message : "Nie udało się pobrać grafiku.");
        }
      } finally {
        if (!controller.signal.aborted) setScheduleLoading(false);
      }
    }

    loadSchedule();
    return () => controller.abort();
  }, [date, scheduleReload]);

  function showToast(message: string) {
    setToast(message);
  }

  function changeTab(nextTab: AppTab) {
    setActiveTab(nextTab);
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const nextTab: AppTab = activeTab === "work" ? "orders" : "work";
    setActiveTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  }

  function openBlockEditor(employeeId: string, blockIndex: number, button: HTMLButtonElement) {
    if (!editingEnabled) {
      showToast("Przydział czynności będzie edytowalny po uruchomieniu modułu planera.");
      return;
    }
    const employee = employees.find((item) => item.id === employeeId);
    const block = employee?.blocks[blockIndex];
    if (!block) return;
    setSelection({ employeeId, blockIndex, returnFocus: button });
    setSelectedActivity(block.kind);
    dialogRef.current?.showModal();
  }

  function closeDialog() {
    dialogRef.current?.close();
  }

  function saveActivity() {
    if (!selection) return;
    setEmployees((currentEmployees) => currentEmployees.map((employee) => {
      if (employee.id !== selection.employeeId) return employee;
      const nextBlocks = [...employee.blocks];
      if (selectedActivity === "remove") nextBlocks.splice(selection.blockIndex, 1);
      else nextBlocks[selection.blockIndex] = { ...nextBlocks[selection.blockIndex], kind: selectedActivity };
      return { ...employee, blocks: nextBlocks };
    }));
    dialogRef.current?.close();
    showToast("Zmiana jest lokalna. Zapis planu do backendu będzie kolejnym etapem.");
  }

  function restoreDialogFocus() {
    selection?.returnFocus.focus();
    setSelection(null);
  }

  const selectedEmployee = selection ? employees.find((employee) => employee.id === selection.employeeId) : null;

  return (
    <>
      <div className="utility-bar">
        <span>ESTYL · OPERACJE MAGAZYNOWE</span>
        <span className="utility-status"><i /><span>{scheduleLoading ? "Pobieranie grafiku…" : "Grafik źródłowy aktywny"}</span></span>
        <span>{scheduleMeta.sourceSheet ?? "Plan roboczy"}</span>
      </div>

      <header className="site-header">
        <div className="brand" aria-label="ESTYL.PL">
          <Image src="/estyl-pl-logo.png" alt="ESTYL.PL" width={320} height={102} priority />
        </div>
        <div className="header-divider" />
        <div className="module-name"><span className="module-eyebrow">MOL / WYDANIE</span><strong>Plan dnia</strong></div>
        <div className="header-actions">
          <label className="date-picker">Dzień pracy
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                showToast("Pobieram grafik dla wybranego dnia.");
              }}
            />
          </label>
          <button className="button button-secondary" type="button" disabled={scheduleLoading} onClick={() => { setScheduleReload((value) => value + 1); showToast("Odświeżam grafik."); }}><span aria-hidden="true">↻</span> Odśwież grafik</button>
          <button
            className="button button-primary"
            type="button"
            disabled
            title="Edycja zostanie włączona po uruchomieniu algorytmu planowania."
          >
            <span aria-hidden="true">✎</span> Edytuj plan
          </button>
          <form action="/api/auth/logout" method="post" className="logout-form">
            <button className="button button-secondary logout-button" type="submit">Wyloguj</button>
          </form>
        </div>
      </header>

      <main className="page-shell">
        <nav className="page-tabs" role="tablist" aria-label="Widoki planu dnia">
          <button
            className={`page-tab${activeTab === "work" ? " is-active" : ""}`}
            id="tab-work"
            type="button"
            role="tab"
            aria-selected={activeTab === "work"}
            aria-controls="work-panel"
            tabIndex={activeTab === "work" ? 0 : -1}
            ref={(node) => { tabRefs.current.work = node; }}
            onClick={() => changeTab("work")}
            onKeyDown={handleTabKeyDown}
          >
            Plan pracy
          </button>
          <button
            className={`page-tab${activeTab === "orders" ? " is-active" : ""}`}
            id="tab-orders"
            type="button"
            role="tab"
            aria-selected={activeTab === "orders"}
            aria-controls="orders-panel"
            tabIndex={activeTab === "orders" ? 0 : -1}
            ref={(node) => { tabRefs.current.orders = node; }}
            onClick={() => changeTab("orders")}
            onKeyDown={handleTabKeyDown}
          >
            Zamówienia <span className="tab-hint">plan i napływ</span>
          </button>
        </nav>

        {activeTab === "work" ? (
          <WorkPlan
            employees={employees}
            date={date}
            collapsed={collapsed}
            editingEnabled={editingEnabled}
            onToggleCollapsed={() => setCollapsed((value) => !value)}
            onBlockClick={openBlockEditor}
          />
        ) : (
          <OrdersView flow={demoOrderFlow} />
        )}

        <footer className="page-footer"><span>ESTYL.PL <b>·</b> MOL Plan Dnia</span><span>{scheduleMeta.version ? `Grafik v${scheduleMeta.version} · ${scheduleMeta.sourceSheet ?? ""}` : "Brak danych grafiku dla wybranej daty"}</span></footer>
      </main>

      <dialog ref={dialogRef} className="activity-dialog" onClose={restoreDialogFocus} aria-labelledby="dialog-title">
        <button className="dialog-close" type="button" aria-label="Zamknij" onClick={closeDialog}>×</button>
        <p className="eyebrow">EDYCJA BLOKU</p>
        <h2 id="dialog-title">{selectedEmployee?.name ?? "Pracownik"} · wybierz czynność</h2>
        <label htmlFor="activity-select">Czynność</label>
        <select id="activity-select" value={selectedActivity} onChange={(event) => setSelectedActivity(event.target.value as ActivityKind | "remove")}>
          {(Object.entries(activityLabels) as [ActivityKind, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          <option value="remove">Usuń przydział</option>
        </select>
        <div className="dialog-actions"><button className="button button-secondary" type="button" onClick={closeDialog}>Anuluj</button><button className="button button-primary" type="button" onClick={saveActivity}>Zapisz zmianę</button></div>
      </dialog>

      <div className={`toast${toast ? " visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </>
  );
}
