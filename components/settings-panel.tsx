"use client";

import { useEffect, useMemo, useState } from "react";
import type { EmployeeProfile, PlannerNorms } from "@/types/plan";

type SettingsTab = "employees" | "norms" | "planning";
type Props = {
  profiles: EmployeeProfile[];
  norms: PlannerNorms;
  version: number;
  loading: boolean;
  error: string;
  onReload: () => void;
};

const groups = ["Lider / Specjalista", "Przyjęcia", "Wydanie"] as const;
const normFields: { key: keyof PlannerNorms; title: string; hint: string; unit: string }[] = [
  { key: "pick_per_hour", title: "Norma PICK", hint: "Średnia liczba skompletowanych pozycji na godzinę pracy", unit: "PICK/RBH" },
  { key: "pack_per_hour", title: "Norma PAK", hint: "Średnia liczba spakowanych zamówień na godzinę pracy", unit: "PAK/RBH" },
  { key: "pick_seconds", title: "Obciążenie kompletacji", hint: "Czas kalkulacyjny na zamówienie", unit: "s/zam." },
  { key: "pack_seconds", title: "Obciążenie pakowania", hint: "Czas kalkulacyjny na zamówienie", unit: "s/zam." },
];

function cloneProfile(p: EmployeeProfile) {
  return { ...p, es_login: p.es_login ?? "", max_hours: p.max_hours ?? 0 };
}

