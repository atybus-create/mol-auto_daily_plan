# MOL // Plan Dnia

Frontend aplikacji do planowania pracy magazynu ESTYL. Projekt działa jako aplikacja Next.js z TypeScript i jest automatycznie wdrażany na Vercelu z repozytorium GitHub.

## Aktualny zakres

- **Plan pracy** — pracownicy w wierszach, czas od 05:00 do 18:00 w kolumnach, siatka 15-minutowa, bloki czynności, cele dzienne oraz wykonanie narastające.
- **Zamówienia** — poranna pula `.PL` i `_PL`, półgodzinowy plan napływu, dane rzeczywiste do godziny 10:00 i odchylenie od planu.
- **Interakcje demonstracyjne** — zmiana daty, zwijanie zespołu, tryb edycji bloków, lokalne przeliczenie oraz nawigacja zakładek z klawiatury.
- **Dostępność** — semantyczne zakładki, etykiety kontrolek, opisane paski postępu, widoczne focusy i respektowanie `prefers-reduced-motion`.

Wszystkie dane są nadal przykładowe. Aplikacja nie łączy się jeszcze z n8n, EasyStorage, BaseLinker, SellRocket ani FTP i nie zapisuje zmian.

## Struktura

```text
app/                    routing, metadane i globalne style
components/             interfejs i interakcje widoków
lib/demo-data.ts        dane demonstracyjne
lib/plan-utils.ts       obliczenia i formatowanie
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

## Publikacja

Vercel jest połączony z repozytorium. Zmiana na gałęzi `main` uruchamia wdrożenie produkcyjne, a pozostałe gałęzie mogą służyć jako podglądy zmian.

Nie umieszczaj tokenów n8n ani danych produkcyjnych w kodzie frontendu. Integracja zostanie podłączona przez zabezpieczoną warstwę API.

## Kolejny etap

Zdefiniowanie kontraktów danych aplikacja ↔ API ↔ n8n, w tym wspólnej odpowiedzi zawierającej `business_date`, `generated_at`, `source_as_of`, `status`, jednostki, rekordy i błędy.
