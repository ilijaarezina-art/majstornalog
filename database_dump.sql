-- ==========================================================
-- BAZA PODATAKA: majstornalog
-- Sistem za upravljanje terenskim radnim nalozima (FSM)
-- Multi-tenant arhitektura sa potpunom izolacijom po firmama
-- ==========================================================

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- Ako uvozite na lokalni XAMPP možete odkomentarisati sledeće dve linije:
-- CREATE DATABASE IF NOT EXISTS `majstornalog` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- USE `majstornalog`;

-- --------------------------------------------------------
-- 0. Tabela: paketi (SaaS pretplatnički paketi za servise)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `paketi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `kod` varchar(30) NOT NULL UNIQUE,
  `naziv` varchar(100) NOT NULL,
  `cena_mesecno` decimal(10,2) NOT NULL,
  `cena_godisnje` decimal(10,2) NOT NULL,
  `max_majstora` int(11) NOT NULL DEFAULT 5,
  `max_naloga_mesecno` int(11) NOT NULL DEFAULT 500,
  `gps_pracenje` tinyint(1) NOT NULL DEFAULT 1,
  `digitalni_potpis` tinyint(1) NOT NULL DEFAULT 1,
  `katalog_delova` tinyint(1) NOT NULL DEFAULT 1,
  `dispecerski_centar` tinyint(1) NOT NULL DEFAULT 1,
  `sms_obavestenja` tinyint(1) NOT NULL DEFAULT 0,
  `opis` text DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 1. Tabela: firme (Preduzeća / Servisi koji koriste sistem)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `firme` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `naziv` varchar(150) NOT NULL,
  `pib` varchar(20) DEFAULT NULL,
  `maticni_broj` varchar(20) DEFAULT NULL,
  `adresa` varchar(200) DEFAULT NULL,
  `grad` varchar(100) DEFAULT 'Smederevo',
  `telefon` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `logo_url` varchar(255) DEFAULT NULL,
  `paket` varchar(50) DEFAULT 'STANDARD',
  `status_pretplate` enum('AKTIVAN','ISTEKAO','PROBNI','BLOKIRAN') DEFAULT 'PROBNI',
  `datum_isteka` date DEFAULT NULL,
  `kreiran_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 2. Tabela: korisnici (Superadmin, Vlasnici, Dispečeri, Majstori na terenu)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `korisnici` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firma_id` int(11) NOT NULL DEFAULT 1,
  `ime` varchar(80) NOT NULL,
  `prezime` varchar(80) NOT NULL,
  `email` varchar(100) NOT NULL,
  `telefon` varchar(50) NOT NULL,
  `lozinka` varchar(255) NOT NULL,
  `rola` enum('superadmin','vlasnik','dispecer','majstor') NOT NULL DEFAULT 'majstor',
  `boja_markera` varchar(20) DEFAULT '#0284C7',
  `aktivan` tinyint(1) NOT NULL DEFAULT 1,
  `kreiran_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_firma` (`firma_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 3. Tabela: klijenti (Fizička lica i pravna lica / stambene zgrade)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `klijenti` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firma_id` int(11) NOT NULL,
  `tip` enum('FIZICKO','PRAVNO','STAMBENA_ZAJEDNICA') DEFAULT 'FIZICKO',
  `ime_prezime` varchar(120) NOT NULL,
  `pib` varchar(20) DEFAULT NULL,
  `telefon` varchar(50) NOT NULL,
  `telefon2` varchar(50) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `adresa` varchar(200) NOT NULL,
  `sprat_stan` varchar(50) DEFAULT NULL,
  `grad` varchar(100) DEFAULT 'Smederevo',
  `gpsX` double DEFAULT NULL,
  `gpsY` double DEFAULT NULL,
  `napomena` text DEFAULT NULL,
  `kreiran_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_firma_klijent` (`firma_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 4. Tabela: uredjaji (Klime, kotlovi, toplotne pumpe, liftovi...)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `uredjaji` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `klijent_id` int(11) NOT NULL,
  `firma_id` int(11) NOT NULL,
  `kategorija` varchar(80) NOT NULL COMMENT 'Klima, Gasni kotao, Pelet, Lift, Hidrofor...',
  `proizvodjac` varchar(80) DEFAULT NULL COMMENT 'Daikin, Gree, Vaillant, Beretta...',
  `model` varchar(100) DEFAULT NULL,
  `serijski_broj` varchar(100) DEFAULT NULL,
  `lokacija_montaze` varchar(150) DEFAULT NULL COMMENT 'Dnevna soba, podrum, krov...',
  `datum_montaze` date DEFAULT NULL,
  `garancija_do` date DEFAULT NULL,
  `poslednji_servis` date DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_klijent_uredjaj` (`klijent_id`),
  KEY `idx_firma_uredjaj` (`firma_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 5. Tabela: radni_nalozi (Centralna tabela intervencija)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `radni_nalozi` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `broj_naloga` varchar(30) NOT NULL COMMENT 'npr. RN-2026-0001',
  `firma_id` int(11) NOT NULL,
  `klijent_id` int(11) NOT NULL,
  `uredjaj_id` int(11) DEFAULT NULL,
  `majstor_id` int(11) DEFAULT NULL,
  `prioritet` enum('NORMALAN','VISOK','HITNO') DEFAULT 'NORMALAN',
  `tip_intervencije` enum('MONTAZA','REDOVAN_SERVIS','POPRAVKA_KVAR','GARANCIJA','DIJAGNOSTIKA') DEFAULT 'REDOVAN_SERVIS',
  `status` enum('KREIRANO','DODELJENO','PRIHVACENO','NA_PUTU','U_RADU','ODLOZENO','ZAVRSENO','STORNO') DEFAULT 'KREIRANO',
  `adresa` varchar(200) NOT NULL,
  `gpsX` double DEFAULT NULL,
  `gpsY` double DEFAULT NULL,
  `opis_kvara` text DEFAULT NULL,
  `zakazano_za` datetime DEFAULT NULL,
  `vreme_prihvatanja` datetime DEFAULT NULL,
  `vreme_polaska` datetime DEFAULT NULL,
  `vreme_pocetka` datetime DEFAULT NULL,
  `vreme_zavrsetka` datetime DEFAULT NULL,
  `trajanje_minuta` int(11) DEFAULT 0,
  `razlog_odlaganja` text DEFAULT NULL,
  `opis_izvrsenih_radova` text DEFAULT NULL,
  `slika_pre_url` varchar(255) DEFAULT NULL,
  `slika_posle_url` varchar(255) DEFAULT NULL,
  `potpis_klijenta_url` text DEFAULT NULL,
  `potpisnik_ime` varchar(100) DEFAULT NULL,
  `ukupna_cena` decimal(10,2) DEFAULT 0.00,
  `nacin_placanja` enum('GOTOVINA','KARTICA','VIRMAN_FAKTURA','BESPLATNO_GARANCIJA') DEFAULT 'GOTOVINA',
  `naplaceno` tinyint(1) DEFAULT 0,
  `kreirao_id` int(11) DEFAULT NULL,
  `poslednja_promena` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `kreiran_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_firma_nalog` (`firma_id`),
  KEY `idx_majstor_nalog` (`majstor_id`),
  KEY `idx_status_nalog` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 6. Tabela: nalozi_stavke (Utrošeni delovi i radni sati po nalogu)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `nalozi_stavke` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nalog_id` int(11) NOT NULL,
  `katalog_id` int(11) DEFAULT NULL,
  `naziv` varchar(150) NOT NULL,
  `jedinica_mere` varchar(20) DEFAULT 'kom',
  `kolicina` decimal(8,2) NOT NULL DEFAULT 1.00,
  `jedinicna_cena` decimal(10,2) NOT NULL DEFAULT 0.00,
  `ukupno` decimal(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `idx_nalog_stavka` (`nalog_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 7. Tabela: katalog_delova_i_usluga (Šifarnik materijala i servisa)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `katalog_delova_i_usluga` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firma_id` int(11) NOT NULL,
  `sifra` varchar(50) DEFAULT NULL,
  `naziv` varchar(150) NOT NULL,
  `tip` enum('DEO','USLUGA','MATERIJAL') DEFAULT 'DEO',
  `jedinica_mere` varchar(20) DEFAULT 'kom',
  `cena` decimal(10,2) NOT NULL DEFAULT 0.00,
  `kolicina_na_stanju` decimal(10,2) DEFAULT 0.00,
  `aktivan` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  KEY `idx_firma_katalog` (`firma_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 8. Tabela: majstori_lokacija (GPS telemetrija vozila / majstora uživo)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `majstori_lokacija` (
  `majstor_id` int(11) NOT NULL,
  `firma_id` int(11) NOT NULL,
  `gpsX` double NOT NULL,
  `gpsY` double NOT NULL,
  `brzina` float DEFAULT 0,
  `kurs` float DEFAULT 0,
  `status` enum('SLOBODAN','NA_PUTU','NA_TERENU','PAUZA') DEFAULT 'SLOBODAN',
  `trenutni_nalog_id` int(11) DEFAULT NULL,
  `poslednje_azuriranje` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`majstor_id`),
  KEY `idx_firma_lokacija` (`firma_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 9. Tabela: status_istorija (Dnevnik promena statusa naloga)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `status_istorija` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `nalog_id` int(11) NOT NULL,
  `prethodni_status` varchar(50) DEFAULT NULL,
  `novi_status` varchar(50) NOT NULL,
  `promenio_id` int(11) DEFAULT NULL,
  `komentar` text DEFAULT NULL,
  `kreiran_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_nalog_istorija` (`nalog_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------
-- 10. Tabela: licence_istorija (Dnevnik promena i produženja licenci servisa)
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS `licence_istorija` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `firma_id` int(11) NOT NULL,
  `prethodni_datum` date DEFAULT NULL,
  `novi_datum` date NOT NULL,
  `paket` varchar(50) DEFAULT NULL,
  `razlog` varchar(255) DEFAULT 'Ažuriranje licence',
  `kreiran_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_licence_firma` (`firma_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==========================================================
-- TEST PODACI ZA RAZVOJ (SaaS Paketi, Firme, Korisnici)
-- ==========================================================

INSERT INTO `paketi` (`id`, `kod`, `naziv`, `cena_mesecno`, `cena_godisnje`, `max_majstora`, `max_naloga_mesecno`, `gps_pracenje`, `digitalni_potpis`, `katalog_delova`, `dispecerski_centar`, `sms_obavestenja`, `opis`) VALUES
(1, 'START', 'Start Paket (Mali servisi & zanatlije)', 2990.00, 29900.00, 2, 100, 0, 1, 1, 0, 0, 'Idealan za samostalne majstore i male radnje do 2 majstora. Obuhvata mobilnu aplikaciju, radne naloge, digitalni potpis stranke i šifarnik delova.'),
(2, 'STANDARD', 'Standard Paket (Mali i srednji servisi)', 5990.00, 59900.00, 6, 500, 1, 1, 1, 1, 0, 'Najpopularniji paket za servise do 6 majstora. Obuhvata GPS praćenje uživo na mapi, dispečerski centar za desktop/tablet, optimizaciju ruta i digitalne potpise.'),
(3, 'PRO', 'Pro Servis Paket (Veliki servisi i montaže)', 9990.00, 99900.00, 15, 2000, 1, 1, 1, 1, 1, 'Za ozbiljne servise do 15 majstora sa dispečerom. Obuhvata neograničeno praćenje, SMS obaveštenja klijentima, kompletnu analitiku i napredne izveštaje.'),
(4, 'ENTERPRISE', 'Enterprise Korporativni (Neograničeno)', 19990.00, 199900.00, 999, 99999, 1, 1, 1, 1, 1, 'Za velika preduzeća, javna komunalna preduzeća i održavanje liftova sa neograničenim brojem radnika, prioritetnom podrškom i API integracijama.')
ON DUPLICATE KEY UPDATE `naziv` = VALUES(`naziv`), `cena_mesecno` = VALUES(`cena_mesecno`);

INSERT INTO `firme` (`id`, `naziv`, `pib`, `maticni_broj`, `adresa`, `grad`, `telefon`, `email`, `paket`, `status_pretplate`, `datum_isteka`) VALUES
(1, 'TermoKlima Servis d.o.o.', '108923451', '20938471', 'Karađorđeva 45', 'Smederevo', '026-612-345', 'info@termoklima-sd.rs', 'PRO', 'AKTIVAN', '2027-12-31'),
(2, 'Vodoinstalater Brzi Smederevo', '109988776', '20887766', 'Vojvode Stepe 14', 'Smederevo', '026-654-321', 'kontakt@vodoinstalater-sd.rs', 'START', 'PROBNI', DATE_ADD(CURDATE(), INTERVAL 14 DAY)),
(3, 'EkoLift Održavanje Liftova', '105544332', '20443322', 'Kolarska 50', 'Smederevo', '026-600-700', 'office@ekolift-sd.rs', 'STANDARD', 'ISTEKAO', DATE_SUB(CURDATE(), INTERVAL 5 DAY))
ON DUPLICATE KEY UPDATE `naziv` = VALUES(`naziv`), `paket` = VALUES(`paket`), `status_pretplate` = VALUES(`status_pretplate`), `datum_isteka` = VALUES(`datum_isteka`);

INSERT INTO `korisnici` (`id`, `firma_id`, `ime`, `prezime`, `email`, `telefon`, `lozinka`, `rola`, `boja_markera`, `aktivan`) VALUES
(1, 1, 'Marko', 'Jovanović', 'gazda@termoklima-sd.rs', '064-111-222', '$2y$10$abcdefghijklmnopqrstuv', 'vlasnik', '#2563EB', 1),
(2, 1, 'Nikola', 'Petrović', 'nikola@termoklima-sd.rs', '063-222-333', '$2y$10$abcdefghijklmnopqrstuv', 'majstor', '#059669', 1),
(3, 1, 'Milan', 'Đorđević', 'milan@termoklima-sd.rs', '065-333-444', '$2y$10$abcdefghijklmnopqrstuv', 'majstor', '#D97706', 1),
(4, 1, 'Super', 'Administrator', 'admin@majstornalog.rs', '069-000-000', '$2y$10$abcdefghijklmnopqrstuv', 'superadmin', '#7C3AED', 1)
ON DUPLICATE KEY UPDATE `email` = VALUES(`email`), `rola` = VALUES(`rola`);

INSERT INTO `klijenti` (`id`, `firma_id`, `tip`, `ime_prezime`, `telefon`, `adresa`, `sprat_stan`, `grad`, `gpsX`, `gpsY`, `napomena`) VALUES
(1, 1, 'FIZICKO', 'Dragan Stanković', '064-555-666', 'Knez Mihailova 12', 'Sprat 2, Stan 8', 'Smederevo', 44.6655, 20.9290, 'Interfon ne radi, zvati na mobilni'),
(2, 1, 'FIZICKO', 'Jelena Milić', '062-777-888', 'Despota Đurđa 88', 'Kuća', 'Smederevo', 44.6612, 20.9345, 'Klima u dečijoj sobi curi'),
(3, 1, 'PRAVNO', 'Apoteka Zdravlje', '026-444-555', 'Trg Republike 4', 'Lokal', 'Smederevo', 44.6630, 20.9260, 'Hitno - frižider za lekove ne hladi')
ON DUPLICATE KEY UPDATE `ime_prezime` = VALUES(`ime_prezime`);

INSERT INTO `katalog_delova_i_usluga` (`id`, `firma_id`, `sifra`, `naziv`, `tip`, `jedinica_mere`, `cena`, `kolicina_na_stanju`) VALUES
(1, 1, 'USL-01', 'Godišnji servis i pranje klime', 'USLUGA', 'kom', 3500.00, 999.00),
(2, 1, 'USL-02', 'Montaža klima uređaja do 3m instalacije', 'USLUGA', 'kom', 12000.00, 999.00),
(3, 1, 'DEL-01', 'Freon R32 (dopuna po 100g)', 'DEO', '100g', 800.00, 150.00),
(4, 1, 'DEL-02', 'Startni kondenzator 35uF', 'DEO', 'kom', 1800.00, 24.00),
(5, 1, 'DEL-03', 'Kondenzaciono crevo fi 16 (metar)', 'DEO', 'm', 150.00, 120.00)
ON DUPLICATE KEY UPDATE `naziv` = VALUES(`naziv`), `cena` = VALUES(`cena`);

INSERT INTO `radni_nalozi` (`id`, `broj_naloga`, `firma_id`, `klijent_id`, `majstor_id`, `prioritet`, `tip_intervencije`, `status`, `adresa`, `gpsX`, `gpsY`, `opis_kvara`, `zakazano_za`, `ukupna_cena`) VALUES
(1, 'RN-2026-0001', 1, 1, 2, 'NORMALAN', 'REDOVAN_SERVIS', 'U_RADU', 'Knez Mihailova 12', 44.6655, 20.9290, 'Redovno godišnje pranje i dezinfekcija inverter klime', '2026-10-22 10:00:00', 3500.00),
(2, 'RN-2026-0002', 1, 2, 2, 'NORMALAN', 'POPRAVKA_KVAR', 'DODELJENO', 'Despota Đurđa 88', 44.6612, 20.9345, 'Unutrašnja jedinica curi niz zid tokom hlađenja', '2026-10-22 12:30:00', 0.00),
(3, 'RN-2026-0003', 1, 3, 3, 'HITNO', 'POPRAVKA_KVAR', 'NA_PUTU', 'Trg Republike 4', 44.6630, 20.9260, 'Hitna intervencija: Rashladna vitrina u apoteci stala', '2026-10-22 11:15:00', 0.00)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`), `broj_naloga` = VALUES(`broj_naloga`);

INSERT INTO `majstori_lokacija` (`majstor_id`, `firma_id`, `gpsX`, `gpsY`, `brzina`, `kurs`, `status`, `trenutni_nalog_id`) VALUES
(2, 1, 44.6654, 20.9288, 0, 90, 'NA_TERENU', 1),
(3, 1, 44.6601, 20.9220, 32.5, 45, 'NA_PUTU', 3)
ON DUPLICATE KEY UPDATE `gpsX` = VALUES(`gpsX`), `gpsY` = VALUES(`gpsY`);
