import type { DayDemandSnapshot, DemandTotals, ForecastSlot, ForecastTotals } from "@/types/plan";

const SLOT_MINUTES = 30;
const START_MINUTES = 6 * 60;
const END_MINUTES = 16 * 60;

function formatTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export const FORECAST_SLOT_STARTS = Object.freeze(
  Array.from({ length: (END_MINUTES - START_MINUTES) / SLOT_MINUTES }, (_, index) =>
    formatTime(START_MINUTES + index * SLOT_MINUTES)),
);

export function expectedSlotEnd(slotStart: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(slotStart);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]) + SLOT_MINUTES;
  return minutes <= 24 * 60 ? formatTime(minutes) : null;
}

export function sumDemand(left: DemandTotals, right: DemandTotals): DemandTotals {
  return { pl: left.pl + right.pl, under: left.under + right.under, total: left.total + right.total };
}

export function grossPlan(morning: DemandTotals | null, forecast: ForecastTotals | null) {
  return morning && forecast ? sumDemand(morning, forecast) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function totalsErrors(value: unknown, path: string, withRange = false) {
  if (!isRecord(value)) return [`${path}: brak danych`];
  const errors: string[] = [];
  for (const key of ["pl", "under", "total"] as const) {
    if (!isNonNegativeNumber(value[key])) errors.push(`${path}.${key}: oczekiwano liczby nieujemnej`);
  }
  if (isNonNegativeNumber(value.pl) && isNonNegativeNumber(value.under) && isNonNegativeNumber(value.total)
      && Math.abs(value.pl + value.under - value.total) > 0.001) {
    errors.push(`${path}.total: suma .PL i _PL jest niespójna`);
  }
  if (withRange) {
    if (!isNonNegativeNumber(value.p10)) errors.push(`${path}.p10: oczekiwano liczby nieujemnej`);
    if (!isNonNegativeNumber(value.p90)) errors.push(`${path}.p90: oczekiwano liczby nieujemnej`);
    if (isNonNegativeNumber(value.p10) && isNonNegativeNumber(value.total) && value.p10 > value.total) {
      errors.push(`${path}.p10: wartość przekracza prognozę bazową`);
    }
    if (isNonNegativeNumber(value.p90) && isNonNegativeNumber(value.total) && value.p90 < value.total) {
      errors.push(`${path}.p90: wartość jest mniejsza od prognozy bazowej`);
    }
  }
  return errors;
}

export type DemandValidation = { valid: boolean; errors: string[] };

export function validateForecastSlots(slots: unknown): DemandValidation {
  if (!Array.isArray(slots)) return { valid: false, errors: ["slots: oczekiwano tablicy"] };
  const errors: string[] = [];
  if (slots.length !== FORECAST_SLOT_STARTS.length) errors.push("slots: oczekiwano dokładnie 20 bloków");
  slots.forEach((value, index) => {
    if (!isRecord(value)) {
      errors.push(`slots[${index}]: nieprawidłowy rekord`);
      return;
    }
    const slot = value as Partial<ForecastSlot>;
    const expectedStart = FORECAST_SLOT_STARTS[index];
    if (slot.slot_start !== expectedStart) errors.push(`slots[${index}].slot_start: oczekiwano ${expectedStart ?? "braku"}`);
    const expectedEnd = expectedStart ? expectedSlotEnd(expectedStart) : null;
    if (slot.slot_end !== expectedEnd) errors.push(`slots[${index}].slot_end: oczekiwano ${expectedEnd ?? "braku"}`);
    errors.push(...totalsErrors(slot.forecast, `slots[${index}].forecast`, true));
    for (const key of ["cumulative_forecast", "eligible_today", "after_cutoff"] as const) {
      if (!isNonNegativeNumber(slot[key])) errors.push(`slots[${index}].${key}: oczekiwano liczby nieujemnej`);
    }
    if (slot.cumulative_plan_gross !== null && !isNonNegativeNumber(slot.cumulative_plan_gross)) {
      errors.push(`slots[${index}].cumulative_plan_gross: oczekiwano liczby nieujemnej albo null`);
    }
    if (!Array.isArray(slot.by_carrier)) {
      errors.push(`slots[${index}].by_carrier: oczekiwano tablicy`);
    } else {
      let carrierPoint = 0;
      slot.by_carrier.forEach((carrier, carrierIndex) => {
        if (!isRecord(carrier)) {
          errors.push(`slots[${index}].by_carrier[${carrierIndex}]: nieprawidłowy rekord`);
          return;
        }
        if (!["allegro_one", "inpost_orlen", "other", "unknown"].includes(String(carrier.group))) {
          errors.push(`slots[${index}].by_carrier[${carrierIndex}].group: nieprawidłowa grupa`);
        }
        for (const key of ["point", "p10", "p90", "eligible_today", "after_cutoff"] as const) {
          if (!isNonNegativeNumber(carrier[key])) {
            errors.push(`slots[${index}].by_carrier[${carrierIndex}].${key}: oczekiwano liczby nieujemnej`);
          }
        }
        if (isNonNegativeNumber(carrier.point)) carrierPoint += carrier.point;
      });
      const slotTotal = isRecord(slot.forecast) && isNonNegativeNumber(slot.forecast.total) ? slot.forecast.total : null;
      if (slotTotal !== null && Math.abs(carrierPoint - slotTotal) > 0.001) {
        errors.push(`slots[${index}].by_carrier: suma kurierów jest niespójna z prognozą slotu`);
      }
    }
  });
  return { valid: errors.length === 0, errors };
}

export function validateDayDemandSnapshot(value: unknown, requestedDate?: string): DemandValidation {
  if (!isRecord(value)) return { valid: false, errors: ["odpowiedź: oczekiwano obiektu"] };
  const errors: string[] = [];
  if (value.ok !== true) errors.push("ok: backend nie potwierdził poprawnej odpowiedzi");
  if (typeof value.business_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.business_date)) {
    errors.push("business_date: nieprawidłowa data");
  } else if (requestedDate && value.business_date !== requestedDate) errors.push("business_date: backend zwrócił inny dzień");
  if (value.timezone !== "Europe/Warsaw") errors.push("timezone: oczekiwano Europe/Warsaw");
  if (value.forecast_kind !== "DAILY_BASELINE") errors.push("forecast_kind: oczekiwano DAILY_BASELINE");
  if (!["ready", "partial", "stale", "unavailable"].includes(String(value.status))) errors.push("status: nieprawidłowa wartość");
  if (value.quality !== undefined && !["low", "medium", "good"].includes(String(value.quality))) errors.push("quality: nieprawidłowa wartość");
  if (!Array.isArray(value.warnings) || value.warnings.some(item => typeof item !== "string")) errors.push("warnings: oczekiwano tablicy tekstów");

  const hasMorning = value.morning !== null && value.morning !== undefined;
  const hasForecast = value.forecast !== null && value.forecast !== undefined;
  const hasPlan = value.plan_gross !== null && value.plan_gross !== undefined;
  if (hasMorning) errors.push(...totalsErrors(value.morning, "morning"));
  if (hasForecast) errors.push(...totalsErrors(value.forecast, "forecast", true));
  if (hasPlan) errors.push(...totalsErrors(value.plan_gross, "plan_gross"));

  if (value.status === "ready" || value.status === "stale") {
    if (!hasMorning) errors.push("morning: wymagane dla kompletnego snapshotu");
    if (!hasForecast) errors.push("forecast: wymagane dla kompletnego snapshotu");
    if (!hasPlan) errors.push("plan_gross: wymagane dla kompletnego snapshotu");
    errors.push(...validateForecastSlots(value.slots).errors);
  } else if (!Array.isArray(value.slots)) errors.push("slots: oczekiwano tablicy");

  if (hasMorning && hasForecast && hasPlan) {
    const expected = grossPlan(value.morning as DemandTotals, value.forecast as ForecastTotals)!;
    const plan = value.plan_gross as DemandTotals;
    if (Math.abs(expected.pl - plan.pl) > 0.001 || Math.abs(expected.under - plan.under) > 0.001
        || Math.abs(expected.total - plan.total) > 0.001) errors.push("plan_gross: nie jest sumą morning i forecast");
  }
  if ((value.status === "ready" || value.status === "stale") && Array.isArray(value.slots) && hasForecast) {
    const slotSum = value.slots.reduce((sum, slot) => {
      return sum + (isRecord(slot) && isRecord(slot.forecast) && isNonNegativeNumber(slot.forecast.total) ? slot.forecast.total : 0);
    }, 0);
    const forecastTotal = (value.forecast as ForecastTotals).total;
    if (Math.abs(slotSum - forecastTotal) > 0.001) errors.push("slots: suma prognoz nie jest zgodna z prognozą dzienną");
  }
  for (const key of ["required_today", "after_cutoff"] as const) {
    if (value[key] !== null && !isNonNegativeNumber(value[key])) errors.push(`${key}: oczekiwano liczby nieujemnej albo null`);
  }
  if (hasPlan && isNonNegativeNumber(value.required_today) && isNonNegativeNumber(value.after_cutoff)
      && Math.abs(value.required_today + value.after_cutoff - (value.plan_gross as DemandTotals).total) > 0.001) {
    errors.push("required_today i after_cutoff: suma jest niespójna z plan_gross.total");
  }
  return { valid: errors.length === 0, errors };
}

