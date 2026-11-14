"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizePlanningAutomationSettings, validatePlanningAutomationSettings } from "@/lib/planning-settings";
import type { AuxiliaryPolicy, EmployeeProfile, PlannerNorms, PlannerRole, PreferredProcess, PlanningAutomationSettings, PlanningAutomationSlotId } from "@/types/plan";

type SettingsTab = "employees" | "norms" | "planning" | "access";
type Props = {
  profiles: EmployeeProfile[];
  norms: PlannerNorms;
  planning: PlanningAutomationSettings;
  version: number;
  loading: boolean;
  error: string;
  onReload: () => void;
};

const groups = ["Lider / Specjalista", "Przyjęcia", "Wydanie"] as const;
const plannerRoles: { value: PlannerRole; label: string; hint: string }[] = [
  { value: "standard", label: "Wydanie podstawowe", hint: "Pierwsza pula zasobów do PICK / PAK." },
  { value: "receiving_support", label: "Wsparcie Przyjęć", hint: "Po Wydaniu; planner stara się zostawić min. 1 osobę na Przyjęciu." },
  { value: "specialist_reserve", label: "Rezerwa specjalistyczna", hint: "Dodatkowy zasób po Wydaniu i Przyjęciach." },
  { value: "leader_reserve", label: "Lider / rezerwa", hint: "Jeden z ostatnich zasobów operacyjnych." },
  { value: "last_resort", label: "Ostatnia rezerwa", hint: "Uruchamiana dopiero po pozostałych dostępnych zasobach." },
];
const preferredProcesses: { value: PreferredProcess; label: string }[] = [
  { value: "balanced", label: "Bez preferencji" },
  { value: "pick", label: "Preferuj PICK" },
  { value: "pack", label: "Preferuj PAK" },
];
const auxiliaryPolicies: { value: AuxiliaryPolicy; label: string }[] = [
  { value: "none", label: "Brak reguły pomocniczej" },
  { value: "clean_then_returns", label: "Porządki → zwroty" },
];
const roleOrder: PlannerRole[] = ["standard", "receiving_support", "specialist_reserve", "leader_reserve", "last_resort"];
const normFields: { key: keyof PlannerNorms; title: string; hint: string; unit: string }[] = [
  { key: "pick_per_hour", title: "Norma PICK", hint: "Średnia liczba skompletowanych pozycji na godzinę pracy", unit: "PICK/RBH" },
  { key: "pack_per_hour", title: "Norma PAK", hint: "Średnia liczba spakowanych zamówień na godzinę pracy", unit: "PAK/RBH" },
  { key: "pick_seconds", title: "Obciążenie kompletacji", hint: "Czas kalkulacyjny na zamówienie", unit: "s/zam." },
  { key: "pack_seconds", title: "Obciążenie pakowania", hint: "Czas kalkulacyjny na zamówienie", unit: "s/zam." },
];

function cloneProfile(p: EmployeeProfile): EmployeeProfile {
  return {
    ...p,
    es_login: p.es_login ?? "",
    max_hours: p.max_hours ?? 0,
    planner_role: p.planner_role ?? "standard",
    allocation_rank: p.allocation_rank ?? 10,
    preferred_process: p.preferred_process ?? "balanced",
    supervisor_guard: p.supervisor_guard ?? false,
    auxiliary_policy: p.auxiliary_policy ?? "none",
  };
}

function roleLabel(role: PlannerRole) {
  return plannerRoles.find(item => item.value === role)?.label ?? role;
}

function updateSlot(
  settings: PlanningAutomationSettings,
  id: PlanningAutomationSlotId,
  patch: Partial<PlanningAutomationSettings["slots"][number]>,
) {
  return {
    ...settings,
    slots: settings.slots.map(slot => slot.id === id ? { ...slot, ...patch, id: slot.id } : slot),
  };
}

