"use client";

import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/plan-utils";

type Snapshot = {
  total: number;
  channels: Record<string, number>;
  collected_at: string;
  capture_mode: string;
  source_run: string;
};

type MorningData = {
  ok: boolean;
  error?: string;
  date?: string;
  complete?: boolean;
  missing_sources?: string[];
  morning?: { pl: number; under: number; total: number } | null;
  sources?: { BL?: Snapshot; SR?: Snapshot };
};

type Props = { date: string; reload: number };

function localTimestamp(value?: string) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" }).format(parsed);
}

const number = (value?: number) => typeof value === "number" ? formatNumber(value) : "—";

export function MorningOrdersView({ date, reload }: Props) {
  const [data, setData] = useState<MorningData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      setData(null);
      try {
        const response = await fetch("/api/morning-orders?date=" + encodeURIComponent(date), {
          cache: "no-store", signal: controller.signal,
        });
        const result = await response.json() as MorningData;
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Nie można pobrać zamówień z godziny 06:00.");
        }
        setData(result);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Nie można pobrać danych.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [date, reload]);

  const ready = !loading && data?.complete && data.morning;
  const bl = data?.sources?.BL;
  const sr = data?.sources?.SR;
  const pl = ready ? data.morning!.pl : 0;
  const under = ready ? data.morning!.under : 0;
  const total = ready ? data.morning!.total : 0;
  const ratio = total > 0 ? (pl / total) * 100 : 0;
  const shop = bl ? Object.entries(bl.channels).filter(([k])=>k.trim().toLowerCase()==="shop").reduce((n,[,v])=>n+v,0) : 0;
  const ceneo = bl ? Object.entries(bl.channels).filter(([k])=>k.trim().toLowerCase()==="ceneo").reduce((n,[,v])=>n+v,0) : 0;
  const otherBL = bl ? bl.total - shop - ceneo : 0;

  return (
    <section id="orders-panel" className="tab-panel" role="tabpanel" aria-labelledby="tab-orders">
      <section className="page-intro">
        <div>
          <p className="eyebrow">MOL / DANE WEJŚCIOWE</p>
          <h1>Zamówienia na start dnia</h1>
          <p className="subtitle">Rzeczywista liczba zamówień oczekujących o 06:00 z BaseLinkera i SellRocket.</p>
        </div>
        <div className="intro-meta">
          <span className="mode-badge"><i />{ready ? "Odczyt rzeczywisty" : "Odczyt 06:00"}</span>
          <span>{date}</span>
        </div>
      </section>

      {loading && <div className="settings-alert" role="status">Pobieranie danych z godziny 06:00…</div>}
      {error && <div className="settings-alert error" role="alert">{error}</div>}
      {!loading && !error && data && !data.complete && (
        <div className="settings-alert" role="status">
          Brakuje danych porannych dla {date}: {(data.missing_sources || []).join(", ") || "BL lub SR"}.
          Nie wyświetlamy niepełnej sumy jako pełnego planu dnia.
        </div>
      )}

      <div className="morning-overview-grid">
        <section className="card morning-hero" aria-label="Łączna liczba zamówień">
          <p className="eyebrow">PULA STARTOWA · 06:00</p>
          <strong className="morning-hero-number">{ready ? number(total) : "—"}</strong>
          <span className="morning-hero-caption">zamówień oczekujących na realizację</span>
          <p className="morning-hero-source">Źródła: BL + SR · {ready ? "komplet danych" : "brak potwierdzonego kompletu"}</p>
        </section>
        <section className="card morning-composition" aria-label="Podział zamówień">
          <p className="eyebrow">PODZIAŁ KANAŁÓW</p>
          <div className="morning-composition-values">
            <div><span>.PL</span><strong>{ready ? number(pl) : "—"}</strong><small>BL: shop + ceneo</small></div>
            <div><span>_PL</span><strong>{ready ? number(under) : "—"}</strong><small>pozostałe BL + cały SR</small></div>
          </div>
          <div className="morning-composition-bar" role="img" aria-label={ready ? `Udział .PL: ${ratio.toFixed(1)}%, _PL: ${(100-ratio).toFixed(1)}%` : "Brak danych do wykresu"}>
            <span style={{ width: ready ? `${ratio}%` : "0%" }} />
          </div>
          <div className="morning-composition-legend"><span><i className="morning-swatch pl" />.PL</span><span><i className="morning-swatch under" />_PL</span></div>
        </section>
      </div>

      <section className="card morning-sources" aria-label="Źródła zamówień porannych">
        <div className="section-heading">
          <div><p className="eyebrow">KONTROLA ŹRÓDEŁ</p><h2>Skąd pochodzą zamówienia?</h2></div>
        </div>
        <div className="morning-source-row">
          <div><strong>BaseLinker</strong><small>shop + ceneo → .PL · pozostałe kanały → _PL</small></div>
          <span className="morning-source-numbers">{ready ? number(bl?.total) : "—"}</span>
          <div className="morning-source-meta">{ready && bl ? `shop ${number(shop)} · ceneo ${number(ceneo)} · inne ${number(otherBL)}` : "Brak potwierdzonego odczytu"}</div>
          <small className="morning-timestamp">{ready ? localTimestamp(bl?.collected_at) : "—"}</small>
        </div>
        <div className="morning-source-row">
          <div><strong>SellRocket</strong><small>wszystkie kanały → _PL</small></div>
          <span className="morning-source-numbers">{ready ? number(sr?.total) : "—"}</span>
          <div className="morning-source-meta">W całości klasyfikowany jako _PL</div>
          <small className="morning-timestamp">{ready ? localTimestamp(sr?.collected_at) : "—"}</small>
        </div>
        <div className="morning-sources-foot">
          Dane pobierane z porannych snapshotów n8n. Zmiana daty u góry przełącza dzień odczytu.
        </div>
      </section>

      <div className="morning-next-stage">
        <span className="eyebrow">KOLEJNE ETAPY</span>
        <span>Napływ zamówień w ciągu dnia, prognoza i wykonanie ES zostaną dołączone osobno. Nie są jeszcze wliczane do puli startowej.</span>
      </div>
    </section>
  );
}
