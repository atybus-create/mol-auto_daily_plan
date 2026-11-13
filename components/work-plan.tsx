import { Schedule } from "@/components/schedule";
import {
  dailyWorkedHours,
  formatLongDate,
  formatNumber,
  targetFor,
} from "@/lib/plan-utils";
import { buildOperatorPerformance, type OperatorMapping, type ProcessPerformance } from "@/lib/operator-performance";
import type { Employee, EmployeeProfile, ExecutionSnapshotResponse, GeneratedPlanSummary, ProcessKind, PlannerNorms } from "@/types/plan";

type WorkPlanProps = {
  employees: Employee[];
  profiles: EmployeeProfile[];
  execution: ExecutionSnapshotResponse | null;
  norms: PlannerNorms;
  date: string;
  targetPlan: number | null;
  targetCurrent: number | null;
  targetDifference: number | null;
  pickRemaining: number | null;
  packRemaining: number | null;
  planSummary: GeneratedPlanSummary | null;
  planStatus: "DRAFT_READY" | "CAPACITY_SHORTAGE" | null;
  planGeneratedAt: string | null;
  planAvailable: boolean;
  planRestoreLoading: boolean;
  planRestoreError: string;
  collapsed: boolean;
  editingEnabled: boolean;
  onToggleCollapsed: () => void;
  onBlockClick: (employeeId: string, blockIndex: number, button: HTMLButtonElement) => void;
};

const processes: ProcessKind[] = ["pick", "pack"];

