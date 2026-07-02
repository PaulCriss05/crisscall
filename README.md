# CrissCall — Quick Connect. Quick Close.

Aplicatie completa de call-center: apeluri (telefonie reala prin Vonage, direct din
browser), SMS, email, contacte, panou de admin si setari. Conceputa pentru o
echipa mica de agenti.

## Pornire rapida (un singur click)

Proiectul vine cu `node_modules` deja inclus, deci nu trebuie sa rulezi `npm install`
prima data.

- **Windows**: dublu-click pe `start.bat`. Se deschide o fereastra cu serverul
  pornit si, automat, browserul la `http://localhost:3000`. Pentru a opri
  serverul, inchizi fereastra neagra ("CrissCall Server").
- **macOS / Linux**: din terminal, `./start.sh`.

Daca la un moment dat stergi sau muti folderul `node_modules`, scriptul il
reinstaleaza automat la urmatoarea pornire (necesita conexiune la internet in
acel moment).

## Cum functioneaza rutarea apelurilor

1. Un client suna pe numarul tau Vonage.
2. Daca exista cel putin un agent cu statusul **Disponibil**, telefonul acelui
   agent (in browser) sună automat timp de 20 de secunde.
3. Daca nu raspunde nimeni in 20 de secunde, sau toti agentii sunt **Ocupati**,
   apelantul aude un mesaj ("toti operatorii sunt ocupati, timp estimat X minute")
   si apoi muzica de asteptare, fiind pus intr-o asteptare privata (doar el, nu e
   amestecat cu alti apelanti care asteapta in acelasi timp).
4. Numarul de minute anuntat vine din ce a setat chiar agentul ocupat (tab Call
   -> Ocupat -> introduci minutele).