export function asDayDemandSnapshot(value: unknown, requestedDate?: string): DayDemandSnapshot | null {
  return validateDayDemandSnapshot(value, requestedDate).valid ? value as DayDemandSnapshot : null;
}


export function validateOrdersDemandSnapshot(value: unknown, requestedDate?: string): DemandValidation {
  if (!isRecord(value) || !("contract_version" in value)) return validateDayDemandSnapshot(value, requestedDate);

  if (value.contract_version === 3) {
    const baselineRequired = value.required_today_baseline;
    const plan = isRecord(value.plan_gross) ? value.plan_gross : null;
    const baselineAfter = plan && isNonNegativeNumber(plan.total) && isNonNegativeNumber(baselineRequired)
      ? plan.total - baselineRequired
      : null;

    const baselineView = {
      ...value,
      forecast_kind: "DAILY_BASELINE",
      required_today: baselineRequired,
      after_cutoff: baselineAfter,
    };
    const errors = [...validateDayDemandSnapshot(baselineView, requestedDate).errors];

    for (const key of ["required_today_baseline", "corrected_required_today", "corrected_plan_gross_total"] as const) {
      if (value[key] !== null && !isNonNegativeNumber(value[key])) errors.push(`${key}: oczekiwano liczby nieujemnej albo null`);
    }
    if (value.correction_vs_plan !== null && (typeof value.correction_vs_plan !== "number" || !Number.isFinite(value.correction_vs_plan))) {
      errors.push("correction_vs_plan: oczekiwano liczby albo null");
    }

    if (!isRecord(value.nowcast_forecast)) {
      errors.push("nowcast_forecast: brak danych");
    } else {
      for (const key of ["remaining_gross", "confidence"] as const) {
        if (!isNonNegativeNumber(value.nowcast_forecast[key])) errors.push(`nowcast_forecast.${key}: oczekiwano liczby nieujemnej`);
      }
      for (const key of ["baseline_gross", "projected_final_from_pace", "final_gross"] as const) {
        if (value.nowcast_forecast[key] !== null && !isNonNegativeNumber(value.nowcast_forecast[key])) {
          errors.push(`nowcast_forecast.${key}: oczekiwano liczby nieujemnej albo null`);
        }
      }
      if (typeof value.nowcast_forecast.guardrail_applied !== "boolean") {
        errors.push("nowcast_forecast.guardrail_applied: oczekiwano boolean");
      }
      if (isNonNegativeNumber(value.nowcast_forecast.confidence) && value.nowcast_forecast.confidence > 1) {
        errors.push("nowcast_forecast.confidence: wartość powinna być w zakresie 0–1");
      }
    }

    if (!isRecord(value.real_inflow_to_now)) {
      errors.push("real_inflow_to_now: brak danych");
    } else {
      for (const key of ["measured_slots", "eligible_actual", "all_actual", "pl_actual", "under_actual"] as const) {
        if (!isNonNegativeNumber(value.real_inflow_to_now[key])) errors.push(`real_inflow_to_now.${key}: oczekiwano liczby nieujemnej`);
      }
      if (value.real_inflow_to_now.variance_to_baseline_gross !== null
          && (typeof value.real_inflow_to_now.variance_to_baseline_gross !== "number"
            || !Number.isFinite(value.real_inflow_to_now.variance_to_baseline_gross))) {
        errors.push("real_inflow_to_now.variance_to_baseline_gross: oczekiwano liczby albo null");
      }
    }

    if (!isRecord(value.remaining_forecast)) {
      errors.push("remaining_forecast: brak danych");
    } else {
      for (const key of ["eligible_today", "after_cutoff", "gross_total"] as const) {
        if (!isNonNegativeNumber(value.remaining_forecast[key])) errors.push(`remaining_forecast.${key}: oczekiwano liczby nieujemnej`);
      }
    }

    if (Array.isArray(value.slots)) {
      value.slots.forEach((slot, index) => {
        if (!isRecord(slot)) return;
        if (!["actual", "nowcast"].includes(String(slot.effective_source))) {
          errors.push(`slots[${index}].effective_source: nieprawidłowe źródło V3`);
        }
        if (!isNonNegativeNumber(slot.effective_today)) {
          errors.push(`slots[${index}].effective_today: oczekiwano liczby nieujemnej`);
        }
        if (!isRecord(slot.baseline)) {
          errors.push(`slots[${index}].baseline: brak danych`);
        } else {
          for (const key of ["total", "eligible_today", "after_cutoff"] as const) {
            if (!isNonNegativeNumber(slot.baseline[key])) errors.push(`slots[${index}].baseline.${key}: oczekiwano liczby nieujemnej`);
          }
        }
        if (!isRecord(slot.nowcast)) {
          errors.push(`slots[${index}].nowcast: brak danych`);
        } else {
          for (const key of ["total", "eligible_today", "after_cutoff"] as const) {
            if (!isNonNegativeNumber(slot.nowcast[key])) errors.push(`slots[${index}].nowcast.${key}: oczekiwano liczby nieujemnej`);
          }
          if (!Array.isArray(slot.nowcast.by_carrier)) errors.push(`slots[${index}].nowcast.by_carrier: oczekiwano tablicy`);
        }
        if (slot.variance_to_forecast !== null && (typeof slot.variance_to_forecast !== "number" || !Number.isFinite(slot.variance_to_forecast))) {
          errors.push(`slots[${index}].variance_to_forecast: oczekiwano liczby albo null`);
        }
      });
    }

    if (isNonNegativeNumber(value.required_today) && isNonNegativeNumber(value.corrected_required_today)
        && Math.abs(value.required_today - value.corrected_required_today) > 0.001) {
      errors.push("required_today: powinno być równe corrected_required_today w kontrakcie V3");
    }
    if (isNonNegativeNumber(value.required_today) && isNonNegativeNumber(value.after_cutoff)
        && isNonNegativeNumber(value.corrected_plan_gross_total)
        && Math.abs(value.required_today + value.after_cutoff - value.corrected_plan_gross_total) > 0.001) {
      errors.push("V3: required_today + after_cutoff powinno być równe corrected_plan_gross_total");
    }

    return { valid: errors.length === 0, errors };
  }

  if (value.contract_version !== 2) return validateDayDemandSnapshot(value, requestedDate);

  const baselineRequired = value.required_today_baseline;
  const plan = isRecord(value.plan_gross) ? value.plan_gross : null;
  const baselineAfter = plan && isNonNegativeNumber(plan.total) && isNonNegativeNumber(baselineRequired)
    ? plan.total - baselineRequired
    : null;

  const baselineView = {
    ...value,
    required_today: baselineRequired,
    after_cutoff: baselineAfter,
  };
  const errors = [...validateDayDemandSnapshot(baselineView, requestedDate).errors];

  for (const key of ["required_today_baseline", "corrected_required_today", "corrected_plan_gross_total"] as const) {
    if (value[key] !== null && !isNonNegativeNumber(value[key])) errors.push(`${key}: oczekiwano liczby nieujemnej albo null`);
  }
  if (typeof value.correction_vs_plan !== "number" || !Number.isFinite(value.correction_vs_plan)) {
    errors.push("correction_vs_plan: oczekiwano liczby");
  }

  if (!isRecord(value.real_inflow_to_now)) {
    errors.push("real_inflow_to_now: brak danych");
  } else {
    for (const key of ["measured_slots", "eligible_actual", "all_actual", "pl_actual", "under_actual", "forecast_eligible_for_measured_slots"] as const) {
      if (!isNonNegativeNumber(value.real_inflow_to_now[key])) errors.push(`real_inflow_to_now.${key}: oczekiwano liczby nieujemnej`);
    }
    if (typeof value.real_inflow_to_now.variance !== "number" || !Number.isFinite(value.real_inflow_to_now.variance)) {
      errors.push("real_inflow_to_now.variance: oczekiwano liczby");
    }
  }

  if (!isRecord(value.remaining_forecast)) {
    errors.push("remaining_forecast: brak danych");
  } else {
    for (const key of ["eligible_today", "after_cutoff", "gross_total", "pl", "under"] as const) {
      if (!isNonNegativeNumber(value.remaining_forecast[key])) errors.push(`remaining_forecast.${key}: oczekiwano liczby nieujemnej`);
    }
  }

  if (Array.isArray(value.slots)) {
    value.slots.forEach((slot, index) => {
      if (!isRecord(slot)) return;
      if (!["actual", "forecast"].includes(String(slot.effective_source))) {
        errors.push(`slots[${index}].effective_source: nieprawidłowe źródło`);
      }
      if (!isNonNegativeNumber(slot.effective_today)) {
        errors.push(`slots[${index}].effective_today: oczekiwano liczby nieujemnej`);
      }
      if (slot.variance_to_forecast !== null && (typeof slot.variance_to_forecast !== "number" || !Number.isFinite(slot.variance_to_forecast))) {
        errors.push(`slots[${index}].variance_to_forecast: oczekiwano liczby albo null`);
      }
      if (slot.actual !== null && slot.actual !== undefined) {
        if (!isRecord(slot.actual)) {
          errors.push(`slots[${index}].actual: nieprawidłowy rekord`);
        } else {
          for (const key of ["pl", "under", "eligible_total", "all_orders", "sr_total", "bl_total", "rejected_allegro_one", "rejected_other_after12"] as const) {
            if (!isNonNegativeNumber(slot.actual[key])) errors.push(`slots[${index}].actual.${key}: oczekiwano liczby nieujemnej`);
          }
        }
      }
    });
  }

  if (isNonNegativeNumber(value.required_today) && isNonNegativeNumber(value.corrected_required_today)
      && Math.abs(value.required_today - value.corrected_required_today) > 0.001) {
    errors.push("required_today: powinno być równe corrected_required_today w kontrakcie V2");
  }

  return { valid: errors.length === 0, errors };
}

