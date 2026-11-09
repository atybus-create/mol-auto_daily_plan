import { Schedule } from "@/components/schedule";
import {
  currentActual,
  currentPlan,
  dailyWorkedHours,
  formatLongDate,
  formatNumber,
  targetFor,
} from "@/lib/plan-utils";
import type { Employee, ProcessKind } from "@/types/plan";

type WorkPlanProps = {
  employees: Employee[];
  date: string;
  collapsed: boolean;
  editingEnabled: boolean;
  onToggleCollapsed: () => void;
  onBlockClick: (employeeId: string, blockIndex: number, button: HTMLButtonElement) => void;
};

const processes: ProcessKind[] = ["pick", "pack"];

export function WorkPlan({
  employees,
  date,
  collapsed,
  editingEnabled,
  onToggleCollapsed,
  onBlockClick,
}: WorkPlanProps) {
  const totals = employees.reduce(
    (result, employee) => ({
      pickGoal: result.pickGoal + targetFor(employee, "pick"),
      packGoal: result.packGoal + targetFor(employee, "pack"),
      pickDone: result.pickDone + currentActual(employee, "pick"),
      packDone: result.packDone + currentActual(employee, "pack"),
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
          <p className="subtitle">Obsada PICK i PAK, zadania dodatkowe oraz realizacja normy w jednym widoku.</p>
        </div>
        <div className="intro-meta">
          <span className="mode-badge"><i /> Wersja demonstracyjna</span>
          <span>{formatLongDate(date)}</span>
        </div>
      </section>

      <section className="legend" aria-label="Legenda czynności">
        <span className="legend-title">CZYNNOŚCI</span>
        <span><i className="legend-swatch pick" />PICK</span>
        <span><i className="legend-swatch pack" />PAK</span>
        <span><i className="legend-swatch duty" />Dyżur</span>
        <span><i className="legend-swatch break" />Przerwa</span>
        <span><i className="legend-swatch clean" />Porządki</span>
        <span><i className="legend-swatch returns" />Zwroty</span>
        <span className="legend-hint">Zaznacz blok, aby zmienić czynność</span>
      </section>

      <section className="schedule-card card" aria-labelledby="schedule-title">
        <div className="section-heading schedule-heading">
          <div><p className="eyebrow">OBSADA I CZAS</p><h2 id="schedule-title">Harmonogram dnia</h2></div>
          <div className="schedule-tools">
            <span className="resolution-note">Siatka co 15 min · podział godzin co 30 min</span>
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

      <section className="pace-card card" aria-labelledby="pace-title">
        <div className="pace-heading">
          <div><p className="eyebrow">TEMPO ZESPOŁU</p><h2 id="pace-title">Realizacja względem planu</h2></div>
          <div className="refresh-info"><span className="refresh-dot" /><span>Odświeżanie co 30 min</span><span className="refresh-separator">·</span><span>Ostatnia aktualizacja <b>10:00</b></span></div>
        </div>
        <div className="pace-rows">
          {processes.map((process) => {
            const actual = employees.reduce((sum, employee) => sum + currentActual(employee, process), 0);
            const plan = employees.reduce((sum, employee) => sum + currentPlan(employee, process), 0);
            const variance = actual - plan;
            const percent = plan ? Math.round((actual / plan) * 100) : 0;
            const behind = variance < 0;
            return (
              <div className="pace-row" key={process}>
                <span className={`process-pill ${process}`}>{process === "pick" ? "PICK" : "PAK"}</span>
                <span className="pace-number">Wykonanie<b>{formatNumber(actual)}</b></span>
                <span className="pace-number">Plan narastająco<b>{formatNumber(plan)}</b></span>
                <div className="progress-wrap">
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={`${process === "pick" ? "PICK" : "PAK"}: realizacja względem planu`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(percent, 100)}
                  >
                    <div className={`progress-fill${behind ? " behind" : ""}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                  </div>
                  <span className="progress-label">{percent}%</span>
                </div>
                <span className={`pace-status ${behind ? "behind" : "good"}`}>
                  {variance > 0 ? "+" : ""}{formatNumber(variance)} · {behind ? "poniżej planu" : variance === 0 ? "zgodnie z planem" : "powyżej planu"}
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
              <tbody>{employees.map((employee) => <tr key={employee.id}><td>{employee.name}</td><td>{formatNumber(targetFor(employee, "pick"))}</td><td>{formatNumber(targetFor(employee, "pack"))}</td><td>{dailyWorkedHours(employee).toFixed(1).replace(".", ",")} h</td></tr>)}</tbody>
              <tfoot><tr><td>Razem · {employees.length} osób</td><td>{formatNumber(totals.pickGoal)}</td><td>{formatNumber(totals.packGoal)}</td><td>{totals.hours.toFixed(1).replace(".", ",")} h</td></tr></tfoot>
            </table>
          </div>
        </section>

        <section className="table-card card" aria-labelledby="actual-title">
          <div className="table-heading"><div className="table-icon actual-icon">↗</div><div><p className="eyebrow">WYNIK W TRAKCIE DNIA</p><h2 id="actual-title">Bieżące wykonanie</h2></div><span className="table-update">Dane przykładowe</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th scope="col">Pracownik</th><th scope="col">PICK wykonanie / cel</th><th scope="col">PAK wykonanie / cel</th><th scope="col">Realizacja</th></tr></thead>
              <tbody>{employees.map((employee) => {
                const pickGoal = targetFor(employee, "pick");
                const packGoal = targetFor(employee, "pack");
                const pickDone = currentActual(employee, "pick");
                const packDone = currentActual(employee, "pack");
                const percentages = [pickGoal ? (pickDone / pickGoal) * 100 : null, packGoal ? (packDone / packGoal) * 100 : null].filter((value): value is number => value !== null);
                const completion = Math.round(percentages.reduce((sum, value) => sum + value, 0) / percentages.length || 0);
                return <tr key={employee.id}><td>{employee.name}</td><td>{formatNumber(pickDone)} / {formatNumber(pickGoal)}</td><td>{formatNumber(packDone)} / {formatNumber(packGoal)}</td><td><span className={`completion ${completion >= 90 ? "good" : "behind"}`}>{completion}%</span></td></tr>;
              })}</tbody>
              <tfoot><tr><td>Razem · zespół</td><td>{formatNumber(totals.pickDone)} / {formatNumber(totals.pickGoal)}</td><td>{formatNumber(totals.packDone)} / {formatNumber(totals.packGoal)}</td><td>—</td></tr></tfoot>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}