export function WorkPlan({
  employees,
  profiles,
  execution,
  norms,
  date,
  targetPlan,
  targetCurrent,
  targetDifference,
  pickRemaining,
  packRemaining,
  planSummary,
  planStatus,
  planGeneratedAt,
  planAvailable,
  planRestoreLoading,
  planRestoreError,
  collapsed,
  editingEnabled,
  onToggleCollapsed,
  onBlockClick,
}: WorkPlanProps) {
  const hasOperationalBlocks = employees.some((employee) =>
    employee.blocks.some((block) => block.kind === "pick" || block.kind === "pack"),
  );
  const hasSavedPlan = planAvailable;

  const totals = employees.reduce(
    (result, employee) => ({
      pickGoal: result.pickGoal + targetFor(employee, "pick", norms),
      packGoal: result.packGoal + targetFor(employee, "pack", norms),
      hours: result.hours + dailyWorkedHours(employee),
    }),
    { pickGoal: 0, packGoal: 0, hours: 0 },
  );

  const performance = buildOperatorPerformance(employees, profiles, execution, norms, date);

  const executionTimestamp = formatWarsawTimestamp(execution?.latest?.collected_at ?? null);
  const nextExecutionTimestamp = formatWarsawTimestamp(execution?.latest?.next_refresh_at ?? execution?.refresh?.next_refresh_at ?? null);
  const executionStatus = describeExecution(execution);

  const pickDemandRbh = targetCurrent !== null
    ? (targetCurrent * norms.pick_per_hour * norms.pick_seconds / 3600) / norms.pick_per_hour
    : null;
  const packDemandRbh = targetCurrent !== null
    ? targetCurrent / norms.pack_per_hour
    : null;
  const pickScheduledRbh = planSummary?.planned_pick_rbh ?? null;
  const packScheduledRbh = planSummary?.planned_pack_rbh ?? null;

  return (
    <section id="work-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-work">
      <section className="page-intro">
        <div>
          <p className="eyebrow">PLANOWANIE OPERACYJNE</p>
          <h1>Plan pracy zespołu</h1>
          <p className="subtitle">
            {hasSavedPlan
              ? "Obsada PICK i PAK, zadania dodatkowe oraz realizacja normy w jednym widoku."
              : "Grafik źródłowy z godzinami pracy i dyżurami. Przydział PICK / PAK zostanie wyliczony w kolejnym kroku."}
          </p>
        </div>
        <div className="intro-meta">
          <span className="mode-badge"><i /> {hasSavedPlan ? (planStatus === "CAPACITY_SHORTAGE" ? "Plan · brak capacity" : "Plan roboczy") : "Grafik źródłowy"}</span>
          <span>{planGeneratedAt ? `Przeliczono ${new Date(planGeneratedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}` : formatLongDate(date)}</span>
        </div>
      </section>

      <section className="work-demand-strip work-demand-strip-live" aria-label="Wolumen do zaplanowania">
        <WorkTarget
          plan={targetPlan}
          current={targetCurrent}
          difference={targetDifference}
        />
        <WorkDemand label="PICK pozostało" value={pickRemaining} />
        <WorkDemand label="PAK pozostało" value={packRemaining} />
      </section>

      <section className="rbh-demand-grid" aria-label="Zapotrzebowanie i rozpisanie RBH">
        <RbhDemandCard
          process="PICK"
          demand={pickDemandRbh}
          scheduled={pickScheduledRbh}
        />
        <RbhDemandCard
          process="PAK"
          demand={packDemandRbh}
          scheduled={packScheduledRbh}
        />
      </section>

      <section className="legend" aria-label="Legenda czynności">
        <span className="legend-title">{hasSavedPlan ? "CZYNNOŚCI" : "DANE Z GRAFIKU"}</span>
        {!hasSavedPlan && <span><i className="legend-swatch presence" />Obecność</span>}
        {hasSavedPlan && <span><i className="legend-swatch pick" />PICK</span>}
        {hasSavedPlan && <span><i className="legend-swatch pack" />PAK</span>}
        <span><i className="legend-swatch duty" />Dyżur</span>
        {hasSavedPlan && <span><i className="legend-swatch break" />Przerwa</span>}
        {hasSavedPlan && <span><i className="legend-swatch clean" />Porządki</span>}
        {hasSavedPlan && <span><i className="legend-swatch returns" />Zwroty</span>}
        <span className="legend-hint">
          {hasSavedPlan
            ? (editingEnabled ? "Kliknij blok, aby ręcznie skorygować plan" : "Ręczna edycja chwilowo zablokowana podczas przeliczania")
            : "Godziny i dyżury pochodzą z miesięcznego grafiku MOL"}
        </span>
      </section>

      <section className="schedule-card card" aria-labelledby="schedule-title">
        <div className="section-heading schedule-heading">
          <div>
            <p className="eyebrow">OBSADA I CZAS</p>
            <h2 id="schedule-title">{hasSavedPlan ? "Harmonogram dnia" : "Grafik wejściowy"}</h2>
          </div>
          <div className="schedule-tools">
            <span className="resolution-note">Siatka co 5 min · plan docelowo w blokach 15 min</span>
            <button
              className="icon-button"
              type="button"
              aria-label={collapsed ? "Rozwiń zespół" : "Zwiń zespół"}
              aria-expanded={!collapsed}
              onClick={onToggleCollapsed}
            >
              {collapsed ? "⌄" : "⌃"}
            </button>
          </div>
        </div>
        <Schedule
          employees={employees}
          date={date}
          collapsed={collapsed}
          editingEnabled={editingEnabled}
          onBlockClick={onBlockClick}
        />
        <div className="cutoff-strip">
          <span className="cutoff-title">PUNKTY KONTROLNE</span>
          <span className="cutoff-item"><b>10:00</b> cutoff Allegro One</span>
          <span className="cutoff-item"><b>12:00</b> cutoff pozostałych kurierów</span>
          <span className="cutoff-item">InPost / Orlen: <b>12:00 pn · 16:00 wt–pt</b></span>
          <span className="cutoff-item"><b>+15 min</b> dopakowanie</span>
        </div>
      </section>

      <section className="operator-performance-card card" aria-labelledby="operator-performance-title">
          <div className="section-heading operator-performance-heading">
            <div>
              <p className="eyebrow">PLAN VS WYKONANIE</p>
              <h2 id="operator-performance-title">Realizacja planu per pracownik</h2>
            </div>
            <div className="operator-performance-source">
              <span className={`refresh-dot ${executionStatus.tone}`} />
              <span>
                {executionTimestamp ? `EasyStorage · ${executionTimestamp} · ${executionStatus.label}` : executionStatus.label}
                {nextExecutionTimestamp ? ` · następny snapshot ${nextExecutionTimestamp}` : ""}
              </span>
            </div>
          </div>

          {planRestoreLoading ? (
            <div className="operator-performance-state">Wczytywanie zapisanego planu dla {formatLongDate(date)}…</div>
          ) : planRestoreError ? (
            <div className="operator-performance-state warning">
              Nie udało się odtworzyć zapisanego planu. {planRestoreError}
            </div>
          ) : !hasSavedPlan ? (
            <div className="operator-performance-state">
              Brak zapisanego planu dla {formatLongDate(date)}. Tabela pojawi się automatycznie po wejściu na dzień, dla którego istnieje zapisany plan.
            </div>
          ) : performance.rows.length === 0 ? (
            <div className="operator-performance-state warning">
              Zapisany plan został odczytany, ale nie zawiera pracowników do pokazania w tabeli.
            </div>
          ) : (
            <>
              <div className="operator-performance-wrap">
                <table>

              <thead>
                <tr>
                  <th scope="col">Pracownik</th>
                  <th scope="col">Proces</th>
                  <th scope="col">Plan do teraz</th>
                  <th scope="col">Wykonanie do teraz</th>
                  <th scope="col">% do teraz</th>
                  <th scope="col">Plan dnia</th>
                  <th scope="col">Wykonanie dnia</th>
                  <th scope="col">% planu dnia</th>
                  <th scope="col">Pozostało</th>
                </tr>
              </thead>
              <tbody>
                {performance.rows.flatMap(row => (["pick", "pack"] as const).map((process, processIndex) => {
                  const metrics = row.processes[process];
                  return (
                  <tr key={`${row.id}-${process}`}>
                    {processIndex === 0 && <td rowSpan={2}>
                      <div className="operator-person">
                        <strong>{row.name}</strong>
                        <small>{row.group}</small>
                        {row.mapping !== "ok" && <span className="mapping-warning">{mappingLabel(row.mapping)}</span>}
                      </div>
                    </td>}
                    <td><span className={`process-pill ${process}`}>{process === "pick" ? "PICK" : "PAK"}</span></td>
                    <MetricCells metrics={metrics} />
                  </tr>
                  );
                }))}
              </tbody>
              <tfoot>
                {(["pick", "pack"] as const).map((process, processIndex) => (
                  <tr key={`team-${process}`}>
                    {processIndex === 0 && <td rowSpan={2}><strong>Razem · zespół</strong></td>}
                    <td><span className={`process-pill ${process}`}>{process === "pick" ? "PICK" : "PAK"}</span></td>
                    <MetricCells metrics={performance.team[process]} />
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
              <div className="operator-performance-note">
                <span>Plan do teraz: wyłącznie zakończone bloki × globalna norma procesu.</span>
                <span>Wykonanie: dzienny licznik ES do czasu snapshotu; aktualizacja co 30 min.</span>
                <span>PICK i PAK pozostają w swoich jednostkach — bez przeliczania między procesami.</span>
                {!hasOperationalBlocks && <span>Zapisany plan nie zawiera już bloków PICK/PAK — pokazujemy go mimo to, zamiast ukrywać sekcję.</span>}
                {performance.unmappedOperators > 0 && <span className="mapping-warning">Operatorzy ES bez mapowania: {performance.unmappedOperators}</span>}
              </div>
            </>
          )}
        </section>

      {!hasSavedPlan ? (
        <section className="source-ready-card card" aria-label="Status danych wejściowych">
          <b>Grafik gotowy do planowania.</b> Aplikacja zna już godziny obecności, podział Przyjęcie / Wydanie i dyżury.
          Nie pokazujemy jeszcze zerowych norm PICK / PAK, ponieważ nie został uruchomiony algorytm przydziału pracy.
        </section>
      ) : (
        <>
          <section className="pace-card card" aria-labelledby="pace-title">
            <div className="pace-heading">
              <div><p className="eyebrow">TEMPO ZESPOŁU</p><h2 id="pace-title">Realizacja względem planu</h2></div>
              <div className="refresh-info"><span className="refresh-dot" /><span>Odświeżanie co 30 min</span></div>
            </div>
            <div className="pace-rows">
              {processes.map((process) => {
                const actual = planSummary
                  ? (process === "pick" ? planSummary.pick_completed : planSummary.pack_completed)
                  : 0;
                const target = planSummary
                  ? (process === "pick" ? planSummary.pick_target_tasks : planSummary.pack_target_orders)
                  : employees.reduce((sum, employee) => sum + targetFor(employee, process, norms), 0);
                const remaining = Math.max(0, target - actual);
                const percent = target ? Math.round((actual / target) * 100) : 0;
                const complete = remaining <= 0.01;
                return (
                  <div className="pace-row" key={process}>
                    <span className={`process-pill ${process}`}>{process === "pick" ? "PICK" : "PAK"}</span>
                    <span className="pace-number">Wykonanie ES<b>{formatNumber(Math.round(actual))}</b></span>
                    <span className="pace-number">Target dnia<b>{formatNumber(Math.round(target))}</b></span>
                    <div className="progress-wrap">
                      <div
                        className="progress-track"
                        role="progressbar"
                        aria-label={`${process === "pick" ? "PICK" : "PAK"}: realizacja względem targetu dnia`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.min(percent, 100)}
                      >
                        <div className={`progress-fill${complete ? "" : " behind"}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <span className="progress-label">{percent}%</span>
                    </div>
                    <span className={`pace-status ${complete ? "good" : "behind"}`}>
                      {complete ? "target wykonany" : `pozostało ${formatNumber(Math.ceil(remaining))}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="lower-grid">
            <section className="table-card card" aria-labelledby="norms-title">
              <div className="table-heading"><div className="table-icon target-icon">◎</div><div><p className="eyebrow">CEL NA DZIŚ</p><h2 id="norms-title">Norma do wykonania</h2></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Pracownik</th><th scope="col">PICK cel</th><th scope="col">PAK cel</th><th scope="col">Godziny</th></tr></thead>
                  <tbody>{employees.map((employee) => <tr key={employee.id}><td>{employee.name}</td><td>{formatNumber(targetFor(employee, "pick", norms))}</td><td>{formatNumber(targetFor(employee, "pack", norms))}</td><td>{dailyWorkedHours(employee).toFixed(1).replace(".", ",")} h</td></tr>)}</tbody>
                  <tfoot><tr><td>Razem · {employees.length} osób</td><td>{formatNumber(totals.pickGoal)}</td><td>{formatNumber(totals.packGoal)}</td><td>{totals.hours.toFixed(1).replace(".", ",")} h</td></tr></tfoot>
                </table>
              </div>
            </section>

            <section className="table-card card" aria-labelledby="actual-title">
              <div className="table-heading"><div className="table-icon actual-icon">↗</div><div><p className="eyebrow">STAN GENERATORA</p><h2 id="actual-title">Workload i capacity</h2></div></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Proces</th><th scope="col">Wykonano</th><th scope="col">Pozostało</th><th scope="col">Zaplanowane RBH</th></tr></thead>
                  <tbody>
                    <tr><td>PICK</td><td>{formatMaybe(planSummary?.pick_completed)}</td><td>{formatMaybe(planSummary?.initial_pick_remaining)}</td><td>{formatHours(planSummary?.planned_pick_rbh)}</td></tr>
                    <tr><td>PAK</td><td>{formatMaybe(planSummary?.pack_completed)}</td><td>{formatMaybe(planSummary?.initial_pack_remaining)}</td><td>{formatHours(planSummary?.planned_pack_rbh)}</td></tr>
                  </tbody>
                  <tfoot><tr><td>Status planu</td><td colSpan={3}>{planStatus === "CAPACITY_SHORTAGE" ? "Brak wymaganej capacity" : "Workload pokryty w planie roboczym"}</td></tr></tfoot>
                </table>
              </div>
              <div className="orders-table-note"><span>Wykonanie pochodzi z najnowszego poprawnego snapshotu EasyStorage.</span><span>Rozbicie per operator znajduje się w tabeli Plan vs wykonanie powyżej.</span></div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function RbhDemandCard({ process, demand, scheduled }: { process: "PICK" | "PAK"; demand: number | null; scheduled: number | null }) {
  const balance = demand !== null && scheduled !== null ? scheduled - demand : null;
  const covered = balance !== null && balance >= 0;

  return (
    <section className={`rbh-demand-card ${process.toLowerCase()}`}>
      <div className="rbh-demand-title">
        <span>{process}</span>
        <b>Zapotrzebowanie RBH</b>
      </div>
      <div className="rbh-demand-values">
        <div>
          <small>Zapotrzebowanie</small>
          <strong>{formatRbh(demand)}</strong>
        </div>
        <div>
          <small>Rozpisane</small>
          <strong>{formatRbh(scheduled)}</strong>
        </div>
        <div className={balance === null ? undefined : covered ? "rbh-balance-covered" : "rbh-balance-shortage"}>
          <small>Bilans</small>
          <strong>{formatRbhSigned(balance)}</strong>
        </div>
      </div>
    </section>
  );
}

function WorkTarget({ plan, current, difference }: { plan: number | null; current: number | null; difference: number | null }) {
  return (
    <div className="work-target-card accent">
      <div className="work-target-head">
        <span>Target dnia</span>
        <strong>{typeof current === "number" ? formatNumber(current) : "—"}</strong>
      </div>
      <div className="work-target-breakdown">
        <div><small>Plan</small><b>{typeof plan === "number" ? formatNumber(plan) : "—"}</b></div>
        <div><small>Stan aktualny</small><b>{typeof current === "number" ? formatNumber(current) : "—"}</b></div>
        <div>
          <small>Różnica</small>
          <b className={workTargetDifferenceClass(difference)}>
            {typeof difference === "number" ? formatSigned(difference) : "—"}
          </b>
        </div>
      </div>
    </div>
  );
}

function WorkDemand({ label, value, accent = false }: { label: string; value: number | null | undefined; accent?: boolean }) {
  return <div className={accent ? "accent" : undefined}><span>{label}</span><strong>{typeof value === "number" ? formatNumber(value) : "—"}</strong></div>;
}

function formatRbh(value: number | null | undefined) {
  return typeof value === "number"
    ? `${value.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} RBH`
    : "—";
}

function formatRbhSigned(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  const normalized = Math.abs(value) < 0.05 ? 0 : value;
  const prefix = normalized > 0 ? "+" : "";
  return `${prefix}${normalized.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} RBH`;
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function workTargetDifferenceClass(value: number | null) {
  if (value === null || value === 0) return undefined;
  return value > 0 ? "work-target-diff-positive" : "work-target-diff-negative";
}

function formatMaybe(value: number | null | undefined) {
  return typeof value === "number" ? formatNumber(Math.round(value)) : "—";
}

function formatHours(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(2).replace(".", ",")} h` : "—";
}

function MetricCells({ metrics }: { metrics: ProcessPerformance }) {
  return <>
    <td>{formatCapacity(metrics.plannedToCutoff)}</td>
    <td>{formatActual(metrics.actualToCutoff)}</td>
    <td><Realization value={metrics.cutoffRealization} /></td>
    <td>{formatCapacity(metrics.plannedDay)}</td>
    <td>{formatActual(metrics.actualDay)}</td>
    <td><Realization value={metrics.dayRealization} /></td>
    <td>{metrics.remaining === null ? "—" : formatCapacity(metrics.remaining)}</td>
  </>;
}

function Realization({ value }: { value: number | null }) {
  return value === null
    ? <span className="realization-badge unavailable">—</span>
    : <span className={`realization-badge ${realizationClass(value)}`}>{Math.round(value)}%</span>;
}

function formatActual(value: number | null) {
  return value === null ? "—" : formatCapacity(value);
}

function formatCapacity(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
}

function realizationClass(value: number) {
  if (value >= 100) return "good";
  if (value >= 90) return "near";
  return "behind";
}

function mappingLabel(mapping: OperatorMapping) {
  if (mapping === "missing_profile") return "Brak profilu pracownika";
  if (mapping === "missing_login") return "Brak loginu ES";
  if (mapping === "duplicate_login") return "Login ES przypisany wielokrotnie";
  return "Brak danych operatora w ES";
}

function formatWarsawTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: "Europe/Warsaw",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function describeExecution(execution: ExecutionSnapshotResponse | null) {
  if (!execution?.latest) return { label: "Brak danych wykonania ES", tone: "unavailable" };
  if (execution.status === "error" || execution.latest.data_status.toUpperCase().includes("ERROR")) {
    return { label: "Błąd danych ES", tone: "error" };
  }
  if (execution.status === "partial") return { label: "Dane częściowe", tone: "warning" };
  if (execution.status === "stale" || execution.latest.age_minutes > 35) {
    return { label: `Dane nieaktualne · ${Math.round(execution.latest.age_minutes)} min`, tone: "warning" };
  }
  return { label: `Aktualne · ${Math.round(execution.latest.age_minutes)} min temu`, tone: "fresh" };
}
