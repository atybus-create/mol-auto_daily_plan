import { formatNumber } from "@/lib/plan-utils";
import type { CorrectedForecastSlot, CourierGroup, DayDemandV2Snapshot, DayDemandV3Snapshot, OrdersDemandSnapshot, V3ForecastSlot } from "@/types/plan";

type OrdersViewProps = { demand: OrdersDemandSnapshot | null; loading: boolean; error: string };

const courierNames: Record<CourierGroup, string> = {
  allegro_one: "Allegro One",
  inpost_orlen: "InPost / Orlen",
  other: "Pozostali",
  unknown: "Nierozpoznani",
};

function isV2(demand: OrdersDemandSnapshot): demand is DayDemandV2Snapshot {
  return "contract_version" in demand && demand.contract_version === 2;
}

function isV3(demand: OrdersDemandSnapshot): demand is DayDemandV3Snapshot {
  return "contract_version" in demand && demand.contract_version === 3;
}

export function OrdersView({ demand, loading, error }: OrdersViewProps) {
  if (loading) return <OrdersState title="Pobieranie planu zamówień…" detail="Łączę stan 06:00, prognozę i realny spływ półgodzinny." />;
  if (error || !demand) return <OrdersState title="Plan zamówień jest niedostępny" detail={error || "Brak danych dla wybranego dnia."} />;

  const v2 = isV2(demand);
  const v3 = isV3(demand);
  const correctedMode = v2 || v3;
  const { morning, forecast, plan_gross: gross } = demand;
  const liveLastSlot = correctedMode ? demand.real_inflow_to_now.last_slot_end : null;
  const statusLabel = demand.status === "ready" ? "Gotowy" : demand.status === "stale" ? "Dane nieaktualne" : "Plan częściowy";
  const v3Summary = v3 ? buildV3Summary(demand) : null;

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
          <span>{correctedMode ? `Realny spływ do ${liveLastSlot || "—"}` : "Tryb bazowy bez korekty"}</span>
        </div>
      </section>

      {demand.warnings.length > 0 && <div className="demand-warning" role="status">{demand.warnings.join(" · ")}</div>}

      <div className="orders-summary demand-summary">
        {v3 && v3Summary ? (
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
        ) : v2 ? (
          <>
            <DemandCard label="Pula rano · 06:00" value={morning?.total} detail={morning ? `.PL ${formatNumber(morning.pl)} · _PL ${formatNumber(morning.under)}` : "Brak kompletnego snapshotu"} />
            <DemandCard label="Realny spływ do teraz" value={demand.real_inflow_to_now.eligible_actual} detail={`wpłynęło ${formatNumber(demand.real_inflow_to_now.all_actual)} · do realizacji dzisiaj`} />
            <DemandCard label="Pozostała prognoza" value={demand.remaining_forecast.eligible_today} detail={`${liveLastSlot || "teraz"}–16:00 · kwalifikowane dziś`} />
            <DemandCard
              label="Aktualny target dnia"
              value={demand.corrected_required_today}
              detail={`bazowo ${formatMaybe(demand.required_today_baseline)} · korekta ${formatSignedNullable(demand.correction_vs_plan)}`}
              accent
            />
          </>
        ) : (
          <>
            <DemandCard label="Pula rano · 06:00" value={morning?.total} detail={morning ? `.PL ${formatNumber(morning.pl)} · _PL ${formatNumber(morning.under)}` : "Brak kompletnego snapshotu"} />
            <DemandCard label="Prognoza nowych · 06–16" value={forecast?.total} detail={forecast ? `zakres ${formatNumber(forecast.p10)}–${formatNumber(forecast.p90)}` : "Prognoza niedostępna"} />
            <DemandCard label="Plan brutto" value={gross?.total} detail="rano + prognozowany napływ" />
            <DemandCard label="Do realizacji dzisiaj" value={demand.required_today} detail={`po cutoffach · później ${formatMaybe(demand.after_cutoff)}`} accent />
          </>
        )}
      </div>

      <div className="orders-layout">
        <section className="card orders-table-card" aria-labelledby="orders-flow-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{v3 ? "PLAN · SPŁYW RZECZYWISTY" : v2 ? "PLAN · RZECZYWISTOŚĆ" : "PROGNOZA BAZOWA"}</p>
              <h2 id="orders-flow-title">Napływ co 30 minut</h2>
            </div>
            <div className="refresh-info">
              <span className="refresh-dot" />
              <span>{v3 ? "Spływ pokazujemy wyłącznie dla zakończonych przedziałów" : v2 ? "Zakończone sloty zastępują prognozę realnym spływem" : "Fallback · bez korekty realnym spływem"}</span>
            </div>
          </div>

          {demand.slots.length === 20 ? (
            <div className="table-wrap orders-flow-wrap">
              <table className={v3 ? "orders-v3-table" : undefined}>
                <thead>
                  {v3 ? (
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
                  ) : v2 ? (
                    <tr>
                      <th>Przedział</th>
                      <th>Prognoza<br />do realizacji</th>
                      <th>Realnie<br />do realizacji</th>
                      <th>Różnica</th>
                      <th>Do realizacji</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Przedział</th>
                      <th>.PL</th>
                      <th>_PL</th>
                      <th>Prognoza</th>
                      <th>Do realizacji</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {demand.slots.map(slot => {
                    if (v3) {
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
                    }
                    if (v2) {
                      const corrected = slot as CorrectedForecastSlot;
                      return (
                        <tr key={slot.slot_start}>
                          <td>{slot.slot_start}–{slot.slot_end}</td>
                          <td>{formatNumber(slot.eligible_today)}<small className="after-cutoff"> prognoza</small></td>
                          <td>
                            {corrected.actual
                              ? <>{formatNumber(corrected.actual.eligible_total)}<small className="after-cutoff"> wpłynęło {formatNumber(corrected.actual.all_orders)}</small></>
                              : "—"}
                          </td>
                          <td className={varianceClass(corrected.variance_to_forecast)}>
                            {corrected.variance_to_forecast === null ? "—" : formatSigned(corrected.variance_to_forecast)}
                          </td>
                          <td>
                            <span className="eligible-number">{formatNumber(corrected.effective_today)}</span>
                            <small className="after-cutoff">{corrected.effective_source === "actual" ? " realnie" : " prognoza"}</small>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={slot.slot_start}>
                        <td>{slot.slot_start}–{slot.slot_end}</td>
                        <td>{formatNumber(slot.forecast.pl)}</td>
                        <td>{formatNumber(slot.forecast.under)}</td>
                        <td>{formatNumber(slot.forecast.total)}</td>
                        <td><span className="eligible-number">{formatNumber(slot.eligible_today)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  {v3 ? (
                    <>
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
                    </>
                  ) : v2 ? (
                    <>
                      <tr>
                        <td>Zakończone sloty do {demand.real_inflow_to_now.last_slot_end || "teraz"}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.forecast_eligible_for_measured_slots)}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.eligible_actual)}</td>
                        <td className={varianceClass(demand.correction_vs_plan)}>{formatSigned(demand.correction_vs_plan)}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.eligible_actual)}</td>
                      </tr>
                      <tr>
                        <td>Pozostało {demand.real_inflow_to_now.last_slot_end || "teraz"}–16:00</td>
                        <td>{formatNumber(demand.remaining_forecast.eligible_today)}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>{formatNumber(demand.remaining_forecast.eligible_today)}</td>
                      </tr>
                      <tr>
                        <td>Napływ 06:00–16:00</td>
                        <td>{formatNumber(demand.real_inflow_to_now.forecast_eligible_for_measured_slots + demand.remaining_forecast.eligible_today)}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.eligible_actual)}<small className="after-cutoff"> do teraz</small></td>
                        <td className={varianceClass(demand.correction_vs_plan)}>{formatSigned(demand.correction_vs_plan)}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.eligible_actual + demand.remaining_forecast.eligible_today)}</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td>Razem · 06:00–16:00</td>
                      <td>{formatMaybe(forecast?.pl)}</td>
                      <td>{formatMaybe(forecast?.under)}</td>
                      <td>{formatMaybe(forecast?.total)}</td>
                      <td>{formatMaybe(demand.required_today)}</td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          ) : <div className="demand-warning">Brak kompletnego zestawu 20 bloków dla tego dnia.</div>}

          <div className="orders-table-note">
            {v3
              ? <><span>Spływ i różnica są pokazywane tylko dla zakończonych przedziałów.</span><span>Przyszłe przedziały mają wyłącznie plan; nowcast pozostaje osobną prognozą w kartach powyżej.</span></>
              : v2
                ? <><span>Realne dane zastępują prognozę tylko dla zakończonych przedziałów.</span><span>Brak odczytu nie jest traktowany jako zero.</span></>
                : <><span>Widok awaryjny korzysta z prognozy bazowej.</span><span>Korekta realnym spływem jest chwilowo niedostępna.</span></>}
          </div>
        </section>

        <aside className="orders-side">
          <section className="card morning-card">
            <div className="section-heading">
              <div>
                <p className="eyebrow">AKTUALNY PLAN</p>
                <h2>{v3 ? "Do realizacji dzisiaj po cutoffach" : correctedMode ? "Korekta dnia" : "Rano + prognoza"}</h2>
              </div>
            </div>
            {v3 && v3Summary ? (
              <>
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
              </>
            ) : correctedMode ? (
              <>
                <div className="demand-equation">
                  <span>{formatMaybe(demand.required_today_baseline)}</span><i>{(demand.correction_vs_plan ?? 0) >= 0 ? "+" : "−"}</i>
                  <span>{formatNumber(Math.abs(demand.correction_vs_plan ?? 0))}</span><i>=</i>
                  <strong>{formatMaybe(demand.corrected_required_today)}</strong>
                </div>
                <div className="morning-source">
                  Realny spływ: {demand.actual_as_of ? new Date(demand.actual_as_of).toLocaleString("pl-PL") : "—"}
                </div>
              </>
            ) : (
              <>
                <div className="demand-equation"><span>{formatMaybe(morning?.total)}</span><i>+</i><span>{formatMaybe(forecast?.total)}</span><i>=</i><strong>{formatMaybe(gross?.total)}</strong></div>
                <div className="morning-source">Snapshot: {demand.source_as_of ? new Date(demand.source_as_of).toLocaleString("pl-PL") : "—"}</div>
              </>
            )}
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
    planEligibleDay: morning ? morning.total + demand.slots.reduce((sum, slot) => sum + slot.baseline.eligible_today, 0) : null,
    correctedEligibleDay: morning ? morning.total + demand.slots.reduce(
      (sum, slot) => sum + (slot.actual ? slot.actual.eligible_total : slot.baseline.eligible_today),
      0,
    ) : null,
    eligibleDifference: demand.slots.reduce(
      (sum, slot) => sum + ((slot.actual ? slot.actual.eligible_total : slot.baseline.eligible_today) - slot.baseline.eligible_today),
      0,
    ),
    correctedAfterCutoff: morning
      ? (morning.total + correctedInflowTotal) - (
          morning.total + demand.slots.reduce(
            (sum, slot) => sum + (slot.actual ? slot.actual.eligible_total : slot.baseline.eligible_today),
            0,
          )
        )
      : null,
  };
}

function DemandCard({ label, value, detail, accent = false }: { label: string; value: number | null | undefined; detail: string; accent?: boolean }) {
  return <div className={`order-stat${accent ? " plan-gross" : ""}`}><span>{label}</span><strong>{formatMaybe(value)}</strong><small>{detail}</small></div>;
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

function formatSignedNullable(value: number | null | undefined) {
  return typeof value === "number" ? formatSigned(value) : "—";
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

function varianceClass(value: number | null) {
  if (value === null || value === 0) return undefined;
  return value > 0 ? "variance-positive" : "variance-negative";
}

void courierNames;
