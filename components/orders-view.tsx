import { formatNumber, formatTime, timeToMinutes } from "@/lib/plan-utils";
import type { OrderFlow } from "@/types/plan";

type OrdersViewProps = {
  flow: OrderFlow;
};

type OrderRow = {
  label: string;
  planPL: number;
  planUnder: number;
  actualPL: number | null;
  actualUnder: number | null;
  isCurrent: boolean;
};

export function OrdersView({ flow }: OrdersViewProps) {
  const observedSlotCount = (timeToMinutes(flow.observedThrough) - 6 * 60) / 30;
  const rows: OrderRow[] = Array.from({ length: 24 }, (_, slot) => {
    const start = 6 * 60 + slot * 30;
    const observed = slot < observedSlotCount;
    return {
      label: `${formatTime(start)}–${formatTime(start + 30)}`,
      planPL: flow.plannedPL[slot] ?? 0,
      planUnder: flow.plannedUnder[slot] ?? 0,
      actualPL: observed ? (flow.actualPL[slot] ?? 0) : null,
      actualUnder: observed ? (flow.actualUnder[slot] ?? 0) : null,
      isCurrent: start === timeToMinutes(flow.observedThrough),
    };
  });

  const planDay = rows.reduce((result, row) => ({ pl: result.pl + row.planPL, under: result.under + row.planUnder }), { pl: 0, under: 0 });
  const observedRows = rows.filter((row) => row.actualPL !== null && row.actualUnder !== null);
  const toNow = observedRows.reduce((result, row) => ({
    planPL: result.planPL + row.planPL,
    planUnder: result.planUnder + row.planUnder,
    actualPL: result.actualPL + (row.actualPL ?? 0),
    actualUnder: result.actualUnder + (row.actualUnder ?? 0),
  }), { planPL: 0, planUnder: 0, actualPL: 0, actualUnder: 0 });
  const morningTotal = flow.morningPL + flow.morningUnder;
  const forecastToCutoff = flow.plannedPL.slice(0, 20).reduce((sum, value) => sum + value, 0) + flow.plannedUnder.slice(0, 20).reduce((sum, value) => sum + value, 0);
  const totalVariance = (toNow.actualPL + toNow.actualUnder) - (toNow.planPL + toNow.planUnder);

  return (
    <section id="orders-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-orders">
      <section className="page-intro orders-intro">
        <div><p className="eyebrow">WOLUMEN ZAMÓWIEŃ</p><h1>Plan i napływ zamówień</h1><p className="subtitle">Poranna pula, prognoza półgodzinowa i rzeczywisty napływ .PL oraz _PL.</p></div>
        <div className="intro-meta"><span className="mode-badge"><i /> Wersja demonstracyjna</span><span>Stan przykładowy: {flow.observedThrough}</span></div>
      </section>

      <div className="orders-summary">
        {[
          ["Pula startowa · 06:00", morningTotal, "zamówień"],
          [".PL · oczekujące", flow.morningPL, "zamówień"],
          ["_PL · oczekujące", flow.morningUnder, "zamówień"],
          ["Prognozowany napływ", forecastToCutoff, "06:00–16:00 · demonstracyjnie"],
        ].map(([label, value, detail]) => (
          <div className="order-stat" key={String(label)}><span>{label}</span><strong>{formatNumber(Number(value))}</strong><small>{detail}</small></div>
        ))}
      </div>

      <div className="orders-layout">
        <section className="card orders-table-card" aria-labelledby="orders-flow-title">
          <div className="section-heading">
            <div><p className="eyebrow">PLAN · RZECZYWISTOŚĆ</p><h2 id="orders-flow-title">Napływ w kolejnych przedziałach</h2></div>
            <div className="refresh-info"><span className="refresh-dot" /><span>Docelowo: odświeżanie co 30 min</span></div>
          </div>
          <div className="table-wrap orders-flow-wrap">
            <table>
              <thead><tr><th rowSpan={2} scope="col">Godzina</th><th colSpan={3} scope="colgroup">Planowany napływ</th><th colSpan={3} scope="colgroup">Rzeczywisty napływ</th><th rowSpan={2} scope="col">Różnica<br />od planu</th></tr><tr><th scope="col">.PL</th><th scope="col">_PL</th><th scope="col">Suma</th><th scope="col">.PL</th><th scope="col">_PL</th><th scope="col">Suma</th></tr></thead>
              <tbody>{rows.map((row) => {
                const planSum = row.planPL + row.planUnder;
                const actualSum = row.actualPL !== null && row.actualUnder !== null ? row.actualPL + row.actualUnder : null;
                const variance = actualSum === null ? null : actualSum - planSum;
                return (
                  <tr className={row.isCurrent ? "current-slot" : undefined} key={row.label}>
                    <td>{row.label}</td><td>{formatNumber(row.planPL)}</td><td>{formatNumber(row.planUnder)}</td><td>{formatNumber(planSum)}</td>
                    <td>{row.actualPL === null ? "—" : formatNumber(row.actualPL)}</td><td>{row.actualUnder === null ? "—" : formatNumber(row.actualUnder)}</td><td>{actualSum === null ? "—" : formatNumber(actualSum)}</td>
                    <td className={variance === null ? undefined : variance > 0 ? "variance-positive" : variance < 0 ? "variance-negative" : undefined}>{variance === null ? "—" : `${variance > 0 ? "+" : ""}${formatNumber(variance)}`}</td>
                  </tr>
                );
              })}</tbody>
              <tfoot>
                <tr><td>Planowany napływ · cały dzień</td><td>{formatNumber(planDay.pl)}</td><td>{formatNumber(planDay.under)}</td><td>{formatNumber(planDay.pl + planDay.under)}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>
                <tr><td>Rzeczywisty · do {flow.observedThrough}</td><td>{formatNumber(toNow.planPL)}</td><td>{formatNumber(toNow.planUnder)}</td><td>{formatNumber(toNow.planPL + toNow.planUnder)}</td><td>{formatNumber(toNow.actualPL)}</td><td>{formatNumber(toNow.actualUnder)}</td><td>{formatNumber(toNow.actualPL + toNow.actualUnder)}</td><td className={totalVariance > 0 ? "variance-positive" : totalVariance < 0 ? "variance-negative" : undefined}>{formatSigned(totalVariance)}</td></tr>
              </tfoot>
            </table>
          </div>
          <div className="orders-table-note"><span><i className="note-dot plan-dot" />Prognoza / plan</span><span><i className="note-dot actual-dot" />Odczyt rzeczywisty</span><span>— brak odczytu w tej makiecie</span></div>
        </section>

        <aside className="orders-side">
          <section className="card morning-card" aria-labelledby="morning-title">
            <div className="section-heading"><div><p className="eyebrow">PULA STARTOWA</p><h2 id="morning-title">Zamówienia o 06:00</h2></div></div>
            <div className="morning-total"><strong>{formatNumber(morningTotal)}</strong><span>zamówień do realizacji</span></div>
            <div className="morning-breakdown"><div><span>.PL</span><b>{formatNumber(flow.morningPL)}</b></div><div><span>_PL</span><b>{formatNumber(flow.morningUnder)}</b></div></div>
            <div className="morning-source">Zaległe i oczekujące z porannego importu</div>
          </section>

          <section className="card cutoff-card" aria-labelledby="cutoff-title">
            <div className="section-heading"><div><p className="eyebrow">REGUŁY DNIA</p><h2 id="cutoff-title">Cutoffy kurierów</h2></div></div>
            <div className="cutoff-day-label">Poniedziałek</div>
            <CourierRows inpost="12:00" showLegend />
            <div className="cutoff-day-label other-days">Wtorek–piątek</div>
            <CourierRows inpost="16:00" />
            <p className="cutoff-note">Godziny są regułami demonstracyjnymi; mapa metod dostawy do grup cutoffów będzie potwierdzona przed podłączeniem danych.</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function CourierRows({ inpost, showLegend = false }: { inpost: string; showLegend?: boolean }) {
  return (
    <>
      {showLegend ? <div className="courier-legend"><span>Kurier</span><b>.PL</b><b>_PL</b></div> : null}
      <div className="courier-row"><span>Wszyscy</span><b>12:00</b><b>12:00</b></div>
      <div className="courier-row"><span>InPost</span><b>{inpost}</b><b>{inpost}</b></div>
      <div className="courier-row"><span>Orlen Paczka</span><b>{inpost}</b><b>{inpost}</b></div>
    </>
  );
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}
