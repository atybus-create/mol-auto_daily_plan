import { formatNumber } from "@/lib/plan-utils";

export type MorningOrdersSource = {
  source: "BL" | "SR";
  total: number | null;
  channels: Record<string, number>;
  recorded_at: string | null;
  capture_mode: string | null;
};

export type MorningOrdersData = {
  ok: boolean;
  date: string;
  complete: boolean;
  total: number | null;
  sources: MorningOrdersSource[];
};

type Props = {
  date: string;
  loading: boolean;
  error: string;
  data: MorningOrdersData | null;
};

function formatClock(iso: string | null) {
  if (!iso) return "Brak";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Brak";
  return new Intl.DateTimeFormat("pl-PL", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Warsaw",
  }).format(date);
}

function readableChannel(name: string) {
  return ({
    all: "Pozostałe / all",
    shop: "Sklep (shop)",
    pigu: "Pigu",
    hebe: "Hebe",
    empik: "Empik",
    allegro: "Allegro",
    erli_connector: "ERLI",
    ceneo: "Ceneo",
    kaufland: "Kaufland",
    kauflandit: "Kaufland IT",
    kauflandfr: "Kaufland FR",
    cdiscountfr: "Cdiscount FR",
  } as Record<string,string>)[name] ?? name;
}

export function MorningOrders({ date, loading, error, data }: Props) {
  const sources: MorningOrdersSource[] = ["BL", "SR"].map(source =>
    data?.sources.find(row => row.source === source) ??
      { source: source as "BL" | "SR", total: null, channels: {}, recorded_at: null, capture_mode: null },
  );
  const complete = Boolean(data?.complete && data.date === date && sources.every(s => s.total !== null));
  const total = complete ? data!.total : null;
  return (
    <section className="tab-panel" role="tabpanel" aria-labelledby="tab-orders" id="orders-panel">
      <section className="page-intro orders-intro">
        <div>
          <p className="eyebrow">DANE OPERACYJNE · ETAP 1</p>
          <h1>Zamówienia na 06:00</h1>
          <p className="subtitle">
            Rzeczywisty stan oczekujących zamówień z BaseLinker i SellRocket.
            Bez prognozy napływu i bez danych demonstracyjnych.
          </p>
        </div>
        <div className="intro-meta">
          <span className="mode-badge"><i /> {complete ? "Dwa źródła pobrane" : "Oczekiwanie na komplet danych"}</span>
          <span>Data: {date}</span>
        </div>
      </section>

      {error && <div className="settings-alert error" role="alert">{error}</div>}
      {!error && loading && <div className="settings-alert">Odczytuję poranne dane z n8n…</div>}
      {!loading && !error && !complete &&
        <div className="settings-alert" role="status">
          Brakuje odczytu z co najmniej jednego źródła dla {date}. Suma nie jest podawana,
          żeby brak danych nie został potraktowany jak zero zamówień.
        </div>}

      <div className="morning-summary-grid">
        <section className="card morning-hero" aria-label="Suma zamówień na start dnia">
          <p className="eyebrow">ŁĄCZNIE · 06:00</p>
          <strong className="morning-hero-total">{total === null ? "—" : formatNumber(total)}</strong>
          <span className="morning-hero-unit">{complete ? "zamówień oczekujących" : "brak pełnej sumy"}</span>
          <div className="morning-hero-foot">
            {complete ? "Suma BL + SR" : "Wymagane oba odczyty: BL i SR"}
          </div>
        </section>
        {sources.map(row => (
          <section className="card morning-source-summary" key={row.source} aria-label={row.source === "BL" ? "BaseLinker" : "SellRocket"}>
            <p className="eyebrow">{row.source === "BL" ? "BASELINKER" : "SELLROCKET"}</p>
            <strong className="morning-source-number">{row.total === null ? "—" : formatNumber(row.total)}</strong>
            <span>zamówień o 06:00</span>
            <div className="morning-source-time">
              {row.total === null ? "Brak snapshotu" : `Odczyt: ${formatClock(row.recorded_at)}`}
              {row.capture_mode === "history_verified_backfill" && <small> · odtworzone z wykonania o 06:00</small>}
            </div>
          </section>
        ))}
      </div>

      <div className="morning-breakdown-grid">
        {sources.map(row => (
          <section className="card morning-breakdown-card" key={row.source}>
            <div className="section-heading">
              <div><p className="eyebrow">STRUKTURA ŹRÓDŁA</p><h2>{row.source === "BL" ? "BaseLinker · kanały" : "SellRocket · kanały"}</h2></div>
              <span className="morning-detail-meta">{row.total === null ? "Brak danych" : `${Object.keys(row.channels).length} kanałów`}</span>
            </div>
            {row.total !== null ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th scope="col">Kanał w źródle</th><th scope="col">Zamówienia</th></tr></thead>
                  <tbody>
                    {Object.entries(row.channels).sort((a,b)=>b[1]-a[1]).map(([name,value])=>(
                      <tr key={name}><td>{readableChannel(name)} <small>({name})</small></td><td>{formatNumber(value)}</td></tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td>Suma {row.source}</td><td>{formatNumber(row.total)}</td></tr></tfoot>
                </table>
              </div>
            ) : (
              <div className="morning-missing">Dane będą dostępne po porannym pobraniu.</div>
            )}
          </section>
        ))}
      </div>
      <section className="card morning-next-stage">
        <strong>Kolejny etap: prognoza napływu i wykonanie w ciągu dnia</strong>
        <p>Ten widok pokazuje wyłącznie zamówienia zastane o 06:00. Rozkład godzinowy i wyliczenie planu PICK/PAK podłączymy osobno.</p>
      </section>
    </section>
  );
}
