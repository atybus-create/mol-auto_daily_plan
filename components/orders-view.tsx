import { formatNumber } from "@/lib/plan-utils";
import type { CourierGroup, DayDemandSnapshot } from "@/types/plan";

type OrdersViewProps = { demand: DayDemandSnapshot | null; loading: boolean; error: string };

const courierNames: Record<CourierGroup, string> = {
  allegro_one: "Allegro One", inpost_orlen: "InPost / Orlen", other: "Pozostali", unknown: "Nierozpoznani",
};

export function OrdersView({ demand, loading, error }: OrdersViewProps) {
  if (loading) return <OrdersState title="Pobieranie planu zamówień…" detail="Łączę pulę z 06:00 z prognozą półgodzinową." />;
  if (error || !demand) return <OrdersState title="Plan zamówień jest niedostępny" detail={error || "Brak danych dla wybranego dnia."} />;
  const { morning, forecast, plan_gross: gross } = demand;
  const statusLabel = demand.status === "ready" ? "Gotowy" : demand.status === "stale" ? "Dane nieaktualne" : "Plan częściowy";
  return (
    <section id="orders-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-orders">
      <section className="page-intro orders-intro">
        <div><p className="eyebrow">WOLUMEN ZAMÓWIEŃ</p><h1>Plan i prognozowany napływ</h1><p className="subtitle">Rzeczywista pula o 06:00 oraz 20 prognozowanych bloków do 16:00.</p></div>
        <div className="intro-meta"><span className={`mode-badge demand-${demand.status}`}><i /> {statusLabel}</span><span>Model {demand.model_version || "—"} · trening do {demand.trained_until || "—"}</span></div>
      </section>
      {demand.warnings.length > 0 && <div className="demand-warning" role="status">{demand.warnings.join(" · ")}</div>}
      <div className="orders-summary demand-summary">
        <DemandCard label="Pula rano · 06:00" value={morning?.total} detail={morning ? `.PL ${formatNumber(morning.pl)} · _PL ${formatNumber(morning.under)}` : "Brak kompletnego snapshotu BL/SR"} />
        <DemandCard label="Prognoza nowych · 06–16" value={forecast?.total} detail={forecast ? `zakres ${formatNumber(forecast.p10)}–${formatNumber(forecast.p90)}` : "Prognoza niedostępna"} />
        <DemandCard label="Plan brutto" value={gross?.total} detail="rano + prognozowany napływ" accent />
        <DemandCard label="Do realizacji dzisiaj" value={demand.required_today} detail={`po cutoffach · później ${formatMaybe(demand.after_cutoff)}`} />
      </div>
      <div className="orders-layout">
        <section className="card orders-table-card" aria-labelledby="orders-flow-title">
          <div className="section-heading"><div><p className="eyebrow">PROGNOZA BAZOWA</p><h2 id="orders-flow-title">Napływ co 30 minut</h2></div><div className="refresh-info"><span className="refresh-dot" /><span>Etap 2 · bez korekty rzeczywistym spływem</span></div></div>
          {demand.slots.length === 20 ? <div className="table-wrap orders-flow-wrap"><table>
            <thead><tr><th>Godzina</th><th>.PL</th><th>_PL</th><th>Razem</th><th>Narastająco</th><th>Dzisiejszy cutoff</th><th>Kurierzy</th></tr></thead>
            <tbody>{demand.slots.map(slot => <tr key={slot.slot_start}>
              <td>{slot.slot_start}–{slot.slot_end}</td><td>{formatNumber(slot.forecast.pl)}</td><td>{formatNumber(slot.forecast.under)}</td><td><b>{formatNumber(slot.forecast.total)}</b></td><td>{formatNumber(slot.cumulative_plan_gross ?? slot.cumulative_forecast)}</td>
              <td><span className="eligible-number">{formatNumber(slot.eligible_today)}</span>{slot.after_cutoff > 0 && <small className="after-cutoff"> +{formatNumber(slot.after_cutoff)} później</small>}</td>
              <td><details className="courier-details"><summary>{slot.by_carrier.length} grupy</summary><div>{slot.by_carrier.map(carrier => <span key={carrier.group}>{courierNames[carrier.group]}: <b>{formatNumber(carrier.point)}</b></span>)}</div></details></td>
            </tr>)}</tbody>
            <tfoot><tr><td>Razem · 06:00–16:00</td><td>{formatMaybe(forecast?.pl)}</td><td>{formatMaybe(forecast?.under)}</td><td>{formatMaybe(forecast?.total)}</td><td>{formatMaybe(gross?.total)}</td><td>{formatNumber(demand.slots.reduce((sum, slot) => sum + slot.eligible_today, 0))}</td><td>—</td></tr></tfoot>
          </table></div> : <div className="empty-state">Brak kompletnego zestawu 20 bloków dla tego dnia.</div>}
          <div className="orders-table-note"><span>Prognoza bazowa pozostaje niezmienna przez dzień.</span><span>Rzeczywisty napływ i korekta będą Etapem 3.</span></div>
        </section>
        <aside className="orders-side">
          <section className="card morning-card"><div className="section-heading"><div><p className="eyebrow">STRUKTURA PLANU</p><h2>Rano + nowe zamówienia</h2></div></div><div className="demand-equation"><span>{formatMaybe(morning?.total)}</span><i>+</i><span>{formatMaybe(forecast?.total)}</span><i>=</i><strong>{formatMaybe(gross?.total)}</strong></div><div className="morning-source">Snapshot: {demand.source_as_of ? new Date(demand.source_as_of).toLocaleString("pl-PL") : "—"}</div></section>
          <section className="card cutoff-card"><div className="section-heading"><div><p className="eyebrow">REGUŁY DNIA</p><h2>Cutoffy kurierów</h2></div></div><div className="cutoff-rule"><b>do 10:00</b><span>wszystkie rozpoznane grupy</span></div><div className="cutoff-rule"><b>10:00–12:00</b><span>bez Allegro One</span></div><div className="cutoff-rule"><b>12:00–16:00</b><span>InPost / Orlen · wt–pt</span></div><p className="cutoff-note">Poniedziałek: InPost / Orlen do 12:00. Nierozpoznane metody liczymy konserwatywnie jako późniejsze.</p></section>
        </aside>
      </div>
    </section>
  );
}

function DemandCard({ label, value, detail, accent = false }: { label: string; value: number | null | undefined; detail: string; accent?: boolean }) {
  return <div className={`order-stat${accent ? " plan-gross" : ""}`}><span>{label}</span><strong>{formatMaybe(value)}</strong><small>{detail}</small></div>;
}
function OrdersState({ title, detail }: { title: string; detail: string }) {
  return <section id="orders-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-orders"><section className="page-intro"><div><p className="eyebrow">WOLUMEN ZAMÓWIEŃ</p><h1>{title}</h1><p className="subtitle">{detail}</p></div></section></section>;
}
function formatMaybe(value: number | null | undefined) { return typeof value === "number" ? formatNumber(value) : "—"; }