5. Orice agent liber vede apelurile din coada in tab-ul Call ("Apeluri in
   asteptare") si le poate prelua manual cu butonul **Preia apel** — apelul
   este redirectionat direct catre el, telefonul sau "sună" exact ca un apel nou.

## 1. Important: despre numarul de telefon (07xx / 021 / 031)

La fel ca la orice alt furnizor (Twilio, Vonage, etc.), numerele locale
romanesti sunt de obicei supuse unor cerinte de reglementare (verificare de
identitate/adresa) inainte sa poata fi cumparate self-service. Nu este o
eroare a aplicatiei. Variante:

- **Numar nou Vonage**: din dashboard, *Numbers* -> *Buy numbers* -> filtrezi
  Romania. Daca nu apar rezultate, contul tau probabil are nevoie de
  verificare suplimentara (KYC) inainte sa permita cumpararea de numere locale
  pentru Romania — verifica sectiunea de verificare a contului din dashboard.
- **Numarul tau actual (Vodafone/Orange/Digi/Telekom)**: cea mai simpla
  solutie este **redirectionarea de apel** (call forwarding) de la numarul tau
  real catre numarul Vonage, configurata din telefon (cod USSD) sau din contul
  de operator.
- Pentru testare imediata, poti cumpara temporar un numar dintr-o alta tara
  (de obicei disponibil instant, fara verificare) — toata aplicatia functioneaza
  identic, doar numarul nu "pare" romanesc.

## 2. Ce trebuie sa configurezi in contul Vonage

Din [dashboard.nexmo.com](https://dashboard.nexmo.com):

1. **API Key** si **API Secret** — vizibile pe pagina principala a dashboard-ului.
2. **O aplicatie Vonage (Application)** — *Applications* -> *Create a new application*:
   - Ii dai un nume (ex: "CrissCall").
   - Activezi capacitatea **Voice**.
   - La **Answer URL**, pui adresa din tab-ul **Setari** al aplicatiei, la
     "Voice - Answer URL" (ex: `https://domeniul-tau.ro/webhooks/voice/answer`),
     metoda `HTTP POST`.
   - La **Event URL**, pui adresa "Voice - Event URL"
     (`https://domeniul-tau.ro/webhooks/voice/event`), metoda `HTTP POST`.
   - La generarea aplicatiei, Vonage iti ofera un fisier **Private Key (.pem)**
     de descarcat — il deschizi cu Notepad, copiezi tot continutul (inclusiv
     liniile `-----BEGIN PRIVATE KEY-----` si `-----END PRIVATE KEY-----`) si il
     lipesti in tab-ul **Setari** al aplicatiei, la campul "Private Key".
   - Noteaza **Application ID**-ul generat.
3. **Un numar de telefon Vonage** — *Numbers* -> numarul tau ->
   il legi de aplicatia creata mai sus (sectiunea "linked application").
   Pentru SMS, la acelasi numar configurezi **Inbound webhook** cu adresa
   "SMS - Inbound Webhook" (`https://domeniul-tau.ro/webhooks/sms/inbound`).

Toate aceste URL-uri sunt generate automat si afisate (cu buton de copiere) in
aplicatie, in tab-ul **Setari**, dupa ce pornesti serverul si setezi
`PUBLIC_BASE_URL`.

Fiecare agent pe care il adaugi din tab-ul **Admin** primeste automat un
utilizator Vonage corespunzator (folosit pentru telefonul din browser).

## 3. Instalare locala (manual, alternativa la start.bat / start.sh)

```bash
npm install
cp .env.example .env
npm start
```

Aplicatia ruleaza pe `http://localhost:3000`. Login initial: **admin / admin123**
— schimba parola din tab-ul **Admin** imediat dupa prima logare.

Poti completa datele Vonage si SMTP direct din interfata (tab **Setari**), nu
doar din `.env` — sunt salvate in `data/db.json` si aplicate fara restart.

## 4. Testare locala cu apeluri reale (ngrok)

Vonage trebuie sa poata trimite request-uri catre aplicatia ta, deci ai nevoie
de o adresa publica HTTPS:

```bash
ngrok http 3000
```

Copiaza URL-ul `https://....ngrok-free.app` generat, pune-l in `.env` la
`PUBLIC_BASE_URL`, reporneste serverul, apoi du-te in tab-ul Setari si copiaza
URL-urile actualizate in aplicatia Vonage (pasul 2).

## 5. Deployment in productie

Aplicatia este un server Node.js standard (Express) — poate fi pusa pe orice
gazduire care suporta Node (Render, Railway, Fly.io, VPS propriu etc.).

1. Incarca proiectul (fara `node_modules` si fara `.env`) pe platforma aleasa.
2. Seteaza variabilele de mediu (cel putin `JWT_SECRET`, `PUBLIC_BASE_URL` cu
   domeniul final HTTPS).
3. Build command: `npm install`. Start command: `npm start`.
4. Actualizeaza Answer URL / Event URL / Inbound webhook in aplicatia Vonage
   cu noul domeniu (vezi tab Setari pentru URL-urile exacte).
5. **HTTPS este obligatoriu** in productie, atat pentru Vonage cat si pentru
   microfonul din browser (WebRTC).

## 6. Email (SMTP)

Tab-ul Email trimite mesaje prin SMTP (Nodemailer). Completeaza in Setari:
host, port, utilizator, parola si adresa expeditor. Tab-ul Email afiseaza doar
mesajele **trimise** din aplicatie — primirea de email-uri (inbox real) nu este
inclusa in aceasta versiune.

## 7. Structura proiectului

```
server.js                  punctul de intrare
start.bat                  pornire cu un click (Windows)
start.sh                   pornire cu un click (macOS / Linux)
db/db.js                    strat de date (fisier JSON, fara dependinte native)
middleware/auth.js           autentificare JWT
services/vonageClient.js     construieste clientul Vonage, genereaza token-uri agent
routes/auth.js                login/logout
routes/voice.js               token Vonage, status agent, coada, preluare apel
routes/webhooks.js            endpoint-uri apelate de VONAGE (raspuns apel, status, SMS)
routes/sms.js                  conversatii SMS (agent)
routes/email.js                trimitere email + jurnal
routes/contacts.js             CRUD contacte
routes/admin.js                 gestionare agenti, statistici, istoric apeluri
routes/settings.js              citire/scriere setari Vonage + SMTP
public/                          interfata (HTML/CSS/JS, fara framework)
```

## 8. Limitari cunoscute / parti care merita verificate

Aceasta integrare a fost construita pe baza documentatiei oficiale Vonage,
verificata direct in codul sursa al SDK-ului `@vonage/server-sdk` si
`@vonage/client-sdk`. Cateva parti sunt mai noi sau mai putin documentate
public si merita verificate daca observi un comportament neasteptat:

- **Mut/Demut in timpul apelului** nu este implementat in aceasta versiune —
  metoda exacta pentru asta in `@vonage/client-sdk` (varianta JavaScript) nu a
  putut fi confirmata cu certitudine in documentatia publica la momentul
  scrierii. Poti verifica [documentatia curenta a SDK-ului]
  (https://vonage.github.io/client-sdk-api-docs/latest/ts/) si adauga
  functionalitatea ulterior.
- **Sunarea simultana a mai multor agenti disponibili** nu este implementata —
  in acest moment, un apel nou suna intotdeauna doar primul agent disponibil
  gasit, nu pe toti simultan (diferit de versiunea anterioara bazata pe Twilio).
- Coada de asteptare este urmarita local (in `data/db.json`), nu pe serverele
  Vonage — functioneaza corect pentru fluxul normal al aplicatiei, dar daca
  serverul este restartat in timp ce apeluri asteapta, lista locala se
  goleste (apelantii raman insa conectati si in asteptare pe linie, doar nu
  mai apar in tabloul de asteptare din interfata).

## 9. Securitate — de verificat inainte de a folosi cu clienti reali

- Schimba `JWT_SECRET` din `.env` cu o valoare lunga si aleatoare.
- Schimba parola contului `admin` din prima zi.
- Pastreaza fisierul cu Private Key Vonage in siguranta, nu il distribui.
- Foloseste mereu HTTPS in productie.
