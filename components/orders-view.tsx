import { formatNumber } from "@/lib/plan-utils";
import type { DayDemandV3Snapshot, OrdersDemandSnapshot, V3ForecastSlot } from "@/types/plan";

type OrdersViewProps = { demand: OrdersDemandSnapshot | null; loading: boolean; error: string };

export function OrdersView({ demand, loading, error }: OrdersViewProps) {
  if (loading) return <OrdersState title="Pobieranie planu zamówień…" detail="Łączę stan 06:00, prognozę i realny spływ półgodzinny." />;
  if (error || !demand) return <OrdersState title="Plan zamówień jest niedostępny" detail={error || "Brak danych dla wybranego dnia."} />;

  const { morning } = demand;
  const liveLastSlot = demand.real_inflow_to_now.last_slot_end;
  const statusLabel = demand.status === "ready" ? "Gotowy" : demand.status === "stale" ? "Dane nieaktualne" : "Plan częściowy";
  const v3Summary = buildV3Summary(demand);

  return (
    <section id="orders-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-orders">
      <section className="page-intro orders-intro">
        <div>
          <p className="eyebrow">WOLUMEN ZAMÓWIEŃ</p>
          <h1>Plan i realny napływ zamówień</h1>
          <p className="subtitle">Stan o 06:00, rzeczywisty spływ w zakończonych przedziałach i prognoza na pozostałą część dnia.</p>
        </div>
        <div className="intro-meta">
          <span className={`mode-badge demand-${demand.status}`}><i /> {statusLabel}</span>
          <span>{`Realny spływ do ${liveLastSlot || "—"}`}</span>
        </div>
      </section>

      {demand.leader_cutoff?.mode === "SHORTENED" && (
        <div className="leader-cutoff-banner" role="status">
          <b>Skrócony cut-off lidera: {demand.leader_cutoff.cutoff_local}</b>
          <span>Dzisiejszy target nie uwzględnia późniejszych slotów · wyłączono {formatNumber(demand.leader_cutoff.excluded_orders)} zam.</span>
        </div>
      )}
      {demand.warnings.length > 0 && <div className="demand-warning" role="status">{demand.warnings.join(" · ")}</div>}

      <div className="orders-summary demand-summary">
        <div className="orders-summary-v3">
          <section className="order-stat summary-0600">
            <span>Ilość zamówień na 06:00</span>
            <strong>{formatMaybe(morning?.total)}</strong>
            <small>{morning ? `.PL ${formatNumber(morning.pl)} · _PL ${formatNumber(morning.under)}` : "Brak kompletnego snapshotu"}</small>
          </section>

          <section className="order-stat summary-flow">
            <span>Spływ 06:00–16:00</span>
            <div className="summary-metrics">
              <SummaryMetric label="Plan spływu" value={v3Summary.planInflowTotal} />
              <SummaryMetric label="Skorygowany plan spływu" value={v3Summary.correctedInflowTotal} />
              <SummaryMetric
                label="Różnica"
                value={v3Summary.inflowDifference}
                signed
                className={inflowDifferenceClass(v3Summary.inflowDifference)}
              />
            </div>
            <small>Skorygowany = realny spływ w zakończonych slotach + plan w slotach przyszłych.</small>
          </section>

          <section className="order-stat summary-day">
            <span>Cały dzień · stan 06:00 + spływ</span>
            <div className="summary-metrics">
              <SummaryMetric label="Plan na 06:00" value={v3Summary.planDayTotal} />
              <SummaryMetric label="Skorygowany teraz" value={v3Summary.correctedDayTotal} />
              <SummaryMetric
                label="Różnica"
                value={v3Summary.dayDifference}
                signed
                className={inflowDifferenceClass(v3Summary.dayDifference)}
              />
            </div>
            <div className="summary-buckets">
              <div>
                <b>Plan 06:00</b>
                <span>.PL {formatMaybe(v3Summary.planDayPl)} · _PL {formatMaybe(v3Summary.planDayUnder)}</span>
              </div>
              <div>
                <b>Skorygowany</b>
                <span>.PL {formatMaybe(v3Summary.correctedDayPl)} · _PL {formatMaybe(v3Summary.correctedDayUnder)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="orders-layout">
        <section className="card orders-table-card" aria-labelledby="orders-flow-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PLAN · SPŁYW RZECZYWISTY</p>
              <h2 id="orders-flow-title">Napływ co 30 minut</h2>
            </div>
            <div className="refresh-info">
              <span className="refresh-dot" />
              <span>Spływ pokazujemy wyłącznie dla zakończonych przedziałów</span>
            </div>
          </div>

          {demand.slots.length === 20 ? (
            <div className="table-wrap orders-flow-wrap">
              <table className="orders-v3-table">
                <thead>
                  <tr>
                    <th>Przedział</th>
                    <th>Plan .PL</th>
                    <th>Plan _PL</th>
                    <th>Spływ .PL</th>
                    <th>Spływ _PL</th>
                    <th>Plan .PL + _PL</th>
                    <th>Spływ .PL + _PL</th>
                    <th>Różnica .PL + _PL</th>
                  </tr>
                </thead>
                <tbody>
                  {demand.slots.map(slot => {
                    const nowcast = slot as V3ForecastSlot;
                    const actual = nowcast.actual;
                    const isActual = nowcast.effective_source === "actual" && Boolean(actual);
                    const planTotal = nowcast.baseline.total;
                    const actualTotal = isActual ? actual!.all_orders : null;
                    const difference = actualTotal === null ? null : actualTotal - planTotal;
                    return (
                      <tr key={slot.slot_start}>
                        <td>{slot.slot_start}–{slot.slot_end}</td>
                        <td>{formatNumber(nowcast.baseline.pl)}</td>
                        <td>{formatNumber(nowcast.baseline.under)}</td>
                        <td>{isActual ? formatNumber(actual!.gross_pl) : "—"}</td>
                        <td>{isActual ? formatNumber(actual!.gross_under) : "—"}</td>
                        <td>{formatNumber(planTotal)}</td>
                        <td>{actualTotal === null ? "—" : formatNumber(actualTotal)}</td>
                        <td className={inflowDifferenceClass(difference)}>
                          {difference === null ? "—" : formatSigned(difference)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Razem zakończone do {liveLastSlot || "teraz"}</td>
                    <td>{formatNumber(sumMeasuredBaselineBucket(demand, "pl"))}</td>
                    <td>{formatNumber(sumMeasuredBaselineBucket(demand, "under"))}</td>
                    <td>{formatNumber(demand.real_inflow_to_now.gross_pl_actual)}</td>
                    <td>{formatNumber(demand.real_inflow_to_now.gross_under_actual)}</td>
                    <td>{formatNumber(sumMeasuredBaselineTotal(demand))}</td>
                    <td>{formatNumber(demand.real_inflow_to_now.all_actual)}</td>
                    <td className={inflowDifferenceClass(demand.real_inflow_to_now.all_actual - sumMeasuredBaselineTotal(demand))}>
                      {formatSigned(demand.real_inflow_to_now.all_actual - sumMeasuredBaselineTotal(demand))}
                    </td>
                  </tr>
                  <tr>
                    <td>Pozostały plan {liveLastSlot || "teraz"}–16:00</td>
                    <td>{formatNumber(sumFutureBaselineBucket(demand, "pl"))}</td>
                    <td>{formatNumber(sumFutureBaselineBucket(demand, "under"))}</td>
                    <td>—</td>
                    <td>—</td>
                    <td>{formatNumber(sumFutureBaselineTotal(demand))}</td>
                    <td>—</td>
                    <td>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : <div className="demand-warning">Brak kompletnego zestawu 20 bloków dla tego dnia.</div>}

          <div className="orders-table-note">
            <span>Spływ i różnica są pokazywane tylko dla zakończonych przedziałów.</span>
            <span>Przyszłe przedziały mają wyłącznie plan; nowcast pozostaje osobną prognozą w kartach powyżej.</span>
          </div>
        </section>

        <aside className="orders-side">
          <section className="card morning-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AKTUALNY PLAN</p>
                <h2>Do realizacji dzisiaj po cutoffach</h2>
              </div>
            </div>
            <div className="demand-equation">
              <span>{formatMaybe(v3Summary.planEligibleDay)}</span>
              <i>{v3Summary.eligibleDifference >= 0 ? "+" : "−"}</i>
              <span className={inflowDifferenceClass(v3Summary.eligibleDifference)}>
                {formatNumber(Math.abs(v3Summary.eligibleDifference))}
              </span>
              <i>=</i>
              <strong>{formatMaybe(v3Summary.correctedEligibleDay)}</strong>
            </div>
            <div className="morning-breakdown">
              <div><span>Plan po cutoffach</span><b>{formatMaybe(v3Summary.planEligibleDay)}</b></div>
              <div><span>Skorygowany po cutoffach</span><b>{formatMaybe(v3Summary.correctedEligibleDay)}</b></div>
            </div>
            <div className="morning-source">
              Skorygowany wolumen brutto {formatMaybe(v3Summary.correctedDayTotal)} · na kolejny dzień po cutoffach {formatMaybe(v3Summary.correctedAfterCutoff)}.
            </div>
          </section>

          <section className="card cutoff-card">
            <div className="section-heading"><div><p className="eyebrow">REGUŁY DNIA</p><h2>Cutoffy kurierów</h2></div></div>
            <div className="cutoff-rule"><b>do 10:00</b><span>wszystkie rozpoznane grupy</span></div>
            <div className="cutoff-rule"><b>10:00–12:00</b><span>bez Allegro One</span></div>
            <div className="cutoff-rule"><b>12:00–16:00</b><span>InPost / Orlen · wt–pt</span></div>
            <p className="cutoff-note">Poniedziałek: InPost / Orlen do 12:00. Reguły cutoff nie zostały zmienione w tej poprawce.</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function SummaryMetric({ label, value, signed = false, className }: { label: string; value: number | null | undefined; signed?: boolean; className?: string }) {
  return (
    <div className="summary-metric">
      <small>{label}</small>
      <strong className={className}>{typeof value === "number" ? (signed ? formatSigned(value) : formatNumber(value)) : "—"}</strong>
    </div>
  );
}

function buildV3Summary(demand: DayDemandV3Snapshot) {
  const planInflowPl = demand.slots.reduce((sum, slot) => sum + slot.baseline.pl, 0);
  const planInflowUnder = demand.slots.reduce((sum, slot) => sum + slot.baseline.under, 0);
  const correctedInflowPl = demand.slots.reduce(
    (sum, slot) => sum + (slot.actual ? slot.actual.gross_pl : slot.baseline.pl),
    0,
  );
  const correctedInflowUnder = demand.slots.reduce(
    (sum, slot) => sum + (slot.actual ? slot.actual.gross_under : slot.baseline.under),
    0,
  );
  const planInflowTotal = planInflowPl + planInflowUnder;
  const correctedInflowTotal = correctedInflowPl + correctedInflowUnder;
  const inflowDifference = correctedInflowTotal - planInflowTotal;
  const morning = demand.morning;

  return {
    planInflowTotal,
    correctedInflowTotal,
    inflowDifference,
    planDayTotal: morning ? morning.total + planInflowTotal : null,
    correctedDayTotal: morning ? morning.total + correctedInflowTotal : null,
    dayDifference: morning ? inflowDifference : null,
    planDayPl: morning ? morning.pl + planInflowPl : null,
    planDayUnder: morning ? morning.under + planInflowUnder : null,
    correctedDayPl: morning ? morning.pl + correctedInflowPl : null,
    correctedDayUnder: morning ? morning.under + correctedInflowUnder : null,
    planEligibleDay: demand.required_today_baseline,
    correctedEligibleDay: demand.corrected_required_today,
    eligibleDifference: typeof demand.required_today_baseline === "number" && typeof demand.corrected_required_today === "number"
      ? demand.corrected_required_today - demand.required_today_baseline
      : 0,
    correctedAfterCutoff: morning && typeof demand.corrected_required_today === "number"
      ? (morning.total + correctedInflowTotal) - demand.corrected_required_today
      : null,
  };
}

function OrdersState({ title, detail }: { title: string; detail: string }) {
  return <section id="orders-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-orders"><section className="page-intro"><div><p className="eyebrow">WOLUMEN ZAMÓWIEŃ</p><h1>{title}</h1><p className="subtitle">{detail}</p></div></section></section>;
}

function formatMaybe(value: number | null | undefined) {
  return typeof value === "number" ? formatNumber(value) : "—";
}

function formatSigned(value: number) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function sumMeasuredBaselineBucket(demand: DayDemandV3Snapshot, bucket: "pl" | "under") {
  return demand.slots.reduce((sum, slot) => sum + (slot.actual ? slot.baseline[bucket] : 0), 0);
}

function sumFutureBaselineBucket(demand: DayDemandV3Snapshot, bucket: "pl" | "under") {
  return demand.slots.reduce((sum, slot) => sum + (!slot.actual ? slot.baseline[bucket] : 0), 0);
}

function sumMeasuredBaselineTotal(demand: DayDemandV3Snapshot) {
  return demand.slots.reduce((sum, slot) => sum + (slot.actual ? slot.baseline.total : 0), 0);
}

function sumFutureBaselineTotal(demand: DayDemandV3Snapshot) {
  return demand.slots.reduce((sum, slot) => sum + (!slot.actual ? slot.baseline.total : 0), 0);
}

function inflowDifferenceClass(value: number | null) {
  if (value === null || value === 0) return undefined;
  return value > 0 ? "inflow-diff-positive" : "inflow-diff-negative";
}
