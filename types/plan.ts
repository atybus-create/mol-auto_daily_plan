export type ProcessKind = "pick" | "pack";

export type ActivityKind = ProcessKind | "presence" | "duty" | "break" | "clean" | "returns";

export type ActivityBlock = {
  start: string;
  end: string;
  kind: ActivityKind;
};

export type Employee = {
  id: string;
  name: string;
  group: string;
  duty?: boolean;
  progress: Record<ProcessKind, number>;
  blocks: ActivityBlock[];
};

export type OrderFlow = {
  plannedPL: number[];
  plannedUnder: number[];
  actualPL: number[];
  actualUnder: number[];
  morningPL: number;
  morningUnder: number;
  observedThrough: string;
};

export type AppTab = "work" | "orders" | "settings";

export type EmployeeProfile = {
  employee_key: string;
  display_name: string;
  group_name: string;
  can_pick: boolean;
  can_pack: boolean;
  active: boolean;
  es_login: string;
  max_hours: number;
  updated_at?: string | null;
};

export type PlannerNorms = {
  pick_per_hour: number;
  pack_per_hour: number;
  pick_seconds: number;
  pack_seconds: number;
};
