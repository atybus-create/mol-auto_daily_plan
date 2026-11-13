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
        {v3 ? (
          <>
            <DemandCard
              label=".PL · nowcast nowych 06–16"
              value={demand.nowcast_forecast.final_pl}
              detail={`baseline ${formatMaybe(demand.nowcast_forecast.baseline_pl)} · wpłynęło ${formatNumber(demand.real_inflow_to_now.pl_actual)} · zostało ${formatNumber(demand.remaining_forecast.pl)}`}
            />
            <DemandCard
              label="_PL · nowcast nowych 06–16"
              value={demand.nowcast_forecast.final_under}
              detail={`baseline ${formatMaybe(demand.nowcast_forecast.baseline_under)} · wpłynęło ${formatNumber(demand.real_inflow_to_now.under_actual)} · zostało ${formatNumber(demand.remaining_forecast.under)}`}
            />
            <DemandCard
              label="Realny spływ do teraz"
              value={demand.real_inflow_to_now.all_actual}
              detail={`.PL ${formatNumber(demand.real_inflow_to_now.pl_actual)} · _PL ${formatNumber(demand.real_inflow_to_now.under_actual)}`}
            />
            <DemandCard
              label="Aktualny target dnia"
              value={demand.corrected_required_today}
              detail={`bazowo ${formatMaybe(demand.required_today_baseline)} · korekta ${formatSignedNullable(demand.correction_vs_plan)}`}
              accent
            />
          </>
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
              <p className="eyebrow">{v3 ? "BASELINE · REAL · NOWCAST" : v2 ? "PLAN · RZECZYWISTOŚĆ" : "PROGNOZA BAZOWA"}</p>
              <h2 id="orders-flow-title">Napływ co 30 minut</h2>
            </div>
            <div className="refresh-info">
              <span className="refresh-dot" />
              <span>{v3 ? "Realny spływ aktualizuje również prognozę przyszłych slotów" : v2 ? "Zakończone sloty zastępują prognozę realnym spływem" : "Fallback · bez korekty realnym spływem"}</span>
            </div>
          </div>

          {demand.slots.length === 20 ? (
            <div className="table-wrap orders-flow-wrap">
              <table>
                <thead>
                  {v3 ? (
                    <>
                      <tr>
                        <th rowSpan={2}>Przedział</th>
                        <th colSpan={2}>.PL</th>
                        <th colSpan={2}>_PL</th>
                        <th rowSpan={2}>Razem</th>
                        <th rowSpan={2}>Do realizacji</th>
                      </tr>
                      <tr>
                        <th>Baseline</th>
                        <th>Real / nowcast</th>
                        <th>Baseline</th>
                        <th>Real / nowcast</th>
                      </tr>
                    </>
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
                      const isActual = nowcast.effective_source === "actual" && Boolean(nowcast.actual);
                      return (
                        <tr key={slot.slot_start}>
                          <td>{slot.slot_start}–{slot.slot_end}</td>
                          <td>{formatNumber(nowcast.baseline.pl)}</td>
                          <td>
                            <span className="eligible-number">{formatNumber(isActual ? nowcast.actual!.pl : nowcast.nowcast.pl)}</span>
                            <small className="after-cutoff">{isActual ? " realnie" : " nowcast"}</small>
                          </td>
                          <td>{formatNumber(nowcast.baseline.under)}</td>
                          <td>
                            <span className="eligible-number">{formatNumber(isActual ? nowcast.actual!.under : nowcast.nowcast.under)}</span>
                            <small className="after-cutoff">{isActual ? " realnie" : " nowcast"}</small>
                          </td>
                          <td>{formatNumber(nowcast.nowcast.total)}</td>
                          <td><span className="eligible-number">{formatNumber(nowcast.effective_today)}</span></td>
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
                        <td>Zakończone sloty do {liveLastSlot || "teraz"}</td>
                        <td>{formatNumber(sumMeasuredBaselineBucket(demand, "pl"))}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.pl_actual)}</td>
                        <td>{formatNumber(sumMeasuredBaselineBucket(demand, "under"))}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.under_actual)}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.all_actual)}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.eligible_actual)}</td>
                      </tr>
                      <tr>
                        <td>Pozostało {liveLastSlot || "teraz"}–16:00</td>
                        <td>{formatNumber(sumFutureBaselineBucket(demand, "pl"))}</td>
                        <td>{formatNumber(demand.remaining_forecast.pl)}</td>
                        <td>{formatNumber(sumFutureBaselineBucket(demand, "under"))}</td>
                        <td>{formatNumber(demand.remaining_forecast.under)}</td>
                        <td>{formatNumber(demand.remaining_forecast.gross_total)}</td>
                        <td>{formatNumber(demand.remaining_forecast.eligible_today)}</td>
                      </tr>
                      <tr>
                        <td>Napływ 06:00–16:00</td>
                        <td>{formatMaybe(demand.nowcast_forecast.baseline_pl)}</td>
                        <td>{formatMaybe(demand.nowcast_forecast.final_pl)}</td>
                        <td>{formatMaybe(demand.nowcast_forecast.baseline_under)}</td>
                        <td>{formatMaybe(demand.nowcast_forecast.final_under)}</td>
                        <td>{formatMaybe(demand.nowcast_forecast.final_gross)}</td>
                        <td>{formatNumber(demand.real_inflow_to_now.eligible_actual + demand.remaining_forecast.eligible_today)}</td>
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
              ? <><span>Realne dane zastępują zakończone sloty i przeliczają prognozę pozostałej części dnia.</span><span>Brak odczytu nie jest traktowany jako zero.</span></>
              : v2
                ? <><span>Realne dane zastępują prognozę tylko dla zakończonych przedziałów.</span><span>Brak odczytu nie jest traktowany jako zero.</span></>
                : <><span>Widok awaryjny korzysta z prognozy bazowej.</span><span>Korekta realnym spływem jest chwilowo niedostępna.</span></>}
          </div>
        </section>

        <aside className="orders-side">
          <section className="card morning-card">
            <div className="section-heading"><div><p className="eyebrow">AKTUALNY PLAN</p><h2>{correctedMode ? "Korekta dnia" : "Rano + prognoza"}</h2></div></div>
            {correctedMode ? (
              <>
                <div className="demand-equation">
                  <span>{formatMaybe(demand.required_today_baseline)}</span><i>{(demand.correction_vs_plan ?? 0) >= 0 ? "+" : "−"}</i>
                  <span>{formatNumber(Math.abs(demand.correction_vs_plan ?? 0))}</span><i>=</i>
                  <strong>{formatMaybe(demand.corrected_required_today)}</strong>
                </div>
                {v3 && morning && (
                  <div className="morning-breakdown">
                    <div><span>Rano .PL</span><b>{formatNumber(morning.pl)}</b></div>
                    <div><span>Rano _PL</span><b>{formatNumber(morning.under)}</b></div>
                  </div>
                )}
                <div className="morning-source">
                  {v3
                    ? `Nowcast nowych 06–16: .PL ${formatMaybe(demand.nowcast_forecast.final_pl)} · _PL ${formatMaybe(demand.nowcast_forecast.final_under)} · razem ${formatMaybe(demand.nowcast_forecast.final_gross)} · pewność ${Math.round(demand.nowcast_forecast.confidence * 100)}%`
                    : `Realny spływ: ${demand.actual_as_of ? new Date(demand.actual_as_of).toLocaleString("pl-PL") : "—"}`}
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

function varianceClass(value: number | null) {
  if (value === null || value === 0) return undefined;
  return value > 0 ? "variance-positive" : "variance-negative";
}

void courierNames;
