# MajstorNalog (Field Service Management Platform)

## 1. Pregled sistema
**MajstorNalog** je moderna, open-source B2B SaaS platforma namenjena zanatskim i servisnim preduzećima (klima uređaji, grejanje, liftovi, vodovod, elektroinstalacije, bela tehnika). 

Sistem digitalizuje kompletan ciklus terenskog poslovanja:
- **Kancelarija / Vlasnik**: Dispečerska tabla, raspored majstora, praćenje vozila na mapi, izveštaji i fakturisanje.
- **Majstor na terenu**: Mobilna aplikacija sa radnim nalozima, navigacijom, foto-dokumentacijom pre/posle, utroškom delova i digitalnim potpisom klijenta.
- **Klijent**: Transparentno praćenje dolaska majstora i prijem zvaničnog PDF radnog naloga na email/telefon.

---

## 2. Uloge i prava pristupa (Roles)
1. **Superadmin (Ti - vlasnik platforme)**:
   - Upravljanje pretplatama firmi (paketi, aktivacije, produženja).
   - Globalna analitika i nadzor sistema.
2. **Vlasnik firme (Tenant Admin)**:
   - Upravljanje zaposlenima (dispečeri, majstori).
   - Katalog delova i usluga, lager, cenovnik.
   - Izveštaji o naplati, utrošku materijala i učinku majstora.
3. **Dispečer / Operater**:
   - Prijem poziva i kreiranje radnih naloga.
   - Dodeljivanje naloga majstorima na mapi na osnovu blizine i zauzetosti.
   - Praćenje realizacije u realnom vremenu.
4. **Majstor na terenu**:
   - Pregled svojih zaduženih naloga za danas.
   - Jedan klik za navigaciju do adrese klijenta.
   - Menjanje statusa rada (*Krenuo*, *Na lokaciji*, *Završeno*).
   - Unos utrošenog materijala, fotografisanje i uzimanje potpisa klijenta.

---

## 3. Životni ciklus radnog naloga (Workflow)

```
[ KREIRANO ] 
     ↓  (Dispečer dodeljuje majstora)
[ DODELJENO ] 
     ↓  (Majstor seda u vozilo i kreće ka adresi)
[ NA_PUTU ]  ───> (Klijent dobija SMS/link sa procenom dolaska)
     ↓  (Majstor stiže na adresu klijenta)
[ U_RADU ]   ───> (Fotografisanje kvara pre popravke, rad)
     ↓  (Izbor delova iz kataloga, slika posle, potpis klijenta)
[ ZAVRŠENO ] ───> (Generisanje PDF naloga, evidentiranje naplate)
```

---

## 4. Tehnološki stek (100% Free & Open-Source)
- **Frontend**: React Native sa Expo (v56+) sa strogim **Dual-Platform Paritetom**:
  - Web Browser: Chrome/Safari za desktop dispečerski centar i tablete.
  - Native Android: APK / AAB za telefone majstora na terenu.
- **Mape & Rutiranje**: OpenStreetMap, Leaflet.js i besplatni OSRM ruter (0 RSD trošak, bez skupih Google Maps API ključeva).
- **Backend**: Modularni PHP 8.x REST API sa PDO pripremljenim upitima.
- **Baza podataka**: MySQL / MariaDB sa UTF8MB4 podrškom i multi-tenant izolacijom po `firma_id`.
- **Digitalni potpis**: HTML5 Canvas / SVG touch potpis prstom.
- **PDF generator**: Automatski generisani radni nalozi sa logotipom i specifikacijom.

---

## 5. Monetizacija (Paketi za firme)
| Paket | Broj majstora | Cena mesečno | Karakteristike |
|---|---|---|---|
| **START** | Do 3 majstora | 3.900 RSD (~33 €) | Nalozi, navigacija, digitalni potpis, PDF |
| **PRO** | Do 7 majstora | 7.500 RSD (~64 €) | + Uživo GPS praćenje ekipa, lager delova |
| **ENTERPRISE** | Preko 10 majstora | 12.900 RSD (~110 €) | + SMS obaveštenja klijentima, API izveštaji |

---

## 6. Faze realizacije
- [x] **Faza 1: Baza podataka**: SQL shema sa multi-tenant tabelama i test podacima (`database_dump.sql`).
- [x] **Faza 2: Backend API**: PHP REST kontroler (`api.php`) sa autentifikacijom, CRUD akcijama, licencama i GPS geofence verifikacijom.
- [x] **Faza 3: Mobilni ekran majstora**: Lista naloga za danas, navigacija, statusi rada, GPS verifikacija dolaska na lokaciju (50m opseg), radni delovi i digitalni potpis.
- [x] **Faza 4: Dispečerska tabla sa mapom**: Prikaz lokacija majstora i radnih zadataka u realnom vremenu sa semaforskim statusima i geofence indikacijom.
- [ ] **Faza 5: PDF Generator**: Automatsko kreiranje i slanje overenog radnog naloga.
