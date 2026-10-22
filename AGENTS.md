# Pravila i instrukcije za rad na projektu MajstorNalog

## 1. GitHub & cPanel Web Deployment Pravilo (STRIKTNO I OBAVEZNO)
Svaka nova dorada, funkcionalnost ili ispravka u aplikaciji mora biti verifikovana i **odmah podignuta na GitHub** kako bi korisnik mogao da povuče izmene na cPanel hosting i testira sve na webu:
1. **Verifikacija i kompajliranje Web bundle-a:**
   `cmd /c npx.cmd expo export --platform web`
2. **Sinhronizacija web distribucije u koren repozitorijuma:**
   Ukloniti stare web bundle fajlove iz `_expo/static/js/web/*.js` i iskopirati sveže fajlove iz `dist/*` u koren repozitorijuma (`_expo/`, `index.html`, `metadata.json`).
3. **Commit i Push na GitHub (`origin master`):**
   `git add -A`
   `git commit -m "..."`
   `git -c http.sslVerify=false push origin master`

## 2. Server & Baza Podataka (Live cPanel - bookmymusic.rs)
- **Domen / Putanja:** `https://bookmymusic.rs/majstornalog/`
- **Baza:** `bookmymurs_majstornalog`
- **Korisnik baze:** `bookmymurs_ilija`
- **Lozinka baze:** `Stefan5656!`
- **Endpoint:** `https://bookmymusic.rs/majstornalog/api.php`

## 3. Zabrana automatskog pravljenja Android Build-a (STRIKTNO)
- **NIKADA ne pokretati EAS build (`eas build`, `npx eas-cli build`) automatski.**
- Sve izmene se uvek prvo puštaju na GitHub i cPanel za web testiranje.
- Tek kada korisnik pregleda i testira na webu, i eksplicitno zatraži ("napravi build"), sme se pokrenuti EAS build.

## 4. Dual-Platform Parity & 100% Besplatna Rešenja
- Sve funkcionalnosti moraju raditi i na Web pretraživačima i u Native Android aplikaciji.
- Nema plaćenih API servisa – koriste se OpenStreetMap, Leaflet, OSRM i sopstveni MySQL/PHP backend.
