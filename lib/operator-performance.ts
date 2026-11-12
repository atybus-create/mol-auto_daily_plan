import type {
  Employee,
  EmployeeProfile,
  ExecutionOperator,
  ExecutionSnapshotResponse,
  PlannerNorms,
  ProcessKind,
} from "@/types/plan";

export type OperatorMapping = "ok" | "missing_profile" | "missing_login" | "duplicate_login" | "no_data";

export type ProcessPerformance = {
  process: ProcessKind;
  plannedToCutoff: number;
  actualToCutoff: number | null;
  cutoffRealization: number | null;
  plannedDay: number;
  actualDay: number | null;
  dayRealization: number | null;
  remaining: number | null;
};

export type OperatorPerformanceRow = {
  id: string;
  name: string;
  group: string;
  mapping: OperatorMapping;
  processes: Record<ProcessKind, ProcessPerformance>;
};

export type OperatorPerformanceModel = {
  cutoffMinutes: number;
  rows: OperatorPerformanceRow[];
  team: Record<ProcessKind, ProcessPerformance>;
  unmappedOperators: number;
};

export function buildOperatorPerformance(
  employees: Employee[],
  profiles: EmployeeProfile[],
  execution: ExecutionSnapshotResponse | null,
  norms: PlannerNorms,
  businessDate: string,
  now = new Date(),
): OperatorPerformanceModel {
  const cutoffMinutes = resolveCutoffMinutes(businessDate, execution?.latest?.collected_at ?? null, now);
  const profileMap = new Map(profiles.map(profile => [profile.employee_key, profile]));
  const loginCounts = new Map<string, number>();

  for (const employee of employees) {
    const login = normalizeEsLogin(profileMap.get(employee.id)?.es_login);
    if (login) loginCounts.set(login, (loginCounts.get(login) ?? 0) + 1);
  }

  const operatorMap = aggregateOperators(execution?.latest?.operators ?? []);
  const employeeExecution = new Map(
    (execution?.latest?.employee_execution ?? [])
      .filter(item => item.mapped && item.employee_key)
      .map(item => [item.employee_key!, item]),
  );
  const hasEmployeeContract = execution?.latest?.employee_execution !== undefined;
  const mappedLogins = new Set<string>();

  // A saved plan remains a plan even when its latest revision has no remaining PICK/PAK
  // blocks (for example after the day's workload has already been completed). Keep every
  // employee from the restored plan so the plan-vs-execution table can still be rendered.
  const rows = employees.map(employee => {
    const profile = profileMap.get(employee.id);
    const login = normalizeEsLogin(profile?.es_login);
    let mapping: OperatorMapping;

    if (employeeExecution.has(employee.id)) mapping = "ok";
    else if (!profile) mapping = "missing_profile";
    else if (!login) mapping = "missing_login";
    else if ((loginCounts.get(login) ?? 0) > 1) mapping = "duplicate_login";
    else if (hasEmployeeContract) mapping = "no_data";
    else if (!operatorMap.has(login)) mapping = "no_data";
    else {
      mapping = "ok";
      mappedLogins.add(login);
    }

    const operator = employeeExecution.get(employee.id) ?? (!hasEmployeeContract && mapping === "ok" ? operatorMap.get(login) : undefined);
    return {
      id: employee.id,
      name: employee.name,
      group: employee.group,
      mapping,
      processes: {
        pick: processPerformance(employee, "pick", norms.pick_per_hour, cutoffMinutes, operator?.pick_completed ?? null),
        pack: processPerformance(employee, "pack", norms.pack_per_hour, cutoffMinutes, operator?.pack_completed ?? null),
      },
    };
  });

  const latestStatus = execution?.latest?.data_status.toUpperCase() ?? "";
  const hasExecution = Boolean(execution?.latest)
    && execution?.status !== "error"
    && !latestStatus.includes("ERROR")
    && !latestStatus.includes("NO DATA");
  const team = {
    pick: teamPerformance(rows, "pick", hasExecution ? execution!.latest!.pick_completed : null),
    pack: teamPerformance(rows, "pack", hasExecution ? execution!.latest!.pack_completed : null),
  };

  return {
    cutoffMinutes,
    rows,
    team,
    unmappedOperators: hasEmployeeContract
      ? (execution?.latest?.unmapped_count ?? execution?.latest?.unmapped_operators?.length ?? 0)
      : [...operatorMap.keys()].filter(login => !mappedLogins.has(login)).length,
  };
}

