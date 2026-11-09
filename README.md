# MOL // Plan Dnia

Frontend demonstracyjny aplikacji do planowania pracy magazynu ESTYL. Projekt jest statycznym HTML/CSS/JavaScript bez frameworka i bez zależności buildowych. Obecnie wszystkie dane są przykładowe; aplikacja nie łączy się z n8n, EasyStorage, BaseLinker, SellRocket ani FTP.

## Widoki

- **Plan pracy** — pracownicy w wierszach, czas od 05:00 do 18:00 w kolumnach, siatka 15-minutowa z etykietami co 30 minut, bloki czynności, planowana norma dzienna i bieżące wykonanie.
- **Zamówienia** — pula oczekująca na 06:00 rozdzielona na `.PL` i `_PL`, półgodzinowy plan napływu, odczyt rzeczywisty do przykładowej godziny 10:00 i różnica od planu.
- **Tempo zespołu** — porównanie PICK i PAK z planem narastającym do bieżącej godziny; UI pokazuje docelowy cykl odświeżania co 30 minut, ale nie wykonuje jeszcze odczytów.

Interakcje w tej wersji (przełączanie zakładek, zmiana daty, lokalna zmiana czynności i przeliczenie) działają wyłącznie na demonstracyjnej makiecie. Nie zapisują zmian i nie wywołują workflowów.

## Uruchomienie lokalne

Otwórz `index.html` w przeglądarce. Nie jest wymagany Node.js ani instalowanie pakietów.

## Publikacja podglądu na GitHub Pages

Workflow `.github/workflows/pages.yml` jest gotowy do ręcznego uruchomienia po włączeniu GitHub Pages w ustawieniach repozytorium: **Settings → Pages → Build and deployment → GitHub Actions**. Następnie wybierz **Actions → Publish static preview → Run workflow**. Publiczny podgląd zawiera tylko dane demonstracyjne. Workflow nie publikuje aplikacji automatycznie przy każdym commicie.

Przed użyciem rzeczywistych danych pracowników lub zamówień aplikacja musi działać w uzgodnionej, kontrolowanej firmowo przestrzeni i mieć zabezpieczony dostęp. Nie umieszczaj tokenów n8n ani danych produkcyjnych w plikach frontendu.

## Kolejne etapy

1. **Kontrakt API i adapter danych.** Uzgodnić wspólny JSON dla odczytów: `business_date`, `generated_at`, `source_as_of`, `status` (`ok/partial/error`), jednostki, rekordy i błędy. Podmiana źródła demo na API nie powinna wymagać przebudowy widoków.
2. **Gotowość danych i grafik.** Odczyt readiness 06:00 oraz grafiku z jawną zakładką, minutami zmian i oznaczeniem dyżuru. Potwierdzić mapowanie nazw na trwałe ID.
3. **Pula i napływ zamówień.** Najpierw zweryfikować poranną pulę `.PL`/`_PL`, następnie dodać półgodzinny plan i rzeczywisty napływ z deduplikacją oraz mapą metod dostawy do cutoffów.
4. **Kolejki PICK/PAK.** Potwierdzić źródło, statusy, wykluczenia i jednostki kolejki oczekującej na kompletację oraz skompletowanej do pakowania.
5. **Wykonanie pracowników.** Uzgodnić raporty FTP WMS i ES, mapowanie loginów, jednostki picków/zamówień, korekty i opóźnienia. Dodać wiarygodne odświeżanie co 30 minut.
6. **Planowanie i korekty lidera.** Wprowadzić normy, cutoffy, bufor pakowania, kompetencje, priorytety pracowników i ponowne przeliczenie z uwzględnieniem ręcznych zmian.
7. **Prognoza, alerty i snapshoty.** Zweryfikować historię sześciu miesięcy według cutoffów; dodać alerty niedoboru, wersje planu, snapshot 23:00 i późniejsze korekty rozliczeń.
8. **Dostęp i wdrożenie firmowe.** Uzgodnić środowisko, domenę, uwierzytelnianie, kopie zapasowe, retencję, monitoring i sposób wycofania wdrożenia.

### Blokady danych do rozwiązania przed etapami integracji

- dokładny odczyt kolejek ES dla PICK i PAK;
- próbka FTP WMS i raportu ES dla wspólnej daty oraz słownik identyfikatorów pracowników;
- pola zamówień dla `order_id`, czasu utworzenia/kwalifikacji, kuriera i statusu;
- deduplikacja BL/SR, anulacje, częściowe realizacje i reguły braku danych;
- tabela metod dostawy → grupa cutoffów, w tym wyjątek poniedziałkowy;
- bezpieczny, stronicowany eksport historii napływu, jeśli API źródłowe udostępnia wymagane pola.