export function SettingsPanel({ profiles, norms, version, loading, error, onReload }: Props) {
  const [tab, setTab] = useState<SettingsTab>("employees");
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<EmployeeProfile | null>(null);
  const [normDraft, setNormDraft] = useState<PlannerNorms>(norms);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const ordered = useMemo(() => [...profiles].sort((a,b) =>
    groups.indexOf(a.group_name as typeof groups[number]) - groups.indexOf(b.group_name as typeof groups[number])
    || a.display_name.localeCompare(b.display_name, "pl")
  ), [profiles]);

  useEffect(() => {
    const current = profiles.find(p => p.employee_key === selectedKey) ?? profiles[0];
    if (current) {
      setSelectedKey(current.employee_key);
      setDraft(cloneProfile(current));
    } else {
      setDraft(null);
    }
  }, [profiles, selectedKey]);

  useEffect(() => { setNormDraft(norms); }, [norms]);

  function selectPerson(key: string) {
    const person = profiles.find(p => p.employee_key === key);
    if (!person) return;
    setSelectedKey(key);
    setDraft(cloneProfile(person));
    setNotice("");
  }

  async function save(action: "saveEmployee" | "saveNorms") {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      const body = action === "saveEmployee"
        ? { action, profile: draft }
        : { action, norms: normDraft, expected_version: version };
      const response = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Nie udało się zapisać zmian.");
      setNotice("Zapisano zmiany. Odświeżone dane będą użyte przy kolejnym przeliczeniu planu.");
      onReload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd zapisu.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="tab-panel settings-screen" role="tabpanel" id="settings-panel" aria-labelledby="tab-settings">
      <div className="page-intro">
        <div>
          <p className="eyebrow">KONFIGURACJA MOL</p>
          <h1>Ustawienia planowania</h1>
          <p className="subtitle">Trwałe reguły i kompetencje. Grafik Google określa wyłącznie obecność i dyżur.</p>
        </div>
        <button type="button" className="button button-secondary" onClick={onReload} disabled={loading || saving}>↻ Odśwież ustawienia</button>
      </div>

      <div className="settings-nav" role="tablist" aria-label="Sekcje ustawień">
        <button type="button" className={tab==="employees" ? "settings-nav-item active" : "settings-nav-item"} onClick={()=>{setTab("employees");setNotice("");}}>Pracownicy <b>{profiles.length}</b></button>
        <button type="button" className={tab==="norms" ? "settings-nav-item active" : "settings-nav-item"} onClick={()=>{setTab("norms");setNotice("");}}>Normy i czasy</button>
        <button type="button" className={tab==="planning" ? "settings-nav-item active" : "settings-nav-item"} onClick={()=>{setTab("planning");setNotice("");}}>Reguły planowania</button>
      </div>

      {error && <div className="settings-alert error" role="alert">{error}</div>}
      {notice && <div className="settings-alert" role="status">{notice}</div>}
      {loading && profiles.length === 0 && <div className="settings-alert">Pobieranie konfiguracji z backendu…</div>}

      {tab === "employees" && (
        <div className="settings-grid">
          <section className="card settings-list" aria-label="Rejestr pracowników">
            <div className="settings-card-heading">
              <h2>Rejestr pracowników</h2>
              <span>Wykrywani automatycznie z grafiku</span>
            </div>
            {groups.map(group => {
              const people = ordered.filter(p => p.group_name === group);
              if (!people.length) return null;
              return (
                <div key={group} className="settings-list-group">
                  <p>{group} <span>{people.length}</span></p>
                  {people.map(person => (
                    <button type="button" key={person.employee_key}
                      className={person.employee_key===selectedKey ? "settings-person selected" : "settings-person"}
                      onClick={()=>selectPerson(person.employee_key)}>
                      <span>{person.display_name}</span>
                      <small>{person.active ? (person.can_pick ? "PICK" : "") + (person.can_pick && person.can_pack ? " · " : "") + (person.can_pack ? "PAK" : "") || "Bez operacji" : "Nieaktywny"}</small>
                    </button>
                  ))}
                </div>
              );
            })}
          </section>

          <section className="card settings-editor" aria-label="Edycja pracownika">
            {draft ? (
              <>
                <div className="settings-card-heading">
                  <div><p className="eyebrow">PROFIL PRACOWNIKA</p><h2>{draft.display_name}</h2></div>
                  <span className="settings-id">ID: {draft.employee_key}</span>
                </div>
                <div className="settings-field">
                  <label htmlFor="settings-group">Grupa organizacyjna</label>
                  <select id="settings-group" value={draft.group_name} onChange={e=>setDraft({...draft,group_name:e.target.value})}>
                    {groups.map(g=><option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <fieldset className="settings-fieldset">
                  <legend>Kompetencje operacyjne</legend>
                  <label className="settings-check"><input type="checkbox" checked={draft.can_pick} onChange={e=>setDraft({...draft,can_pick:e.target.checked})}/> Może realizować PICK</label>
                  <label className="settings-check"><input type="checkbox" checked={draft.can_pack} onChange={e=>setDraft({...draft,can_pack:e.target.checked})}/> Może realizować PAK</label>
                </fieldset>
                <div className="settings-fields-pair">
                  <div className="settings-field"><label htmlFor="settings-es">Login EasyStorage <small>(opcjonalny)</small></label>
                    <input id="settings-es" autoComplete="off" value={draft.es_login} maxLength={100} placeholder="Login operatora ES" onChange={e=>setDraft({...draft,es_login:e.target.value})}/></div>
                  <div className="settings-field"><label htmlFor="settings-limit">Maks. godzin/dzień <small>(0 = bez limitu)</small></label>
                    <input id="settings-limit" type="number" min="0" max="24" step="0.25" value={draft.max_hours} onChange={e=>setDraft({...draft,max_hours:Number(e.target.value)})}/></div>
                </div>
                <label className="settings-check settings-active"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> Pracownik aktywny</label>
                <div className="settings-editor-footer">
                  <p>Nowe osoby: <b>Wydanie + PICK + PAK</b>. Ich ustawienia nie są nadpisywane kolejnym importem grafiku.</p>
                  <button type="button" className="button button-primary" disabled={saving || loading} onClick={()=>save("saveEmployee")}>{saving ? "Zapisywanie…" : "Zapisz profil"}</button>
                </div>
              </>
            ) : (
              <div className="settings-empty">Brak profili. Sprawdź połączenie z backendem i import grafiku.</div>
            )}
          </section>
        </div>
      )}

      {tab === "norms" && (
        <section className="card settings-norms">
          <div className="settings-card-heading"><div><p className="eyebrow">STANDARD OPERACYJNY</p><h2>Normy i obciążenia</h2></div><span>Wersja {version || "—"}</span></div>
          <div className="settings-norm-grid">
            {normFields.map(field => (
              <label className="settings-norm" key={field.key}>
                <span className="settings-norm-title">{field.title}</span>
                <small>{field.hint}</small>
                <span className="settings-number"><input type="number" min="1" step="1" value={normDraft[field.key]} onChange={e=>setNormDraft({...normDraft,[field.key]:Number(e.target.value)})}/><b>{field.unit}</b></span>
              </label>
            ))}
          </div>
          <div className="settings-editor-footer">
            <p>Zmiana norm otrzymuje kolejną wersję i zapis w historii. Istniejący plan nie jest przeliczany automatycznie.</p>
            <button type="button" className="button button-primary" onClick={()=>save("saveNorms")} disabled={saving || loading}>{saving ? "Zapisywanie…" : "Zapisz normy"}</button>
          </div>
        </section>
      )}

      {tab === "planning" && (
        <section className="card settings-norms">
          <div className="settings-card-heading"><div><p className="eyebrow">ETAP ALGORYTMU</p><h2>Reguły planowania</h2></div></div>
          <p className="settings-paragraph">Priorytet cutoffów, bufor PAK, kolejność delegowania pracowników z przyjęć, ograniczenia Aliny i Ani oraz reguły ponownego przeliczania zostaną udostępnione do edycji wraz z silnikiem planowania.</p>
          <p className="settings-paragraph">Na obecnym etapie aplikacja pobiera i klasyfikuje realny grafik; nie generuje jeszcze przydziałów PICK/PAK.</p>
        </section>
      )}
    </section>
  );
}
