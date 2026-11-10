# MOL // Plan Dnia

Frontend aplikacji do planowania pracy magazynu ESTYL. Projekt działa jako aplikacja Next.js z TypeScript i jest automatycznie wdrażany na Vercelu z repozytorium GitHub.

## Aktualny zakres

- **Plan pracy** — pracownicy w wierszach, czas od 05:00 do 18:00 w kolumnach, siatka 15-minutowa, bloki czynności, cele dzienne oraz wykonanie narastające.
- **Zamówienia** — rzeczywista pula `.PL` i `_PL` o 06:00, 20 półgodzinnych bloków prognozy 06:00–16:00, plan brutto oraz kwalifikacja według cutoffów kurierów.
- **Plan pracy** — ten sam atomowy snapshot popytu jest widoczny nad grafikiem, dzięki czemu poranna pula i prognozowany napływ nie są liczone oddzielnie.
- **Dostępność** — semantyczne zakładki, etykiety kontrolek, opisane paski postępu, widoczne focusy i respektowanie `prefers-reduced-motion`.
- **Kontrola dostępu** — wspólne hasło aplikacji, podpisana sesja HTTP-only oraz ochrona ekranów i przyszłych endpointów API.

Dane grafiku, konfiguracji, zamówień porannych i prognozy są pobierane przez podpisane endpointy Vercela z n8n. Brak prognozy lub źródła nie jest prezentowany jako zero.

## Struktura

```text
app/                    routing, metadane i globalne style
components/             interfejs i interakcje widoków
lib/demo-data.ts        dane demonstracyjne
lib/plan-utils.ts       obliczenia i formatowanie
lib/demand-utils.ts     walidacja 20 slotów i spójności planu zamówień
types/plan.ts           kontrakty TypeScript
public/                 zasoby statyczne
```

## Uruchomienie lokalne

```bash
npm install
npm run dev
```

Kontrola jakości:

```bash
npm run typecheck
npm run lint
npm run build
```

Przed uruchomieniem ustaw `MOL_APP_PASSWORD_HASH` (SHA-256 hasła) oraz losowy `MOL_SESSION_SECRET` o długości co najmniej 32 znaków. W Vercelu dodaj je jako zmienne środowiskowe dla Production, Preview i Development. Wartości nie mogą trafić do repozytorium.

## Publikacja

Vercel jest połączony z repozytorium. Zmiana na gałęzi `main` uruchamia wdrożenie produkcyjne, a pozostałe gałęzie mogą służyć jako podglądy zmian.

Nie umieszczaj tokenów n8n ani danych produkcyjnych w kodzie frontendu. Integracja zostanie podłączona przez zabezpieczoną warstwę API.

## Kontrakt prognozy

`GET /api/day-demand?date=YYYY-MM-DD` zwraca jeden wersjonowany snapshot: `morning`, `forecast`, `plan_gross`, `required_today`, `after_cutoff` i dokładnie 20 rekordów `slots`. Prognoza Etapu 2 pozostaje bazowa i niezmienna w ciągu dnia; korekta rzeczywistym spływem należy do Etapu 3.
