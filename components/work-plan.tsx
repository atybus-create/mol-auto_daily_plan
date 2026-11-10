import { Schedule } from "@/components/schedule";
import {
  currentActual,
  currentPlan,
  dailyWorkedHours,
  formatLongDate,
  formatNumber,
  targetFor,
} from "@/lib/plan-utils";
import type { Employee, GeneratedPlanSummary, OrdersDemandSnapshot, ProcessKind, PlannerNorms } from "@/types/plan";

type WorkPlanProps = {
  employees: Employee[];
  norms: PlannerNorms;
  date: string;
  demand: OrdersDemandSnapshot | null;
  planSummary: GeneratedPlanSummary | null;
  planStatus: "DRAFT_READY" | "CAPACITY_SHORTAGE" | null;
  planGeneratedAt: string | null;
  collapsed: boolean;
  editingEnabled: boolean;
  onToggleCollapsed: () => void;
  onBlockClick: (employeeId: string, blockIndex: number, button: HTMLButtonElement) => void;
};

const processes: ProcessKind[] = ["pick", "pack"];

export function WorkPlan({
  employees,
  norms,
  date,
  demand,
  planSummary,
  planStatus,
  planGeneratedAt,
  collapsed,
  editingEnabled,
  onToggleCollapsed,
  onBlockClick,
}: WorkPlanProps) {
  const hasOperationalPlan = employees.some((employee) =>
    employee.blocks.some((block) => block.kind === "pick" || block.kind === "pack"),
  );

  const totals = employees.reduce(
    (result, employee) => ({
      pickGoal: result.pickGoal + targetFor(employee, "pick", norms),
      packGoal: result.packGoal + targetFor(employee, "pack", norms),
      pickDone: result.pickDone + currentActual(employee, "pick", norms),
      packDone: result.packDone + currentActual(employee, "pack", norms),
      hours: result.hours + dailyWorkedHours(employee),
    }),
    { pickGoal: 0, packGoal: 0, pickDone: 0, packDone: 0, hours: 0 },
  );

  return (
    <section id="work-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-work">
      <section className="page-intro">
        <div>
          <p className="eyebrow">PLANOWANIE OPERACYJNE</p>
          <h1>Plan pracy zespołu</h1>
          <p className="subtitle">
            {hasOperationalPlan
              ? "Obsada PICK i PAK, zadania dodatkowe oraz realizacja normy w jednym widoku."
              : "Grafik źródłowy z godzinami pracy i dyżurami. Przydział PICK / PAK zostanie wyliczony w kolejnym kroku."}
          </p>
        </div>
        <div className="intro-meta">
          <span className="mode-badge"><i /> {hasOperationalPlan ? (planStatus === "CAPACITY_SHORTAGE" ? "Plan · brak capacity" : "Plan roboczy") : "Grafik źródłowy"}</span>
          <span>{planGeneratedAt ? `Przeliczono ${new Date(planGeneratedAt).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}` : formatLongDate(date)}</span>
        </div>
      </section>

      <section className="work-demand-strip" aria-label="Wolumen do zaplanowania">
        <WorkDemand label="Pula 06:00" value={demand?.morning?.total} />
        <WorkDemand label="Target dnia" value={planSummary?.target_orders ?? demand?.required_today} accent />
        <WorkDemand label="PICK pozostało" value={planSummary?.initial_pick_remaining} />
        <WorkDemand label="PAK pozostało" value={planSummary?.initial_pack_remaining} />
      </section>

      <section className="legend" aria-label="Legenda czynności">
        <span className="legend-title">{hasOperationalPlan ? "CZYNNOŚCI" : "DANE Z GRAFIKU"}</span>
        {!hasOperationalPlan && <span><i className="legend-swatch presence" />Obecność</span>}
        {hasOperationalPlan && <span><i className="legend-swatch pick" />PICK</span>}
        {hasOperationalPlan && <span><i className="legend-swatch pack" />PAK</span>}
        <span><i className="legend-swatch duty" />Dyżur</span>
        {hasOperationalPlan && <span><i className="legend-swatch break" />Przerwa</span>}
        {hasOperationalPlan && <span><i className="legend-swatch clean" />Porządki</span>}
        {hasOperationalPlan && <span><i className="legend-swatch returns" />Zwroty</span>}
        <span className="legend-hint">
          {hasOperationalPlan ? "Plan można skorygować ręcznie" : "Godziny i dyżury pochodzą z miesięcznego grafiku MOL"}
        </span>
      </section>

      <section className="schedule-card card" aria-labelledby="schedule-title">
        <div className="section-heading schedule-heading">
          <div>
            <p className="eyebrow">OBSADA I CZAS</p>
            <h2 id="schedule-title">{hasOperationalPlan ? "Harmonogram dnia" : "Grafik wejściowy"}</h2>
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

      {!hasOperationalPlan ? (
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
              <div className="orders-table-note"><span>Wykonanie pochodzi z najnowszego poprawnego snapshotu EasyStorage.</span><span>Rozbicie per operator zostanie dodane po pełnym mapowaniu loginów ES.</span></div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

function WorkDemand({ label, value, accent = false }: { label: string; value: number | null | undefined; accent?: boolean }) {
  return <div className={accent ? "accent" : undefined}><span>{label}</span><strong>{typeof value === "number" ? formatNumber(value) : "—"}</strong></div>;
}

function formatMaybe(value: number | null | undefined) {
  return typeof value === "number" ? formatNumber(Math.round(value)) : "—";
}

function formatHours(value: number | null | undefined) {
  return typeof value === "number" ? `${value.toFixed(2).replace(".", ",")} h` : "—";
}