function processPerformance(
  employee: Employee,
  process: ProcessKind,
  rate: number,
  cutoffMinutes: number,
  actual: number | null,
): ProcessPerformance {
  const plannedToCutoff = capacity(employee, process, rate, cutoffMinutes, true);
  const plannedDay = capacity(employee, process, rate, Number.POSITIVE_INFINITY, false);
  return metrics(process, plannedToCutoff, plannedDay, actual);
}

function teamPerformance(rows: OperatorPerformanceRow[], process: ProcessKind, actual: number | null): ProcessPerformance {
  const plannedToCutoff = rows.reduce((sum, row) => sum + row.processes[process].plannedToCutoff, 0);
  const plannedDay = rows.reduce((sum, row) => sum + row.processes[process].plannedDay, 0);
  return metrics(process, plannedToCutoff, plannedDay, actual);
}

function metrics(
  process: ProcessKind,
  plannedToCutoff: number,
  plannedDay: number,
  actual: number | null,
): ProcessPerformance {
  return {
    process,
    plannedToCutoff,
    actualToCutoff: actual,
    cutoffRealization: realization(actual, plannedToCutoff),
    plannedDay,
    actualDay: actual,
    dayRealization: realization(actual, plannedDay),
    remaining: actual === null ? null : Math.max(0, plannedDay - actual),
  };
}

function capacity(employee: Employee, process: ProcessKind, rate: number, cutoffMinutes: number, closedOnly: boolean) {
  const minutes = employee.blocks.reduce((sum, block) => {
    if (block.kind !== process) return sum;
    const start = timeToMinutes(block.start);
    const end = timeToMinutes(block.end);
    if (closedOnly && end > cutoffMinutes) return sum;
    return sum + Math.max(0, end - start);
  }, 0);
  return (minutes / 60) * rate;
}

function aggregateOperators(operators: ExecutionOperator[]) {
  const result = new Map<string, ExecutionOperator>();
  for (const operator of operators) {
    const login = normalizeEsLogin(operator.operator);
    if (!login) continue;
    const previous = result.get(login);
    result.set(login, {
      operator: operator.operator,
      pick_completed: (previous?.pick_completed ?? 0) + finiteOrZero(operator.pick_completed),
      pack_completed: (previous?.pack_completed ?? 0) + finiteOrZero(operator.pack_completed),
    });
  }
  return result;
}

function realization(actual: number | null, plan: number) {
  return actual === null || plan <= 0 ? null : (actual / plan) * 100;
}

function resolveCutoffMinutes(businessDate: string, collectedAt: string | null, now: Date) {
  const snapshotParts = collectedAt ? warsawParts(new Date(collectedAt)) : null;
  if (snapshotParts?.date === businessDate) return snapshotParts.minutes;

  const nowParts = warsawParts(now) ?? { date: businessDate, minutes: 0 };
  if (businessDate < nowParts.date) return Number.POSITIVE_INFINITY;
  if (businessDate > nowParts.date) return 0;
  return nowParts.minutes;
}

function warsawParts(value: Date) {
  if (Number.isNaN(value.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return finiteOrZero(hours) * 60 + finiteOrZero(minutes);
}

function normalizeEsLogin(value: string | null | undefined) {
  return String(value ?? "").trim().toLocaleLowerCase("pl-PL");
}

function finiteOrZero(value: number) {
  return Number.isFinite(value) ? value : 0;
}
