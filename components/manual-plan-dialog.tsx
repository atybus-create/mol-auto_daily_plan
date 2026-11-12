"use client";

import { useEffect, useRef, useState } from "react";
import type { ActivityBlock, ActivityKind, Employee, EmployeeProfile, PlanManualOverride } from "@/types/plan";

type Props = {
  employee: Employee;
  block: ActivityBlock;
  profile: EmployeeProfile | null;
  saving: boolean;
  onClose: () => void;
  onSave: (override: PlanManualOverride) => void;
  onRemove: (overrideId: string) => void;
};

const labels: Record<ActivityKind, string> = {
  pick: "PICK",
  pack: "PAK",
  presence: "Obecność / bez przydziału",
  duty: "Dyżur",
  break: "Przerwa",
  clean: "Porządki",
  returns: "Zwroty",
};

export function ManualPlanDialog({ employee, block, profile, saving, onClose, onSave, onRemove }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [start, setStart] = useState(block.start);
  const [end, setEnd] = useState(block.end);
  const [activity, setActivity] = useState<ActivityKind>(block.kind === "duty" ? "presence" : block.kind);
  const [reason, setReason] = useState(block.reason || "Korekta lidera");

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const allowed = (["pick", "pack", "presence", "clean", "returns", "break"] as ActivityKind[])
    .filter(kind => kind !== "pick" || profile?.can_pick !== false)
    .filter(kind => kind !== "pack" || profile?.can_pack !== false);

  function submit() {
    if (!start || !end || start >= end || !isQuarterHour(start) || !isQuarterHour(end)) return;
    const overrideId = block.override_id
      || `manual_${employee.id}_${start.replace(":", "")}_${end.replace(":", "")}_${Date.now()}`;
    onSave({
      override_id: overrideId,
      employee_key: employee.id,
      start,
      end,
      activity,
      locked: true,
      created_at: new Date().toISOString(),
      reason: reason.trim() || "Korekta lidera",
    });
  }

  return (
    <dialog ref={ref} className="activity-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <button className="dialog-close" type="button" aria-label="Zamknij" onClick={onClose}>×</button>
      <p className="eyebrow">RĘCZNA KOREKTA PLANU</p>
      <h2>{employee.name}</h2>
      <p className="activity-dialog-hint">
        Zapis tworzy nową wersję planu. Ten zakres zostanie zablokowany i kolejne automatyczne przeliczenia ułożą plan wokół niego.
      </p>

      <div className="activity-dialog-grid">
        <label>
          Od
          <input type="time" step="900" value={start} onChange={event => setStart(event.target.value)} />
        </label>
        <label>
          Do
          <input type="time" step="900" value={end} onChange={event => setEnd(event.target.value)} />
        </label>
      </div>

      <label>
        Czynność
        <select value={activity} onChange={event => setActivity(event.target.value as ActivityKind)}>
          {allowed.map(kind => <option key={kind} value={kind}>{labels[kind]}</option>)}
        </select>
      </label>

      <label>
        Powód / notatka
        <input type="text" maxLength={240} value={reason} onChange={event => setReason(event.target.value)} />
      </label>

      <div className="dialog-actions">
        {block.locked && block.override_id && (
          <button className="button button-secondary manual-unlock-button" type="button" disabled={saving} onClick={() => onRemove(block.override_id!)}>
            Odblokuj
          </button>
        )}
        <button className="button button-secondary" type="button" disabled={saving} onClick={onClose}>Anuluj</button>
        <button className="button button-primary" type="button" disabled={saving || start >= end || !isQuarterHour(start) || !isQuarterHour(end)} onClick={submit}>
          {saving ? "Przeliczanie…" : "Zapisz i przelicz"}
        </button>
      </div>
    </dialog>
  );
}

function isQuarterHour(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && minute % 15 === 0;
}
