"use client";

import { useEffect, useState } from "react";
import type { ActivityKind } from "@/types/plan";

type Props = {
  employeeName: string;
  blockStart: string;
  blockEnd: string;
  activity: ActivityKind;
  saving: boolean;
  onCancel: () => void;
  onSave: (value: { start: string; end: string; activity: ActivityKind; reason: string }) => void;
};

const options: Array<{ value: ActivityKind; label: string }> = [
  { value: "pick", label: "PICK" },
  { value: "pack", label: "PAK" },
  { value: "presence", label: "Obecność / bez przydziału" },
  { value: "clean", label: "Porządki" },
  { value: "returns", label: "Zwroty" },
  { value: "break", label: "Przerwa" },
];

export function ManualPlanEditor({ employeeName, blockStart, blockEnd, activity, saving, onCancel, onSave }: Props) {
  const [start, setStart] = useState(blockStart);
  const [end, setEnd] = useState(blockEnd);
  const [kind, setKind] = useState<ActivityKind>(activity === "duty" ? "presence" : activity);
  const [reason, setReason] = useState("Korekta lidera");

  useEffect(() => {
    setStart(blockStart);
    setEnd(blockEnd);
    setKind(activity === "duty" ? "presence" : activity);
    setReason("Korekta lidera");
  }, [employeeName, blockStart, blockEnd, activity]);

  return (
    <div className="manual-editor-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onCancel();
    }}>
      <section className="manual-editor" role="dialog" aria-modal="true" aria-labelledby="manual-editor-title">
        <div className="manual-editor-heading">
          <div>
            <p className="eyebrow">KOREKTA RĘCZNA</p>
            <h2 id="manual-editor-title">{employeeName}</h2>
          </div>
          <button type="button" className="icon-button" aria-label="Zamknij korektę" onClick={onCancel} disabled={saving}>×</button>
        </div>

        <div className="manual-editor-body">
          <div className="manual-editor-time">
            <label>Od
              <input type="time" step="900" value={start} onChange={event => setStart(event.target.value)} />
            </label>
            <label>Do
              <input type="time" step="900" value={end} onChange={event => setEnd(event.target.value)} />
            </label>
          </div>

          <fieldset>
            <legend>Czynność</legend>
            <div className="manual-editor-activities">
              {options.map(option => (
                <label key={option.value} className={kind === option.value ? "selected" : ""}>
                  <input type="radio" name="manual-activity" value={option.value} checked={kind === option.value}
                    onChange={() => setKind(option.value)} />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="manual-editor-reason">Powód / notatka
            <input type="text" maxLength={240} value={reason} onChange={event => setReason(event.target.value)} />
          </label>

          <p className="manual-editor-note">
            Zapis tworzy nową wersję planu. Blok zostanie zablokowany przed kolejnymi automatycznymi przeliczeniami, a pozostała część dnia zostanie przeliczona ponownie.
          </p>
        </div>

        <div className="manual-editor-footer">
          <button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>Anuluj</button>
          <button type="button" className="button button-primary" onClick={() => onSave({ start, end, activity: kind, reason })} disabled={saving || !start || !end}>
            {saving ? "Przeliczanie…" : "Zapisz korektę i przelicz"}
          </button>
        </div>
      </section>
    </div>
  );
}
