"use client";

import { useEffect, useState } from "react";
import { CUTOFF_OPTIONS, isDayCutoffState, type CutoffMode, type CutoffScope, type CutoffTime, type DayCutoffState } from "@/lib/day-cutoff";

const zone = "Europe/Warsaw";

type Props = {
  date: string;
  onApplied: (expectedCutoff: CutoffTime) => Promise<void>;
};

async function readState(response: Response, date: string) {
  const body = await response.json();
  if (!response.ok || !isDayCutoffState(body) || body.business_date !== date) {
    throw new Error(typeof body?.message === "string" ? body.message : "Nie udało się odczytać ustawień cutoffu.");
  }
  return body;
}

export function DayCutoffSettings({ date, onApplied }: Props) {
  const [saved, setSaved] = useState<DayCutoffState | null>(null);
  const [mode, setMode] = useState<CutoffMode>("STANDARD");
  const [custom, setCustom] = useState<CutoffTime>("12:00");
  const [weekday, setWeekday] = useState<CutoffTime>("16:00");
  const [saving, setSaving] = useState<CutoffScope | null>(null);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/day-cutoff?date=${encodeURIComponent(date)}`, { cache: "no-store", signal: controller.signal })
      .then(response => readState(response, date))
      .then(data => {
        if (controller.signal.aborted) return;
        setSaved(data);
        setMode(data.mode);
        setCustom(data.effective_cutoff_local);
        setWeekday(data.weekday_default_cutoff_local);
      })
      .catch(error => {
        if (!controller.signal.aborted) setNotice({ error: true, text: error.message });
      });
    return () => controller.abort();
  }, [date]);

  const now = new Date();
  const today = now.toLocaleDateString("sv-SE", { timeZone: zone });
  const isToday = date === today;
  const [hour, minute] = now.toLocaleTimeString("en-GB", { timeZone: zone, timeStyle: "short", hourCycle: "h23" }).split(":").map(Number);
  const elapsed = Math.ceil((hour * 60 + minute) / 30) * 30;
  const isElapsed = (time: CutoffTime) => {
    const [hours, minutes] = time.split(":").map(Number);
    return isToday && hours * 60 + minutes < elapsed;
  };
  const defaultCustom = CUTOFF_OPTIONS.find(time => !isElapsed(time) && time >= (saved?.default_cutoff_local ?? "12:00"))
    ?? CUTOFF_OPTIONS.find(time => !isElapsed(time));

  async function save(scope: CutoffScope) {
    if (!saved || saving) return;
    setSaving(scope);
    setNotice(null);
    let persisted = false;
    try {
      const nextMode = scope === "WEEKDAY_DEFAULT" ? "CUSTOM" : mode;
      const response = await fetch("/api/day-cutoff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, scope, mode: nextMode, cutoff_local: scope === "WEEKDAY_DEFAULT" ? weekday : (nextMode === "CUSTOM" ? custom : null) }),
      });
      const next = await readState(response, date);
      persisted = true;
      setSaved(next);
      setMode(next.mode);
      setCustom(next.effective_cutoff_local);
      setWeekday(next.weekday_default_cutoff_local);
      if (isToday && (scope === "DATE" || next.effective_cutoff_local !== saved.effective_cutoff_local)) {
        await onApplied(next.effective_cutoff_local);
      }
      setNotice({ error: false, text: scope === "DATE" ? "Zapisano cutoff dla wybranego dnia." : "Zapisano domyślny cutoff od wtorku do piątku." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Błąd ustawień cutoffu.";
      setNotice({ error: true, text: persisted ? `Cutoff zapisany. Przeliczenie planu wymaga ponowienia. ${message}` : message });
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="card settings-norms cutoff-settings-card">
      <div className="settings-card-heading">
        <div><p className="eyebrow">PLANOWANIE</p><h2>Cutoff planistyczny</h2></div>
        {saved && <span>{date} · {saved.effective_cutoff_local}</span>}
      </div>
      <div className="cutoff-settings-body">
        <p className="settings-paragraph">Godzina graniczna dla zamówień uwzględnianych w planie magazynu. Zamówienia podlegają też limitom poszczególnych przewoźników.</p>
        <div className="settings-fields-pair cutoff-fields">
          <div className="settings-field">
            <label htmlFor="cutoff-weekday">Domyślnie od wtorku do piątku</label>
            <select id="cutoff-weekday" value={weekday} disabled={!saved || Boolean(saving)}
              onChange={event => { setWeekday(event.target.value as CutoffTime); setNotice(null); }}>
              {CUTOFF_OPTIONS.map(time => <option key={time}>{time}</option>)}
            </select>
            <small>W poniedziałki obowiązuje domyślnie 12:00.</small>
          </div>
          <div className="settings-field">
            <button type="button" className="button button-secondary" onClick={() => void save("WEEKDAY_DEFAULT")}
              disabled={!saved || Boolean(saving) || weekday === saved.weekday_default_cutoff_local}>
              {saving === "WEEKDAY_DEFAULT" ? "Zapisywanie…" : "Zapisz domyślną godzinę"}
            </button>
          </div>
        </div>
        <div className={saved?.mode === "CUSTOM" ? "cutoff-status active" : "cutoff-status"}>
          <b>{saved ? `Aktywny cutoff ${saved.effective_cutoff_local}` : notice ? "Ustawienia niedostępne" : "Pobieranie ustawień…"}</b>
          {saved && <span>{saved.mode === "CUSTOM" ? "Wyjątek dla wybranej daty" : "Godzina domyślna"}</span>}
        </div>
        <div className="settings-fields-pair cutoff-fields">
          <div className="settings-field">
            <label htmlFor="cutoff-mode">Tryb dla daty {date}</label>
            <select id="cutoff-mode" value={mode} disabled={!isToday || !saved || Boolean(saving)}
              onChange={event => {
                setMode(event.target.value as CutoffMode);
                if (isElapsed(custom) && defaultCustom) setCustom(defaultCustom);
                setNotice(null);
              }}>
              <option value="STANDARD">Domyślnie{saved ? ` · ${saved.default_cutoff_local}` : ""}</option>
              <option value="CUSTOM" disabled={!defaultCustom}>Wyjątek</option>
            </select>
          </div>
          <div className="settings-field">
            <label htmlFor="cutoff-time">Godzina wyjątku</label>
            <select id="cutoff-time" value={custom} disabled={!isToday || !saved || mode !== "CUSTOM" || Boolean(saving)}
              onChange={event => { setCustom(event.target.value as CutoffTime); setNotice(null); }}>
              {CUTOFF_OPTIONS.map(time => <option key={time} disabled={isElapsed(time)}>{time}</option>)}
            </select>
          </div>
        </div>
        {!isToday && <p className="settings-paragraph">Wyjątek można zapisać dla bieżącego dnia.</p>}
        {notice && <div className={notice.error ? "settings-alert error" : "settings-alert"} role="status">{notice.text}</div>}
      </div>
      <div className="settings-editor-footer">
        <p>Po zapisie wyjątku aplikacja przeliczy zapotrzebowanie i przyszłą część grafiku.</p>
        <button type="button" className="button button-primary" onClick={() => void save("DATE")}
          disabled={!isToday || !saved || Boolean(saving) || (mode === "CUSTOM" && isElapsed(custom))}>
          {saving === "DATE" ? "Zapisywanie…" : "Zastosuj i przelicz plan"}
        </button>
      </div>
    </section>
  );
}