export function SettingsPanel({ profiles, norms, planning, version, loading, error, onReload }: Props) {
  const [tab, setTab] = useState<SettingsTab>("employees");
  const [selectedKey, setSelectedKey] = useState("");
  const [draft, setDraft] = useState<EmployeeProfile | null>(null);
  const [normDraft, setNormDraft] = useState<PlannerNorms>(norms);
  const [planningDraft, setPlanningDraft] = useState<PlanningAutomationSettings>(() => normalizePlanningAutomationSettings(planning));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [pinDraft, setPinDraft] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const ordered = useMemo(() => [...profiles].sort((a,b) =>
    groups.indexOf(a.group_name as typeof groups[number]) - groups.indexOf(b.group_name as typeof groups[number])
    || a.display_name.localeCompare(b.display_name, "pl")
  ), [profiles]);

  const planningOrder = useMemo(() => [...profiles]
    .filter(person => person.active)
    .sort((a,b) =>
      roleOrder.indexOf(a.planner_role) - roleOrder.indexOf(b.planner_role)
      || a.allocation_rank - b.allocation_rank
      || a.display_name.localeCompare(b.display_name, "pl")
    ), [profiles]);

  // These effects intentionally reset editable form drafts when fresh backend configuration arrives.
  /* eslint-disable react-hooks/set-state-in-effect */
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
  useEffect(() => { setPlanningDraft(normalizePlanningAutomationSettings(planning)); }, [planning]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function updatePlanningSlot(id: PlanningAutomationSlotId, patch: Partial<PlanningAutomationSettings["slots"][number]>) {
    setPlanningDraft(current => updateSlot(current, id, patch));
    setNotice("");
  }

  function selectPerson(key: string) {
    const person = profiles.find(p => p.employee_key === key);
    if (!person) return;
    setSelectedKey(key);
    setDraft(cloneProfile(person));
    setNotice("");
  }

  async function savePin() {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (!/^\d{4,8}$/.test(pinDraft)) throw new Error("PIN musi mieć od 4 do 8 cyfr.");
      if (pinDraft !== pinConfirm) throw new Error("Wpisane PIN-y nie są takie same.");
      const response = await fetch("/api/settings-access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: pinDraft, confirm_pin: pinConfirm, expected_version: version }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || "Nie udało się zmienić PIN-u.");
      setPinDraft("");
      setPinConfirm("");
      setNotice("PIN ustawień został zmieniony.");
      onReload();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Błąd zmiany PIN-u.");
    } finally {
      setSaving(false);
    }
  }

  async function save(action: "saveEmployee" | "saveNorms" | "savePlanning") {
    if (saving) return;
    setSaving(true);
    setNotice("");
    try {
      if (action === "savePlanning") {
        const validationError = validatePlanningAutomationSettings(planningDraft);
        if (validationError) throw new Error(validationError);
      }
      const body = action === "saveEmployee"
        ? { action, profile: draft }
        : action === "saveNorms"
          ? { action, norms: normDraft, expected_version: version }
          : { action, planning: planningDraft, expected_version: version };
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
        <button type="button" className={tab==="access" ? "settings-nav-item active" : "settings-nav-item"} onClick={()=>{setTab("access");setNotice("");}}>Dostęp</button>
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
                      <small>{person.active ? ((person.can_pick ? "PICK" : "") + (person.can_pick && person.can_pack ? " · " : "") + (person.can_pack ? "PAK" : "") || "Bez operacji") + " · " + roleLabel(person.planner_role) : "Nieaktywny"}</small>
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
                  <div className="settings-field">
                    <label htmlFor="settings-role">Rola w planerze</label>
                    <select id="settings-role" value={draft.planner_role} onChange={e=>setDraft({...draft,planner_role:e.target.value as PlannerRole})}>
                      {plannerRoles.map(role=><option key={role.value} value={role.value}>{role.label}</option>)}
                    </select>
                    <small>{plannerRoles.find(role=>role.value===draft.planner_role)?.hint}</small>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-rank">Kolejność w roli</label>
                    <input id="settings-rank" type="number" min="1" max="99" step="1" value={draft.allocation_rank} onChange={e=>setDraft({...draft,allocation_rank:Number(e.target.value)})}/>
                  </div>
                </div>
                <div className="settings-fields-pair">
                  <div className="settings-field">
                    <label htmlFor="settings-preferred">Preferowany proces</label>
                    <select id="settings-preferred" value={draft.preferred_process} onChange={e=>setDraft({...draft,preferred_process:e.target.value as PreferredProcess})}>
                      {preferredProcesses.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                  <div className="settings-field">
                    <label htmlFor="settings-aux">Zadania pomocnicze</label>
                    <select id="settings-aux" value={draft.auxiliary_policy} onChange={e=>setDraft({...draft,auxiliary_policy:e.target.value as AuxiliaryPolicy})}>
                      {auxiliaryPolicies.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </div>
                </div>
                <label className="settings-check">
                  <input type="checkbox" checked={draft.supervisor_guard} onChange={e=>setDraft({...draft,supervisor_guard:e.target.checked})}/>
                  Chronić nadzór — ostatni dostępny lider nie może trafić do PICK/PAK
                </label>
                <div className="settings-fields-pair">
                  <div className="settings-field"><label htmlFor="settings-es">Login EasyStorage <small>(opcjonalny)</small></label>
                    <input id="settings-es" autoComplete="off" value={draft.es_login} maxLength={100} placeholder="Login operatora ES" onChange={e=>setDraft({...draft,es_login:e.target.value})}/></div>
                  <div className="settings-field"><label htmlFor="settings-limit">Maks. godzin operacyjnych/dzień <small>(0 = bez limitu)</small></label>
                    <input id="settings-limit" type="number" min="0" max="24" step="0.25" value={draft.max_hours} onChange={e=>setDraft({...draft,max_hours:Number(e.target.value)})}/></div>
                </div>
                <label className="settings-check settings-active"><input type="checkbox" checked={draft.active} onChange={e=>setDraft({...draft,active:e.target.checked})}/> Pracownik aktywny</label>
                <div className="settings-editor-footer">
                  <p>Nowe osoby: <b>Wydanie podstawowe + PICK + PAK</b>. Import grafiku nie nadpisuje ręcznej konfiguracji profilu.</p>
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
          <div className="settings-card-heading"><div><p className="eyebrow">LOGIKA GENERATORA</p><h2>Reguły planowania</h2></div><span>Konfiguracja v{version || "—"}</span></div>

          <div className="planning-automation">
            <div className="planning-automation-header">
              <div>
                <h3>Automatyczne przeliczenia planu</h3>
                <p>Godziny są stałe. W tym miejscu można wyłącznie włączyć albo wyłączyć konkretne przeliczenie.</p>
              </div>
            </div>

            <div className="planning-slots">
              {([
                ["initial", "06:05", "Start dnia", "Pierwszy plan po przygotowaniu prognozy, grafiku i porannego snapshotu zamówień"],
                ["replan_1", "08:05", "Korekta 1", "Świeży ES + korekta rzeczywistego napływu zamówień"],
                ["replan_2", "12:05", "Korekta 2", "Świeży ES + korekta rzeczywistego napływu zamówień"],
                ["replan_3", "16:05", "Korekta 3", "Świeży ES + korekta rzeczywistego napływu zamówień"],
              ] as const).map(([id, time, label, hint]) => {
                const slot = planningDraft.slots.find(item => item.id === id)!;
                return (
                  <div className="planning-slot" key={id}>
                    <label className="settings-check">
                      <input type="checkbox" checked={slot.enabled} onChange={e=>updatePlanningSlot(id,{enabled:e.target.checked})}/>
                      <span><b>{label} · {time}</b><small>{hint}</small></span>
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="settings-editor-footer">
              <p>Stały harmonogram: 06:05 · 08:05 · 12:05 · 16:05. Ponowienia przy braku danych są obsługiwane automatycznie przez n8n.</p>
              <button type="button" className="button button-primary" onClick={()=>save("savePlanning")} disabled={saving || loading}>{saving ? "Zapisywanie…" : "Zapisz włączenia przeliczeń"}</button>
            </div>
          </div>
          <p className="settings-paragraph"><b>Kolejność zasobów:</b> Wydanie podstawowe → Alina → Przyjęcia → Magda → pozostali rezerwowi → Ania.</p>
          <p className="settings-paragraph"><b>Przyjęcia:</b> planner angażuje je dopiero po wykorzystaniu produktywnej pojemności Wydania i Aliny.</p>
          <p className="settings-paragraph"><b>Nadzór:</b> przy włączonej ochronie generator nie przydzieli ostatniego dostępnego lidera do PICK/PAK.</p>
          <p className="settings-paragraph"><b>Dyżur:</b> blok dyżuru z grafiku ma pierwszeństwo przed PICK/PAK. Preferowany proces i zadania pomocnicze ustawiasz w profilu pracownika.</p>
          <div className="settings-list-group">
            <p>Aktualna kolejność <span>{planningOrder.length}</span></p>
            {planningOrder.map(person => (
              <div className="settings-person" key={person.employee_key}>
                <span>{person.display_name}</span>
                <small>{roleLabel(person.planner_role)} · kolejność {person.allocation_rank} · {person.preferred_process === "pick" ? "PICK" : person.preferred_process === "pack" ? "PAK" : "bez preferencji"}{person.supervisor_guard ? " · NADZÓR" : ""}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "access" && (
        <section className="card settings-access-card">
          <div className="settings-card-heading">
            <div>
              <p className="eyebrow">KONTROLA DOSTĘPU</p>
              <h2>PIN do Ustawień</h2>
            </div>
            <span>4–8 cyfr</span>
          </div>
          <p className="settings-paragraph">
            PIN jest wymagany przy każdym wejściu do zakładki Ustawienia. Po wyjściu z tej zakładki dostęp zostaje ponownie zablokowany.
          </p>
          <div className="settings-fields-pair settings-pin-change">
            <div className="settings-field">
              <label htmlFor="settings-new-pin">Nowy PIN</label>
              <input
                id="settings-new-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                minLength={4}
                maxLength={8}
                value={pinDraft}
                onChange={e=>setPinDraft(e.target.value.replace(/\D/g,"").slice(0,8))}
                placeholder="4–8 cyfr"
              />
            </div>
            <div className="settings-field">
              <label htmlFor="settings-confirm-pin">Powtórz PIN</label>
              <input
                id="settings-confirm-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                pattern="[0-9]*"
                minLength={4}
                maxLength={8}
                value={pinConfirm}
                onChange={e=>setPinConfirm(e.target.value.replace(/\D/g,"").slice(0,8))}
                placeholder="Powtórz PIN"
              />
            </div>
          </div>
          <div className="settings-editor-footer">
            <p>Po zmianie nowy PIN będzie wymagany przy następnym wejściu do Ustawień.</p>
            <button
              type="button"
              className="button button-primary"
              onClick={()=>{void savePin();}}
              disabled={saving || loading || !/^\d{4,8}$/.test(pinDraft) || pinDraft !== pinConfirm}
            >
              {saving ? "Zapisywanie…" : "Zmień PIN"}
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
