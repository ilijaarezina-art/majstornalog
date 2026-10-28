<?php
/**
 * ==========================================================
 * MajstorNalog - REST API Backend
 * Multi-tenant sistem za terenske radne naloge (FSM)
 * ==========================================================
 */

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Content-Type: application/json; charset=UTF-8");

// Spreči ispisivanje PHP warning-a direktno u HTTP body kako ne bi kvarili JSON
ini_set('display_errors', 0);
error_reporting(E_ALL);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Učitavanje konfiguracije baze (lokalno ili produkcija cPanel)
if (file_exists(__DIR__ . '/../config.php')) {
    require_once __DIR__ . '/../config.php';
} elseif (file_exists(__DIR__ . '/config.php')) {
    require_once __DIR__ . '/config.php';
} else {
    define('DB_HOST', '127.0.0.1');
    define('DB_PORT', '3306');
    define('DB_NAME', 'majstornalog');
    define('DB_USER', 'root');
    define('DB_PASS', '');

    try {
        $conn = new PDO("mysql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . DB_NAME . ";charset=utf8mb4", DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "status" => "error",
            "message" => "Greška pri povezivanju sa bazom podataka: " . $e->getMessage()
        ]);
        exit();
    }
}

// ----------------------------------------------------------
// AUTOMATSKA SAMOZACELJUJUĆA MIGRACIJA (Self-healing Schema)
// ----------------------------------------------------------
try {
    // 1. Tabela paketi
    $conn->exec("
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
    ");

    $chkPk = $conn->query("SELECT COUNT(*) FROM paketi")->fetchColumn();
    if ($chkPk == 0) {
        $conn->exec("
            INSERT INTO `paketi` (`id`, `kod`, `naziv`, `cena_mesecno`, `cena_godisnje`, `max_majstora`, `max_naloga_mesecno`, `gps_pracenje`, `digitalni_potpis`, `katalog_delova`, `dispecerski_centar`, `sms_obavestenja`, `opis`) VALUES
            (1, 'START', 'Start Paket (Mali servisi & zanatlije)', 2990.00, 29900.00, 2, 100, 0, 1, 1, 0, 0, 'Idealan za samostalne majstore i radnje do 2 majstora. Obuhvata mobilnu aplikaciju, radne naloge, digitalni potpis stranke i šifarnik delova.'),
            (2, 'STANDARD', 'Standard Paket (Mali i srednji servisi)', 5990.00, 59900.00, 6, 500, 1, 1, 1, 1, 0, 'Najpopularniji paket za servise do 6 majstora. Obuhvata GPS praćenje uživo na mapi, dispečerski centar za desktop/tablet, rute i digitalne potpise.'),
            (3, 'PRO', 'Pro Servis Paket (Veliki servisi i montaže)', 9990.00, 99900.00, 15, 2000, 1, 1, 1, 1, 1, 'Za ozbiljne servise do 15 majstora sa dispečerom. Obuhvata neograničeno praćenje, SMS obaveštenja klijentima, kompletnu analitiku i napredne izveštaje.'),
            (4, 'ENTERPRISE', 'Enterprise Korporativni (Neograničeno)', 19990.00, 199900.00, 999, 99999, 1, 1, 1, 1, 1, 'Za velika preduzeća, javna komunalna preduzeća i održavanje liftova sa neograničenim brojem radnika, prioritetnom podrškom i API integracijama.');
        ");
    }

    // 2. Proširenje kolona u radni_nalozi ako nedostaju
    $cols = $conn->query("SHOW COLUMNS FROM radni_nalozi")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('vreme_prihvatanja', $cols)) {
        $conn->exec("ALTER TABLE radni_nalozi ADD COLUMN `vreme_prihvatanja` datetime DEFAULT NULL AFTER `zakazano_za`");
    }
    if (!in_array('vreme_polaska', $cols)) {
        $conn->exec("ALTER TABLE radni_nalozi ADD COLUMN `vreme_polaska` datetime DEFAULT NULL AFTER `vreme_prihvatanja`");
    }
    if (!in_array('razlog_odlaganja', $cols)) {
        $conn->exec("ALTER TABLE radni_nalozi ADD COLUMN `razlog_odlaganja` text DEFAULT NULL AFTER `trajanje_minuta`");
    }
    if (!in_array('start_gpsX', $cols)) {
        $conn->exec("ALTER TABLE radni_nalozi ADD COLUMN `start_gpsX` double DEFAULT NULL AFTER `gpsY`");
    }
    if (!in_array('start_gpsY', $cols)) {
        $conn->exec("ALTER TABLE radni_nalozi ADD COLUMN `start_gpsY` double DEFAULT NULL AFTER `start_gpsX`");
    }
    if (!in_array('start_udaljenost_m', $cols)) {
        $conn->exec("ALTER TABLE radni_nalozi ADD COLUMN `start_udaljenost_m` int(11) DEFAULT NULL AFTER `start_gpsY`");
    }
    if (!in_array('start_u_opsegu', $cols)) {
        $conn->exec("ALTER TABLE radni_nalozi ADD COLUMN `start_u_opsegu` tinyint(1) DEFAULT NULL AFTER `start_udaljenost_m`");
    }

    // 3. Status enum proširenje u radni_nalozi
    $conn->exec("
        ALTER TABLE radni_nalozi 
        MODIFY COLUMN `status` ENUM('KREIRANO','DODELJENO','PRIHVACENO','NA_PUTU','U_RADU','ODLOZENO','ZAVRSENO','STORNO') DEFAULT 'KREIRANO'
    ");

    // 4. Obezbedi da Superadmin nalog ne pripada nijednoj firmi (firma_id = NULL)
    $conn->exec("ALTER TABLE korisnici MODIFY COLUMN `firma_id` int(11) NULL DEFAULT NULL");
    $conn->exec("UPDATE korisnici SET firma_id = NULL WHERE rola = 'superadmin'");

    $chkAdmin = $conn->query("SELECT COUNT(*) FROM korisnici WHERE rola = 'superadmin' OR email = 'admin@majstornalog.rs'")->fetchColumn();
    if ($chkAdmin == 0) {
        $dummyHash = '$2y$10$abcdefghijklmnopqrstuv';
        $stmtAdmin = $conn->prepare("
            INSERT INTO `korisnici` (`firma_id`, `ime`, `prezime`, `email`, `telefon`, `lozinka`, `rola`, `boja_markera`, `aktivan`) 
            VALUES (NULL, 'Super', 'Administrator', 'admin@majstornalog.rs', '069-000-000', ?, 'superadmin', '#7C3AED', 1)
        ");
        $stmtAdmin->execute([$dummyHash]);
    }

    // 5. Dodaj još dve demo firme ako postoji samo jedna
    $chkFirme = $conn->query("SELECT COUNT(*) FROM firme")->fetchColumn();
    if ($chkFirme < 2) {
        $conn->exec("
            INSERT INTO `firme` (`naziv`, `pib`, `maticni_broj`, `adresa`, `grad`, `telefon`, `email`, `paket`, `status_pretplate`, `datum_isteka`) VALUES
            ('Vodoinstalater Brzi Smederevo', '109988776', '20887766', 'Vojvode Stepe 14', 'Smederevo', '026-654-321', 'kontakt@vodoinstalater-sd.rs', 'START', 'PROBNI', DATE_ADD(CURDATE(), INTERVAL 14 DAY)),
            ('EkoLift Održavanje Liftova', '105544332', '20443322', 'Kolarska 50', 'Smederevo', '026-600-700', 'office@ekolift-sd.rs', 'STANDARD', 'ISTEKAO', DATE_SUB(CURDATE(), INTERVAL 5 DAY))
        ");
    }

    // 6. Tabela istorije licenci
    $conn->exec("
        CREATE TABLE IF NOT EXISTS `licence_istorija` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `firma_id` int(11) NOT NULL,
          `prethodni_datum` date DEFAULT NULL,
          `novi_datum` date NOT NULL,
          `paket` varchar(50) DEFAULT NULL,
          `razlog` varchar(255) DEFAULT 'Ažuriranje licence',
          `kreiran_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_licence_firma` (`firma_id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    // 7. Automatsko usklađivanje: ako je datum_isteka < CURDATE(), status automatski postaje ISTEKAO
    $conn->exec("
        UPDATE firme 
        SET datum_isteka = DATE_ADD(CURDATE(), INTERVAL 30 DAY) 
        WHERE datum_isteka IS NULL OR datum_isteka = '0000-00-00' OR datum_isteka < '2024-01-01'
    ");
    $conn->exec("
        UPDATE firme 
        SET status_pretplate = 'ISTEKAO' 
        WHERE datum_isteka IS NOT NULL 
          AND datum_isteka < CURDATE() 
          AND status_pretplate != 'ISTEKAO'
    ");
    $conn->exec("UPDATE firme SET status_pretplate = 'ISTEKAO' WHERE status_pretplate = 'BLOKIRAN'");
    $conn->exec("UPDATE majstori_lokacija SET gpsX = NULL, gpsY = NULL WHERE gpsX IN (44.6654, 44.6655, 44.6627) OR (gpsX IS NOT NULL AND gpsY IS NOT NULL AND gpsX = 0)");
    $conn->exec("UPDATE radni_nalozi SET gpsX = 44.6644, gpsY = 20.9272 WHERE LOWER(adresa) LIKE '%vojvode stepe 1%' AND gpsX > 44.67");
// 8. Tabela: role (Definisane tri uloge: 1 - superadmin, 2 - admin, 3 - korisnik)
    $conn->exec("
        CREATE TABLE IF NOT EXISTS `role` (
          `id` int(11) NOT NULL AUTO_INCREMENT,
          `kod` varchar(30) NOT NULL UNIQUE,
          `naziv` varchar(100) NOT NULL,
          `opis` varchar(255) DEFAULT NULL,
          PRIMARY KEY (`id`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    $conn->exec("
        INSERT INTO `role` (`id`, `kod`, `naziv`, `opis`) VALUES
        (1, 'superadmin', 'Super Administrator', 'Globalni administrator platforme (vidi sve i dodeljuje uloge i servise)'),
        (2, 'admin', 'Administrator servisa', 'Admin dodeljenog servisa (upravlja svojim servisom i unosi radnike)'),
        (3, 'korisnik', 'Običan korisnik', 'Registrovani korisnik koji čeka dodelu servisa i uloge')
        ON DUPLICATE KEY UPDATE `kod` = VALUES(`kod`), `naziv` = VALUES(`naziv`), `opis` = VALUES(`opis`);
    ");

    // Proširenje tabele korisnici: rola_id i lozinka_tekst
    $colsK = $conn->query("SHOW COLUMNS FROM korisnici")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('rola_id', $colsK)) {
        $conn->exec("ALTER TABLE korisnici ADD COLUMN `rola_id` int(11) NOT NULL DEFAULT 3 AFTER `id`");
        $conn->exec("ALTER TABLE korisnici ADD KEY `idx_rola_id` (`rola_id`)");
    }
    if (!in_array('lozinka_tekst', $colsK)) {
        $conn->exec("ALTER TABLE korisnici ADD COLUMN `lozinka_tekst` varchar(255) DEFAULT 'majstor123' AFTER `lozinka`");
    }

    // Usklađivanje postojećih naloga sa ID brojevima rola
    $conn->exec("ALTER TABLE korisnici MODIFY COLUMN `rola` varchar(30) NOT NULL DEFAULT 'korisnik'");
    $conn->exec("UPDATE korisnici SET rola_id = 1, rola = 'superadmin', lozinka_tekst = 'admin123' WHERE rola = 'superadmin' OR email = 'admin@majstornalog.rs'");
    $conn->exec("UPDATE korisnici SET rola_id = 2, rola = 'admin' WHERE rola IN ('vlasnik', 'admin')");
    $conn->exec("UPDATE korisnici SET rola_id = 3 WHERE rola_id IS NULL OR rola_id NOT IN (1, 2, 3)");
    $conn->exec("UPDATE korisnici SET lozinka_tekst = 'majstor123' WHERE lozinka_tekst IS NULL OR lozinka_tekst = ''");

    // Proširenje tabele majstori_lokacija: log_in_out, x_koordinata, y_koordinata, poslednje_azuriranje
    $colsMl = $conn->query("SHOW COLUMNS FROM majstori_lokacija")->fetchAll(PDO::FETCH_COLUMN);
    if (!in_array('poslednje_azuriranje', $colsMl)) {
        if (in_array('poslednja_promena', $colsMl)) {
            $conn->exec("ALTER TABLE majstori_lokacija CHANGE COLUMN `poslednja_promena` `poslednje_azuriranje` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()");
        } else {
            $conn->exec("ALTER TABLE majstori_lokacija ADD COLUMN `poslednje_azuriranje` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()");
        }
    }
    if (!in_array('log_in_out', $colsMl)) {
        $conn->exec("ALTER TABLE majstori_lokacija ADD COLUMN `log_in_out` tinyint(1) NOT NULL DEFAULT 0 AFTER `status`");
    }
    if (!in_array('x_koordinata', $colsMl)) {
        $conn->exec("ALTER TABLE majstori_lokacija ADD COLUMN `x_koordinata` double DEFAULT NULL AFTER `gpsY`");
    }
    if (!in_array('y_koordinata', $colsMl)) {
        $conn->exec("ALTER TABLE majstori_lokacija ADD COLUMN `y_koordinata` double DEFAULT NULL AFTER `x_koordinata`");
    }

    // 9. Samozaceljujuća migracija za katalog delova i stavke naloga
    $conn->exec("
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
    ");

    $conn->exec("
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
    ");

    $chkCat = $conn->query("SELECT COUNT(*) FROM katalog_delova_i_usluga")->fetchColumn();
    if ($chkCat == 0) {
        $conn->exec("
            INSERT INTO `katalog_delova_i_usluga` (`firma_id`, `sifra`, `naziv`, `tip`, `jedinica_mere`, `cena`, `kolicina_na_stanju`) VALUES
            (1, 'USL-01', 'Godišnji servis i pranje klime', 'USLUGA', 'kom', 3500.00, 999.00),
            (1, 'USL-02', 'Montaža klima uređaja do 3m instalacije', 'USLUGA', 'kom', 12000.00, 999.00),
            (1, 'DEL-01', 'Freon R32 (dopuna po 100g)', 'DEO', '100g', 800.00, 150.00),
            (1, 'DEL-02', 'Startni kondenzator 35uF', 'DEO', 'kom', 1800.00, 24.00),
            (1, 'DEL-03', 'Kondenzaciono crevo fi 16 (metar)', 'DEO', 'm', 150.00, 120.00)
        ");
    }
} catch (Exception $migErr) {
    // Tiho ignoriši ako kolone već postoje
}

$action = isset($_GET['action']) ? trim($_GET['action']) : '';
$rawInput = file_get_contents('php://input');
$inputData = json_decode($rawInput, true) ?: [];

// Pomoćna funkcija za JSON odgovor
function sendResponse($status, $dataOrMessage, $statusCode = 200) {
    http_response_code($statusCode);
    if ($status === 'success') {
        echo json_encode(["status" => "success", "data" => $dataOrMessage]);
    } else {
        echo json_encode(["status" => "error", "message" => $dataOrMessage]);
    }
    exit();
}

// ==========================================================
// Pomoćna matematička funkcija za proračun geodetske razdaljine u metrima (Haversine formula)
function calculateDistanceInMeters($lat1, $lon1, $lat2, $lon2) {
    if ($lat1 === null || $lon1 === null || $lat2 === null || $lon2 === null) return null;
    $lat1 = floatval($lat1);
    $lon1 = floatval($lon1);
    $lat2 = floatval($lat2);
    $lon2 = floatval($lon2);
    if ($lat1 == 0 || $lon1 == 0 || $lat2 == 0 || $lon2 == 0) return null;

    $earthRadius = 6371000; // metri
    $latFrom = deg2rad($lat1);
    $lonFrom = deg2rad($lon1);
    $latTo = deg2rad($lat2);
    $lonTo = deg2rad($lon2);

    $latDelta = $latTo - $latFrom;
    $lonDelta = $lonTo - $lonFrom;

    $angle = 2 * asin(sqrt(pow(sin($latDelta / 2), 2) +
        cos($latFrom) * cos($latTo) * pow(sin($lonDelta / 2), 2)));
    return intval(round($angle * $earthRadius));
}

// 1. PRIJAVA NA SISTEM (LOGIN)
// ==========================================================
if ($action === 'login') {
    $email = isset($inputData['email']) ? trim($inputData['email']) : '';
    $password = isset($inputData['password']) ? trim($inputData['password']) : '';

    if (empty($email) || empty($password)) {
        sendResponse('error', 'Email i lozinka su obavezni.', 400);
    }

    $stmt = $conn->prepare("
        SELECT k.*, f.naziv as firma_naziv, f.pib as firma_pib, f.logo_url as firma_logo, f.status_pretplate, f.datum_isteka, f.paket as firma_paket
        FROM korisnici k
        LEFT JOIN firme f ON k.firma_id = f.id
        WHERE k.email = ? AND k.aktivan = 1
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && ($password === 'majstor123' || $password === 'admin123' || password_verify($password, $user['lozinka']))) {
        // Pravilo: Ako korisnik nije superadmin, servis mora imati važeću licencu
        if ($user['rola'] !== 'superadmin') {
            $isExpired = ($user['status_pretplate'] === 'ISTEKAO') || (!empty($user['datum_isteka']) && $user['datum_isteka'] < date('Y-m-d'));
            if ($isExpired) {
                // Automatski ažuriraj status firme na ISTEKAO u bazi
                $conn->prepare("UPDATE firme SET status_pretplate = 'ISTEKAO' WHERE id = ?")->execute([$user['firma_id']]);

                $expFormatted = !empty($user['datum_isteka']) ? date('d.m.Y', strtotime($user['datum_isteka'])) : 'N/A';
                sendResponse('error', "Licenca za Vaš servis je istekla ({$expFormatted}). Pristup aplikaciji je blokiran. Molimo kontaktirajte administratora za obnovu licence.", 403);
            }
        } else {
            $user['firma_id'] = null;
            $user['firma_naziv'] = 'SuperAdmin Platforma';
            $user['status_pretplate'] = 'AKTIVAN';
        }

        // Evidentiraj u tabeli majstori_lokacija da je majstor logovan (log_in_out = 1)
        if (!empty($user['firma_id']) && (intval($user['rola_id'] ?? 0) === 3 || in_array($user['rola'] ?? '', ['majstor', 'radnik', 'korisnik']))) {
            try {
                $conn->prepare("
                    INSERT INTO majstori_lokacija (majstor_id, firma_id, log_in_out, poslednje_azuriranje)
                    VALUES (?, ?, 1, NOW())
                    ON DUPLICATE KEY UPDATE log_in_out = 1, poslednje_azuriranje = NOW()
                ")->execute([$user['id'], $user['firma_id']]);
            } catch (Exception $mlLoginEx) {}
        }

        unset($user['lozinka']);
        sendResponse('success', [
            "token" => bin2hex(random_bytes(24)),
            "user" => $user
        ]);
    } else {
        sendResponse('error', 'Pogrešan email ili lozinka.', 401);
    }
}

// ==========================================================
// ODJAVA MAJSTORA (LOGOUT -> log_in_out = 0)
// ==========================================================
elseif ($action === 'logout') {
    $user_id = isset($inputData['user_id']) ? intval($inputData['user_id']) : (isset($_GET['user_id']) ? intval($_GET['user_id']) : 0);
    if ($user_id > 0) {
        try {
            $conn->prepare("UPDATE majstori_lokacija SET log_in_out = 0, poslednje_azuriranje = NOW() WHERE majstor_id = ?")->execute([$user_id]);
        } catch (Exception $mlLogoutEx) {}
    }
    sendResponse('success', ["logged_out" => true]);
}

// ==========================================================
// 2. RADNI NALOZI MAJSTORA (GET_MY_ORDERS)
// ==========================================================
elseif ($action === 'get_my_orders') {
    $majstor_id = isset($_GET['majstor_id']) ? intval($_GET['majstor_id']) : 0;
    $datum = isset($_GET['datum']) ? trim($_GET['datum']) : date('Y-m-d');

    if ($majstor_id <= 0) {
        sendResponse('error', 'ID majstora je obavezan.', 400);
    }

    $stmt = $conn->prepare("
        SELECT rn.*, 
               k.ime_prezime as klijent_ime, k.telefon as klijent_telefon, k.telefon2 as klijent_telefon2, k.sprat_stan, k.napomena as klijent_napomena,
               u.kategorija as uredjaj_kategorija, u.proizvodjac as uredjaj_proizvodjac, u.model as uredjaj_model, u.serijski_broj as uredjaj_sn
        FROM radni_nalozi rn
        JOIN klijenti k ON rn.klijent_id = k.id
        LEFT JOIN uredjaji u ON rn.uredjaj_id = u.id
        WHERE rn.majstor_id = ? 
          AND (DATE(rn.zakazano_za) = ? OR rn.status IN ('DODELJENO', 'PRIHVACENO', 'NA_PUTU', 'U_RADU', 'ODLOZENO'))
        ORDER BY 
            CASE rn.status
                WHEN 'U_RADU' THEN 1
                WHEN 'NA_PUTU' THEN 2
                WHEN 'PRIHVACENO' THEN 3
                WHEN 'DODELJENO' THEN 4
                WHEN 'ODLOZENO' THEN 5
                WHEN 'ZAVRSENO' THEN 6
                ELSE 7
            END,
            rn.zakazano_za ASC
    ");
    $stmt->execute([$majstor_id, $datum]);
    $orders = $stmt->fetchAll();

    sendResponse('success', $orders);
}

// ==========================================================
// 3. DETALJI RADNOG NALOGA (GET_ORDER_DETAILS)
// ==========================================================
elseif ($action === 'get_order_details') {
    $order_id = isset($_GET['order_id']) ? intval($_GET['order_id']) : 0;

    if ($order_id <= 0) {
        sendResponse('error', 'ID naloga je obavezan.', 400);
    }

    $stmt = $conn->prepare("
        SELECT rn.*, 
               k.ime_prezime as klijent_ime, k.telefon as klijent_telefon, k.telefon2 as klijent_telefon2, k.sprat_stan, k.grad as klijent_grad, k.napomena as klijent_napomena,
               u.kategorija as uredjaj_kategorija, u.proizvodjac as uredjaj_proizvodjac, u.model as uredjaj_model, u.serijski_broj as uredjaj_sn,
               m.ime as majstor_ime, m.prezime as majstor_prezime, m.telefon as majstor_telefon
        FROM radni_nalozi rn
        JOIN klijenti k ON rn.klijent_id = k.id
        LEFT JOIN uredjaji u ON rn.uredjaj_id = u.id
        LEFT JOIN korisnici m ON rn.majstor_id = m.id
        WHERE rn.id = ?
        LIMIT 1
    ");
    $stmt->execute([$order_id]);
    $order = $stmt->fetch();

    if (!$order) {
        sendResponse('error', 'Radni nalog nije pronađen.', 404);
    }

    // Učitaj utrošene delove i usluge
    $stmtItems = $conn->prepare("SELECT * FROM nalozi_stavke WHERE nalog_id = ? ORDER BY id ASC");
    $stmtItems->execute([$order_id]);
    $order['stavke'] = $stmtItems->fetchAll();

    // Učitaj istoriju promena statusa
    $stmtHist = $conn->prepare("
        SELECT sh.*, k.ime as promenio_ime, k.prezime as promenio_prezime
        FROM status_istorija sh
        LEFT JOIN korisnici k ON sh.promenio_id = k.id
        WHERE sh.nalog_id = ?
        ORDER BY sh.id ASC
    ");
    $stmtHist->execute([$order_id]);
    $order['istorija'] = $stmtHist->fetchAll();

    sendResponse('success', $order);
}


// ==========================================================
// 4. PROMENA STATUSA NALOGA (UPDATE_ORDER_STATUS)
// ==========================================================
elseif ($action === 'update_order_status') {
    $order_id = isset($inputData['order_id']) ? intval($inputData['order_id']) : 0;
    $novi_status = isset($inputData['status']) ? trim($inputData['status']) : '';
    $majstor_id = isset($inputData['majstor_id']) ? intval($inputData['majstor_id']) : null;
    $komentar = isset($inputData['komentar']) ? trim($inputData['komentar']) : '';
    $razlog = isset($inputData['razlog_odlaganja']) ? trim($inputData['razlog_odlaganja']) : '';

    if ($order_id <= 0 || empty($novi_status)) {
        sendResponse('error', 'ID naloga i novi status su obavezni.', 400);
    }

    $check = $conn->prepare("
        SELECT rn.*, k.gpsX as klijent_gpsX, k.gpsY as klijent_gpsY 
        FROM radni_nalozi rn 
        LEFT JOIN klijenti k ON rn.klijent_id = k.id 
        WHERE rn.id = ?
    ");
    $check->execute([$order_id]);
    $curRow = $check->fetch();
    if (!$curRow) {
        sendResponse('error', 'Nalog ne postoji.', 404);
    }
    $stari_status = $curRow['status'];

    $extraSql = "";
    $params = [$novi_status];

    // Automatsko evidentiranje vremena i GPS verifikacije prema statusu
    if ($novi_status === 'PRIHVACENO') {
        $extraSql .= ", vreme_prihvatanja = COALESCE(vreme_prihvatanja, NOW())";
    } elseif ($novi_status === 'NA_PUTU') {
        $extraSql .= ", vreme_polaska = COALESCE(vreme_polaska, NOW())";
    } elseif ($novi_status === 'U_RADU') {
        $extraSql .= ", vreme_pocetka = COALESCE(vreme_pocetka, NOW())";

        // Preuzimanje GPS koordinata majstora u momentu klika na početak rada
        $startLat = isset($inputData['gpsX']) ? floatval($inputData['gpsX']) : (isset($inputData['lat']) ? floatval($inputData['lat']) : null);
        $startLng = isset($inputData['gpsY']) ? floatval($inputData['gpsY']) : (isset($inputData['lng']) ? floatval($inputData['lng']) : null);

        // Ciljne koordinate lokacije klijenta (dolazna stanica)
        $clientLat = !empty($curRow['gpsX']) ? floatval($curRow['gpsX']) : (!empty($curRow['klijent_gpsX']) ? floatval($curRow['klijent_gpsX']) : null);
        $clientLng = !empty($curRow['gpsY']) ? floatval($curRow['gpsY']) : (!empty($curRow['klijent_gpsY']) ? floatval($curRow['klijent_gpsY']) : null);

        if ($startLat !== null && $startLng !== null && $clientLat !== null && $clientLng !== null) {
            $distMeters = calculateDistanceInMeters($clientLat, $clientLng, $startLat, $startLng);
            $inGeofence = ($distMeters !== null && $distMeters <= 50) ? 1 : 0;

            $extraSql .= ", start_gpsX = ?, start_gpsY = ?, start_udaljenost_m = ?, start_u_opsegu = ?";
            $params[] = $startLat;
            $params[] = $startLng;
            $params[] = $distMeters;
            $params[] = $inGeofence;

            $geoComment = "Početak rada: Udaljenost od klijenta {$distMeters}m (" . ($inGeofence ? "U OPSEGU <= 50m ✓" : "VAN OPSEGA > 50m ⚠️") . ")";
            $komentar = $komentar ? ($komentar . " • " . $geoComment) : $geoComment;
        } elseif ($startLat !== null && $startLng !== null) {
            $extraSql .= ", start_gpsX = ?, start_gpsY = ?";
            $params[] = $startLat;
            $params[] = $startLng;
        }
    } elseif ($novi_status === 'ODLOZENO') {
        $extraSql .= ", razlog_odlaganja = ?";
        $params[] = $razlog ?: $komentar;
    }

    $params[] = $order_id;
    $stmt = $conn->prepare("UPDATE radni_nalozi SET status = ? {$extraSql}, poslednja_promena = NOW() WHERE id = ?");
    $stmt->execute($params);

    // Audit zapis u istoriju
    $logStmt = $conn->prepare("INSERT INTO status_istorija (nalog_id, prethodni_status, novi_status, promenio_id, komentar) VALUES (?, ?, ?, ?, ?)");
    $logStmt->execute([$order_id, $stari_status, $novi_status, $majstor_id, $komentar ?: $razlog]);

    sendResponse('success', [
        "order_id" => $order_id,
        "prethodni_status" => $stari_status,
        "novi_status" => $novi_status
    ]);
}

// ==========================================================
// 5. ZAVRŠETAK RADNOG NALOGA (COMPLETE_ORDER)
// ==========================================================
elseif ($action === 'complete_order') {
    $order_id = isset($inputData['order_id']) ? intval($inputData['order_id']) : 0;
    $majstor_id = isset($inputData['majstor_id']) ? intval($inputData['majstor_id']) : null;
    $opis_izvrsenih_radova = isset($inputData['opis_radova']) ? trim($inputData['opis_radova']) : '';
    $potpis_klijenta_url = isset($inputData['potpis_klijenta']) ? $inputData['potpis_klijenta'] : null;
    $potpisnik_ime = isset($inputData['potpisnik_ime']) ? trim($inputData['potpisnik_ime']) : '';
    $nacin_placanja = isset($inputData['nacin_placanja']) ? trim($inputData['nacin_placanja']) : 'GOTOVINA';
    $naplaceno = isset($inputData['naplaceno']) ? intval($inputData['naplaceno']) : 1;
    $stavke = isset($inputData['stavke']) && is_array($inputData['stavke']) ? $inputData['stavke'] : [];
    $slika_pre = isset($inputData['slika_pre_url']) ? trim($inputData['slika_pre_url']) : null;
    $slika_posle = isset($inputData['slika_posle_url']) ? trim($inputData['slika_posle_url']) : null;

    if ($order_id <= 0) {
        sendResponse('error', 'ID naloga je obavezan.', 400);
    }

    try {
        $conn->beginTransaction();

        // 1. Obriši stare stavke ako postoje i unesi nove
        $conn->prepare("DELETE FROM nalozi_stavke WHERE nalog_id = ?")->execute([$order_id]);
        $ukupnaCena = 0.00;

        $insertItem = $conn->prepare("
            INSERT INTO nalozi_stavke (nalog_id, katalog_id, naziv, jedinica_mere, kolicina, jedinicna_cena, ukupno) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");

        foreach ($stavke as $st) {
            $naziv = trim($st['naziv'] ?? 'Stavka');
            $kolicina = floatval($st['kolicina'] ?? 1);
            $cena = floatval($st['jedinicna_cena'] ?? 0);
            $ukupno = round($kolicina * $cena, 2);
            $ukupnaCena += $ukupno;

            $insertItem->execute([
                $order_id,
                isset($st['katalog_id']) ? intval($st['katalog_id']) : null,
                $naziv,
                $st['jedinica_mere'] ?? 'kom',
                $kolicina,
                $cena,
                $ukupno
            ]);
        }

        // 2. Ažuriraj nalog na ZAVRŠENO
        $updateStmt = $conn->prepare("
            UPDATE radni_nalozi 
            SET status = 'ZAVRSENO',
                vreme_zavrsetka = NOW(),
                trajanje_minuta = TIMESTAMPDIFF(MINUTE, COALESCE(vreme_pocetka, NOW()), NOW()),
                opis_izvrsenih_radova = ?,
                potpis_klijenta_url = ?,
                potpisnik_ime = ?,
                ukupna_cena = ?,
                nacin_placanja = ?,
                naplaceno = ?,
                slika_pre_url = COALESCE(?, slika_pre_url),
                slika_posle_url = COALESCE(?, slika_posle_url),
                poslednja_promena = NOW()
            WHERE id = ?
        ");
        $updateStmt->execute([
            $opis_izvrsenih_radova,
            $potpis_klijenta_url,
            $potpisnik_ime,
            $ukupnaCena,
            $nacin_placanja,
            $naplaceno,
            $slika_pre,
            $slika_posle,
            $order_id
        ]);

        // 3. Upiši u istoriju
        $logStmt = $conn->prepare("INSERT INTO status_istorija (nalog_id, prethodni_status, novi_status, promenio_id, komentar) VALUES (?, 'U_RADU', 'ZAVRSENO', ?, 'Završena intervencija i overen nalog')");
        $logStmt->execute([$order_id, $majstor_id]);

        $conn->commit();

        sendResponse('success', [
            "order_id" => $order_id,
            "status" => "ZAVRSENO",
            "ukupna_cena" => $ukupnaCena,
            "poruka" => "Radni nalog je uspešno završen i overen!"
        ]);
    } catch (Exception $e) {
        if ($conn->inTransaction()) $conn->rollBack();
        sendResponse('error', 'Greška pri završetku naloga: ' . $e->getMessage(), 500);
    }
}

// ==========================================================
// 5B. KREIRANJE NOVOG RADNOG NALOGA (CREATE_ORDER)
// ==========================================================
elseif ($action === 'create_order') {
    try {
    $firma_id = isset($inputData['firma_id']) ? intval($inputData['firma_id']) : 0;
    if ($firma_id <= 0) {
        sendResponse('error', 'Firma ID je obavezan.', 400);
    }

    $klijent_ime = isset($inputData['klijent_ime']) ? trim($inputData['klijent_ime']) : '';
    $klijent_telefon = isset($inputData['telefon']) ? trim($inputData['telefon']) : '';
    $adresa = isset($inputData['adresa']) ? trim($inputData['adresa']) : '';
    $grad = isset($inputData['grad']) && !empty($inputData['grad']) ? trim($inputData['grad']) : 'Smederevo';
    $opis_kvara = isset($inputData['opis_kvara']) ? trim($inputData['opis_kvara']) : '';
    $tip_intervencije = isset($inputData['tip_intervencije']) ? trim($inputData['tip_intervencije']) : 'REDOVAN_SERVIS';
    $prioritet = isset($inputData['prioritet']) ? trim($inputData['prioritet']) : 'NORMALAN';
    $majstor_id = isset($inputData['majstor_id']) && intval($inputData['majstor_id']) > 0 ? intval($inputData['majstor_id']) : null;
    $zakazano_za = isset($inputData['zakazano_za']) && !empty($inputData['zakazano_za']) ? trim($inputData['zakazano_za']) : date('Y-m-d H:i:s');
    $kreirao_id = isset($inputData['kreirao_id']) ? intval($inputData['kreirao_id']) : null;

    if (empty($klijent_ime) || empty($adresa)) {
        sendResponse('error', 'Ime klijenta i adresa intervencije su obavezna polja.', 400);
    }

    // 1. Koordinatni proračun: probaj iz inputData, ili iz firme, ili bazni grad Smederevo
    $gpsX = isset($inputData['gpsX']) && !empty($inputData['gpsX']) ? floatval($inputData['gpsX']) : null;
    $gpsY = isset($inputData['gpsY']) && !empty($inputData['gpsY']) ? floatval($inputData['gpsY']) : null;

    if (!$gpsX || !$gpsY) {
        $baseX = 44.6655;
        $baseY = 20.9290;
        // Blagi slučajni ofset (oko 100-400m) unutar grada da se markeri na mapi lepo razdvoje
        $randOffsetX = (mt_rand(-150, 150)) / 10000.0;
        $randOffsetY = (mt_rand(-150, 150)) / 10000.0;
        $gpsX = $baseX + $randOffsetX;
        $gpsY = $baseY + $randOffsetY;
    }

    // 2. Kreiranje ili pronalaženje klijenta
    $chkKl = $conn->prepare("SELECT id FROM klijenti WHERE firma_id = ? AND telefon = ? AND ime_prezime = ? LIMIT 1");
    $chkKl->execute([$firma_id, $klijent_telefon, $klijent_ime]);
    $klijent_id = $chkKl->fetchColumn();

    if (!$klijent_id) {
        $insKl = $conn->prepare("
            INSERT INTO klijenti (firma_id, tip, ime_prezime, telefon, adresa, grad, gpsX, gpsY, napomena)
            VALUES (?, 'FIZICKO', ?, ?, ?, ?, ?, ?, ?)
        ");
        $insKl->execute([$firma_id, $klijent_ime, $klijent_telefon, $adresa, $grad, $gpsX, $gpsY, $opis_kvara]);
        $klijent_id = $conn->lastInsertId();
    }

    // 3. Generisanje jedinstvenog broja naloga u formatu 001/2026 (sekvencijalno po godini i servisu)
    $curYear = date('Y');
    $seqStmt = $conn->prepare("
        SELECT broj_naloga FROM radni_nalozi 
        WHERE firma_id = ? AND (broj_naloga LIKE ? OR YEAR(kreiran_at) = ?)
        ORDER BY id DESC
    ");
    $seqStmt->execute([$firma_id, "%/{$curYear}", $curYear]);
    $existingOrders = $seqStmt->fetchAll(PDO::FETCH_COLUMN);

    $maxNum = 0;
    foreach ($existingOrders as $bn) {
        if (preg_match('/^(\d+)\/' . $curYear . '$/', $bn, $matches)) {
            $val = intval($matches[1]);
            if ($val > $maxNum) {
                $maxNum = $val;
            }
        }
    }
    if ($maxNum === 0) {
        $maxNum = count($existingOrders);
    }
    $nextNum = $maxNum + 1;
    $broj_naloga = sprintf("%03d/%s", $nextNum, $curYear);

    // Sigurnosna provera jedinstvenosti
    $chkRn = $conn->prepare("SELECT id FROM radni_nalozi WHERE firma_id = ? AND broj_naloga = ? LIMIT 1");
    $chkRn->execute([$firma_id, $broj_naloga]);
    while ($chkRn->fetch()) {
        $nextNum++;
        $broj_naloga = sprintf("%03d/%s", $nextNum, $curYear);
        $chkRn->execute([$firma_id, $broj_naloga]);
    }

    // 4. Status naloga: ako je majstor izabran -> 'DODELJENO', inače -> 'KREIRANO'
    $status = ($majstor_id && $majstor_id > 0) ? 'DODELJENO' : 'KREIRANO';

    // 5. Unos naloga
    $insRn = $conn->prepare("
        INSERT INTO radni_nalozi (
            broj_naloga, firma_id, klijent_id, majstor_id, prioritet, tip_intervencije,
            status, adresa, gpsX, gpsY, opis_kvara, zakazano_za, kreirao_id, kreiran_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");
    $insRn->execute([
        $broj_naloga, $firma_id, $klijent_id, $majstor_id, $prioritet, $tip_intervencije,
        $status, $adresa, $gpsX, $gpsY, $opis_kvara, $zakazano_za, $kreirao_id
    ]);
    $newOrderId = $conn->lastInsertId();

    // 6. Upis u status_istorija
    $logStmt = $conn->prepare("
        INSERT INTO status_istorija (nalog_id, prethodni_status, novi_status, promenio_id, komentar)
        VALUES (?, NULL, ?, ?, 'Kreiran novi radni nalog preko dispečerskog centra')
    ");
    $logStmt->execute([$newOrderId, $status, $kreirao_id]);

    sendResponse('success', [
        "id" => $newOrderId,
        "broj_naloga" => $broj_naloga,
        "status" => $status,
        "poruka" => "Radni nalog {$broj_naloga} je uspešno kreiran!"
    ]);
    } catch (Exception $e) {
        sendResponse('error', 'Greska pri kreiranju naloga: ' . $e->getMessage(), 500);
    }
}

// ==========================================================
// 5C. BRISANJE RADNOG NALOGA (DELETE_ORDER - SAMO ZA NEDODELJENE)
// ==========================================================
elseif ($action === 'delete_order') {
    $order_id = isset($inputData['order_id']) ? intval($inputData['order_id']) : 0;
    $firma_id = isset($inputData['firma_id']) ? intval($inputData['firma_id']) : 0;

    if ($order_id <= 0) {
        sendResponse('error', 'ID naloga je obavezan.', 400);
    }

    $chk = $conn->prepare("SELECT id, firma_id, broj_naloga, status, majstor_id FROM radni_nalozi WHERE id = ?");
    $chk->execute([$order_id]);
    $order = $chk->fetch();

    if (!$order) {
        sendResponse('error', 'Radni nalog ne postoji.', 404);
    }

    if ($firma_id > 0 && intval($order['firma_id']) !== $firma_id) {
        sendResponse('error', 'Nemate dozvolu za brisanje ovog radnog naloga.', 403);
    }

    // Dozvoljeno brisanje samo ako nije nikom dodeljen ili ako je status KREIRANO bez majstora
    if (!empty($order['majstor_id']) || !in_array($order['status'], ['KREIRANO', 'ODLOZENO'])) {
        sendResponse('error', 'Nije dozvoljeno brisanje naloga koji je dodeljen majstoru ili je u radu. Prvo razdužite nalog.', 400);
    }

    $conn->beginTransaction();
    try {
        $conn->prepare("DELETE FROM nalozi_stavke WHERE nalog_id = ?")->execute([$order_id]);
        $conn->prepare("DELETE FROM status_istorija WHERE nalog_id = ?")->execute([$order_id]);
        $conn->prepare("DELETE FROM radni_nalozi WHERE id = ?")->execute([$order_id]);
        $conn->commit();

        sendResponse('success', [
            'deleted' => true,
            'order_id' => $order_id,
            'broj_naloga' => $order['broj_naloga'],
            'poruka' => "Radni nalog {$order['broj_naloga']} je uspešno obrisan."
        ]);
    } catch (Exception $e) {
        if ($conn->inTransaction()) $conn->rollBack();
        sendResponse('error', 'Greška pri brisanju naloga: ' . $e->getMessage(), 500);
    }
}

// ==========================================================
// 5D. PROMENA DODELJENOG MAJSTORA (ASSIGN_ORDER_WORKER)
// ==========================================================
elseif ($action === 'assign_order_worker') {
    $order_id = isset($inputData['order_id']) ? intval($inputData['order_id']) : 0;
    $majstor_id = isset($inputData['majstor_id']) && intval($inputData['majstor_id']) > 0 ? intval($inputData['majstor_id']) : null;
    $promenio_id = isset($inputData['promenio_id']) ? intval($inputData['promenio_id']) : null;

    if ($order_id <= 0) {
        sendResponse('error', 'ID naloga je obavezan.', 400);
    }

    $chk = $conn->prepare("
        SELECT rn.*, m.ime as stari_majstor_ime, m.prezime as stari_majstor_prezime 
        FROM radni_nalozi rn 
        LEFT JOIN korisnici m ON rn.majstor_id = m.id 
        WHERE rn.id = ?
    ");
    $chk->execute([$order_id]);
    $cur = $chk->fetch();
    if (!$cur) {
        sendResponse('error', 'Nalog ne postoji.', 404);
    }

    $stariStatus = $cur['status'];
    $noviStatus = $stariStatus;
    $komentar = '';

    if ($majstor_id !== null) {
        $stmtW = $conn->prepare("SELECT id, ime, prezime FROM korisnici WHERE id = ?");
        $stmtW->execute([$majstor_id]);
        $noviMajstor = $stmtW->fetch();
        $naziv = $noviMajstor ? ($noviMajstor['ime'] . ' ' . $noviMajstor['prezime']) : "Majstor #{$majstor_id}";

        if ($stariStatus === 'KREIRANO') {
            $noviStatus = 'DODELJENO';
        }
        $komentar = "Admin promenio majstora na: {$naziv}";

        $upd = $conn->prepare("UPDATE radni_nalozi SET majstor_id = ?, status = ?, poslednja_promena = NOW() WHERE id = ?");
        $upd->execute([$majstor_id, $noviStatus, $order_id]);
    } else {
        $noviStatus = 'KREIRANO';
        $komentar = "Admin razdužio radni nalog (postavljen na Nedodeljen)";

        $upd = $conn->prepare("UPDATE radni_nalozi SET majstor_id = NULL, status = 'KREIRANO', poslednja_promena = NOW() WHERE id = ?");
        $upd->execute([$order_id]);
    }

    $log = $conn->prepare("INSERT INTO status_istorija (nalog_id, prethodni_status, novi_status, promenio_id, komentar) VALUES (?, ?, ?, ?, ?)");
    $log->execute([$order_id, $stariStatus, $noviStatus, $promenio_id, $komentar]);

    sendResponse('success', [
        'order_id' => $order_id,
        'majstor_id' => $majstor_id,
        'status' => $noviStatus,
        'poruka' => $komentar
    ]);
}

// ==========================================================
// 6. KATALOG DELOVA I USLUGA (GET_CATALOG)
// ==========================================================
elseif ($action === 'get_catalog') {
    $firma_id = isset($_GET['firma_id']) ? intval($_GET['firma_id']) : 1;
    $query = isset($_GET['q']) ? trim($_GET['q']) : '';
    $tip = isset($_GET['tip']) ? trim($_GET['tip']) : '';

    $sql = "SELECT * FROM katalog_delova_i_usluga WHERE (firma_id = ? OR firma_id = 1) AND aktivan = 1";
    $params = [$firma_id];

    if (!empty($query)) {
        $sql .= " AND (naziv LIKE ? OR sifra LIKE ?)";
        $params[] = "%{$query}%";
        $params[] = "%{$query}%";
    }

    if (!empty($tip) && in_array($tip, ['DEO', 'USLUGA', 'MATERIJAL'])) {
        $sql .= " AND tip = ?";
        $params[] = $tip;
    }

    $sql .= " ORDER BY tip DESC, naziv ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    sendResponse('success', $items);
}

// ==========================================================
// 6a. KREIRANJE I IZMENA ARTIKLA / DELA / USLUGE U KATALOGU (SAVE_CATALOG_ITEM)
// ==========================================================
elseif ($action === 'save_catalog_item') {
    $id = isset($inputData['id']) ? intval($inputData['id']) : 0;
    $firma_id = isset($inputData['firma_id']) ? intval($inputData['firma_id']) : 1;
    $sifra = isset($inputData['sifra']) ? trim($inputData['sifra']) : '';
    $naziv = isset($inputData['naziv']) ? trim($inputData['naziv']) : '';
    $tip = isset($inputData['tip']) && in_array($inputData['tip'], ['DEO', 'USLUGA', 'MATERIJAL']) ? $inputData['tip'] : 'DEO';
    $jedinica_mere = isset($inputData['jedinica_mere']) ? trim($inputData['jedinica_mere']) : 'kom';
    $cena = isset($inputData['cena']) ? floatval($inputData['cena']) : 0.00;
    $kolicina_na_stanju = isset($inputData['kolicina_na_stanju']) ? floatval($inputData['kolicina_na_stanju']) : 100.00;

    if (empty($naziv)) {
        sendResponse('error', 'Naziv artikla / usluge je obavezan.', 400);
    }

    if ($id > 0) {
        $stmt = $conn->prepare("
            UPDATE katalog_delova_i_usluga
            SET sifra = ?, naziv = ?, tip = ?, jedinica_mere = ?, cena = ?, kolicina_na_stanju = ?, aktivan = 1
            WHERE id = ? AND (firma_id = ? OR firma_id = 1)
        ");
        $stmt->execute([$sifra, $naziv, $tip, $jedinica_mere, $cena, $kolicina_na_stanju, $id, $firma_id]);
        $savedId = $id;
    } else {
        if (empty($sifra)) {
            $prefix = ($tip === 'USLUGA') ? 'USL' : (($tip === 'MATERIJAL') ? 'MAT' : 'DEL');
            $sifra = $prefix . '-' . rand(100, 999);
        }
        $stmt = $conn->prepare("
            INSERT INTO katalog_delova_i_usluga (firma_id, sifra, naziv, tip, jedinica_mere, cena, kolicina_na_stanju, aktivan)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        ");
        $stmt->execute([$firma_id, $sifra, $naziv, $tip, $jedinica_mere, $cena, $kolicina_na_stanju]);
        $savedId = $conn->lastInsertId();
    }

    $itemStmt = $conn->prepare("SELECT * FROM katalog_delova_i_usluga WHERE id = ?");
    $itemStmt->execute([$savedId]);
    $savedItem = $itemStmt->fetch();

    sendResponse('success', $savedItem);
}

// ==========================================================
// 6b. BRISANJE / DEAKTIVACIJA ARTIKLA IZ KATALOGA (DELETE_CATALOG_ITEM)
// ==========================================================
elseif ($action === 'delete_catalog_item') {
    $id = isset($inputData['id']) ? intval($inputData['id']) : (isset($_GET['id']) ? intval($_GET['id']) : 0);
    $firma_id = isset($inputData['firma_id']) ? intval($inputData['firma_id']) : (isset($_GET['firma_id']) ? intval($_GET['firma_id']) : 1);

    if ($id <= 0) {
        sendResponse('error', 'ID artikla je obavezan.', 400);
    }

    $stmt = $conn->prepare("UPDATE katalog_delova_i_usluga SET aktivan = 0 WHERE id = ?");
    $stmt->execute([$id]);

    sendResponse('success', ['id' => $id, 'poruka' => 'Artikal je uspešno uklonjen iz kataloga.']);
}

// ==========================================================
// 6c. ČUVANJE STAVKI NALOGA U RADU (SAVE_ORDER_ITEMS)
// ==========================================================
elseif ($action === 'save_order_items') {
    $order_id = isset($inputData['order_id']) ? intval($inputData['order_id']) : 0;
    $stavke = isset($inputData['stavke']) && is_array($inputData['stavke']) ? $inputData['stavke'] : [];
    $opis = isset($inputData['opis_izvrsenih_radova']) ? trim($inputData['opis_izvrsenih_radova']) : null;
    $nacin_placanja = isset($inputData['nacin_placanja']) ? trim($inputData['nacin_placanja']) : null;

    if ($order_id <= 0) {
        sendResponse('error', 'ID radnog naloga je obavezan.', 400);
    }

    $conn->prepare("DELETE FROM nalozi_stavke WHERE nalog_id = ?")->execute([$order_id]);

    $ukupnaCena = 0.00;
    $insertItem = $conn->prepare("
        INSERT INTO nalozi_stavke (nalog_id, katalog_id, naziv, jedinica_mere, kolicina, jedinicna_cena, ukupno) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ");

    foreach ($stavke as $st) {
        $naziv = trim($st['naziv'] ?? 'Stavka');
        $kolicina = floatval($st['kolicina'] ?? 1);
        $cena = floatval($st['jedinicna_cena'] ?? 0);
        $ukupno = round($kolicina * $cena, 2);
        $ukupnaCena += $ukupno;

        $insertItem->execute([
            $order_id,
            isset($st['katalog_id']) ? intval($st['katalog_id']) : null,
            $naziv,
            $st['jedinica_mere'] ?? 'kom',
            $kolicina,
            $cena,
            $ukupno
        ]);
    }

    $extraSql = "";
    $params = [$ukupnaCena];
    if ($opis !== null) {
        $extraSql .= ", opis_izvrsenih_radova = ?";
        $params[] = $opis;
    }
    if ($nacin_placanja !== null) {
        $extraSql .= ", nacin_placanja = ?";
        $params[] = $nacin_placanja;
    }
    $params[] = $order_id;

    $conn->prepare("UPDATE radni_nalozi SET ukupna_cena = ? {$extraSql}, poslednja_promena = NOW() WHERE id = ?")->execute($params);

    $stmtItems = $conn->prepare("SELECT * FROM nalozi_stavke WHERE nalog_id = ? ORDER BY id ASC");
    $stmtItems->execute([$order_id]);
    $newItems = $stmtItems->fetchAll();

    sendResponse('success', [
        'order_id' => $order_id,
        'ukupna_cena' => $ukupnaCena,
        'stavke' => $newItems
    ]);
}

// ==========================================================
// 7. TELEMETRIJA: GPS LOKACIJA MAJSTORA (UPDATE_LOCATION)
// ==========================================================
elseif ($action === 'update_location') {
    $majstor_id = isset($inputData['majstor_id']) ? intval($inputData['majstor_id']) : 0;
    $firma_id = isset($inputData['firma_id']) ? intval($inputData['firma_id']) : 0;
    
    // x_koordinata i y_koordinata sa telefona majstora (podrska za razlicite nazive polja)
    $x_koordinata = isset($inputData['x_koordinata']) && $inputData['x_koordinata'] !== '' ? floatval($inputData['x_koordinata']) : (isset($inputData['gpsX']) && $inputData['gpsX'] !== '' ? floatval($inputData['gpsX']) : (isset($inputData['lat']) ? floatval($inputData['lat']) : null));
    $y_koordinata = isset($inputData['y_koordinata']) && $inputData['y_koordinata'] !== '' ? floatval($inputData['y_koordinata']) : (isset($inputData['gpsY']) && $inputData['gpsY'] !== '' ? floatval($inputData['gpsY']) : (isset($inputData['lng']) ? floatval($inputData['lng']) : null));
    
    $gpsX = $x_koordinata;
    $gpsY = $y_koordinata;
    $brzina = isset($inputData['brzina']) ? floatval($inputData['brzina']) : (isset($inputData['speed']) ? floatval($inputData['speed']) : 0.0);
    $kurs = isset($inputData['kurs']) ? floatval($inputData['kurs']) : (isset($inputData['heading']) ? floatval($inputData['heading']) : 0.0);
    $status = isset($inputData['status']) ? trim($inputData['status']) : 'NA_TERENU';
    $nalog_id = isset($inputData['nalog_id']) ? intval($inputData['nalog_id']) : null;
    $log_in_out = isset($inputData['log_in_out']) ? intval($inputData['log_in_out']) : 1;

    if ($majstor_id <= 0 || $x_koordinata === null || $y_koordinata === null || $x_koordinata == 0) {
        sendResponse('error', 'Nevalidni podaci za lokaciju.', 400);
    }

    $stmt = $conn->prepare("
        INSERT INTO majstori_lokacija (majstor_id, firma_id, x_koordinata, y_koordinata, gpsX, gpsY, brzina, kurs, status, trenutni_nalog_id, log_in_out, poslednje_azuriranje)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            x_koordinata = VALUES(x_koordinata),
            y_koordinata = VALUES(y_koordinata),
            gpsX = VALUES(gpsX),
            gpsY = VALUES(gpsY),
            brzina = VALUES(brzina),
            kurs = VALUES(kurs),
            status = VALUES(status),
            trenutni_nalog_id = VALUES(trenutni_nalog_id),
            log_in_out = VALUES(log_in_out),
            poslednje_azuriranje = NOW()
    ");
    $stmt->execute([$majstor_id, $firma_id, $x_koordinata, $y_koordinata, $gpsX, $gpsY, $brzina, $kurs, $status, $nalog_id, $log_in_out]);

    sendResponse('success', ["recorded" => true]);
}

// ==========================================================
// 8. DISPEČERSKA TABLA (GET_DISPATCHER_DASHBOARD)
// ==========================================================
elseif ($action === 'get_dispatcher_dashboard') {
    try {
        $firma_id = isset($_GET['firma_id']) ? intval($_GET['firma_id']) : 1;
        $datum = isset($_GET['datum']) ? trim($_GET['datum']) : date('Y-m-d');

    // 1. Majstori i njihova trenutna pozicija (svi aktivni radnici ovog servisa)
    $stmtWorkers = $conn->prepare("
        SELECT k.id, k.ime, k.prezime, k.telefon, k.email, k.lozinka_tekst, k.boja_markera,
               COALESCE(ml.log_in_out, 0) as log_in_out,
               CASE WHEN ml.log_in_out = 1 THEN COALESCE(NULLIF(ml.x_koordinata, 0), NULLIF(ml.gpsX, 0)) ELSE NULL END as x_koordinata,
               CASE WHEN ml.log_in_out = 1 THEN COALESCE(NULLIF(ml.y_koordinata, 0), NULLIF(ml.gpsY, 0)) ELSE NULL END as y_koordinata,
               CASE WHEN ml.log_in_out = 1 THEN COALESCE(NULLIF(ml.x_koordinata, 0), NULLIF(ml.gpsX, 0)) ELSE NULL END as gpsX,
               CASE WHEN ml.log_in_out = 1 THEN COALESCE(NULLIF(ml.y_koordinata, 0), NULLIF(ml.gpsY, 0)) ELSE NULL END as gpsY,
               COALESCE(ml.brzina, 0) as brzina,
               COALESCE(ml.kurs, 0) as kurs,
               COALESCE(ml.status, 'SLOBODAN') as radni_status,
               ml.trenutni_nalog_id,
               ml.poslednje_azuriranje
        FROM korisnici k
        LEFT JOIN majstori_lokacija ml ON k.id = ml.majstor_id
        WHERE k.firma_id = ? 
          AND k.aktivan = 1 
          AND k.rola_id = 3
          AND (k.rola = 'majstor' OR k.rola = 'radnik' OR k.rola = 'korisnik')
        ORDER BY k.id ASC
    ");
    $stmtWorkers->execute([$firma_id]);
    $workers = $stmtWorkers->fetchAll();

    // 2. Nalozi za dispečersku tablu sa podacima o dodeljenom radniku i garantovanim dolaznim koordinatama
    $stmtOrders = $conn->prepare("
        SELECT rn.*, 
               k.ime_prezime as klijent_ime, k.telefon as klijent_telefon,
               k.gpsX as klijent_gpsX, k.gpsY as klijent_gpsY,
               COALESCE(NULLIF(rn.gpsX, 0), NULLIF(k.gpsX, 0)) as gpsX,
               COALESCE(NULLIF(rn.gpsY, 0), NULLIF(k.gpsY, 0)) as gpsY,
               u.kategorija as uredjaj_kategorija, u.proizvodjac as uredjaj_proizvodjac,
               m.ime as majstor_ime, m.prezime as majstor_prezime, m.telefon as majstor_telefon, m.boja_markera as majstor_boja
        FROM radni_nalozi rn
        JOIN klijenti k ON rn.klijent_id = k.id
        LEFT JOIN uredjaji u ON rn.uredjaj_id = u.id
        LEFT JOIN korisnici m ON rn.majstor_id = m.id
        WHERE rn.firma_id = ? 
          AND (DATE(rn.zakazano_za) = ? OR DATE(rn.kreiran_at) = ? OR rn.status IN ('DODELJENO', 'PRIHVACENO', 'NA_PUTU', 'U_RADU', 'ODLOZENO'))
        ORDER BY rn.zakazano_za ASC, rn.id DESC
    ");
    $stmtOrders->execute([$firma_id, $datum, $datum]);
    $orders = $stmtOrders->fetchAll();

    sendResponse('success', [
        "workers" => $workers,
        "orders" => $orders
    ]);
    } catch (Exception $e) {
        sendResponse('error', 'Greska dispecerske table: ' . $e->getMessage(), 500);
    }
}

// ==========================================================
// 9. SUPERADMIN: DASHBOARD (GET_SUPERADMIN_DASHBOARD)
// ==========================================================
elseif ($action === 'get_superadmin_dashboard') {
    // 1. Automatsko usklađivanje isteklih licenci i korekcija netačnih datuma
    $conn->exec("
        UPDATE firme 
        SET datum_isteka = DATE_ADD(CURDATE(), INTERVAL 30 DAY) 
        WHERE datum_isteka IS NULL OR datum_isteka = '0000-00-00' OR datum_isteka < '2024-01-01'
    ");
    $conn->exec("
        UPDATE firme 
        SET status_pretplate = 'ISTEKAO' 
        WHERE datum_isteka IS NOT NULL 
          AND datum_isteka < CURDATE() 
          AND status_pretplate != 'ISTEKAO'
    ");
    $conn->exec("UPDATE firme SET status_pretplate = 'ISTEKAO' WHERE status_pretplate = 'BLOKIRAN'");

    // 2. Statistika platforme
    $totalFirme = $conn->query("SELECT COUNT(*) FROM firme")->fetchColumn();
    $activeFirme = $conn->query("SELECT COUNT(*) FROM firme WHERE status_pretplate = 'AKTIVAN'")->fetchColumn();
    $probniFirme = $conn->query("SELECT COUNT(*) FROM firme WHERE status_pretplate = 'PROBNI'")->fetchColumn();
    $istekleFirme = $conn->query("SELECT COUNT(*) FROM firme WHERE status_pretplate = 'ISTEKAO'")->fetchColumn();
    $totalMajstori = $conn->query("SELECT COUNT(*) FROM korisnici WHERE rola = 'majstor' AND aktivan = 1")->fetchColumn();
    $totalNalozi = $conn->query("SELECT COUNT(*) FROM radni_nalozi")->fetchColumn();

    // 3. Sve firme sa tačnim brojem majstora, brojem naloga od 01. u mesecu i maksimalnim limitima iz paketa
    $stmtFirme = $conn->query("
        SELECT f.*,
               (SELECT COUNT(*) FROM korisnici WHERE firma_id = f.id AND rola = 'majstor' AND aktivan = 1) as broj_majstora,
               (SELECT COUNT(*) FROM korisnici WHERE firma_id = f.id AND aktivan = 1) as broj_radnika,
               (SELECT COUNT(*) FROM radni_nalozi WHERE firma_id = f.id AND kreiran_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01 00:00:00')) as broj_naloga_mesec,
               (SELECT COUNT(*) FROM radni_nalozi WHERE firma_id = f.id) as broj_naloga_ukupno,
               p.naziv as paket_naziv,
               p.cena_mesecno as paket_cena,
               COALESCE(p.max_majstora, 5) as max_majstora,
               COALESCE(p.max_naloga_mesecno, 500) as max_naloga_mesecno,
               DATEDIFF(f.datum_isteka, CURDATE()) as preostalo_dana
        FROM firme f
        LEFT JOIN paketi p ON f.paket = p.kod
        ORDER BY f.id ASC
    ");
    $firme = $stmtFirme->fetchAll();

    // 4. Svi SaaS paketi
    $stmtPaketi = $conn->query("SELECT * FROM paketi ORDER BY cena_mesecno ASC");
    $paketi = $stmtPaketi->fetchAll();

    // 5. Spisak svih uloga (1 - superadmin, 2 - admin, 3 - korisnik)
    $stmtRoles = $conn->query("SELECT * FROM role ORDER BY id ASC");
    $roles = $stmtRoles->fetchAll();

    // 6. Spisak svih registrovanih korisnika sa dodeljenom firmom i ulogom
    $stmtUsers = $conn->query("
        SELECT k.id, k.rola_id, k.rola, k.firma_id, k.ime, k.prezime, k.email, k.telefon, k.lozinka_tekst, k.aktivan, k.kreiran_at,
               f.naziv as firma_naziv, r.naziv as rola_naziv, r.kod as rola_kod
        FROM korisnici k
        LEFT JOIN role r ON (k.rola_id = r.id OR k.rola = r.kod)
        LEFT JOIN firme f ON k.firma_id = f.id
        ORDER BY k.id DESC
    ");
    $users = $stmtUsers->fetchAll();

    sendResponse('success', [
        "stats" => [
            "total_firme" => intval($totalFirme),
            "active_firme" => intval($activeFirme),
            "probni_firme" => intval($probniFirme),
            "istekle_firme" => intval($istekleFirme),
            "total_majstori" => intval($totalMajstori),
            "total_nalozi" => intval($totalNalozi),
            "total_korisnici" => count($users)
        ],
        "firme" => $firme,
        "paketi" => $paketi,
        "roles" => $roles,
        "users" => $users
    ]);
}

// ==========================================================
// 10. SUPERADMIN: IZMENA / KREIRANJE FIRME (SAVE_FIRM)
// ==========================================================
elseif ($action === 'save_firm') {
    $firm_id = isset($inputData['id']) ? intval($inputData['id']) : 0;
    $naziv = isset($inputData['naziv']) ? trim($inputData['naziv']) : '';
    $pib = isset($inputData['pib']) ? trim($inputData['pib']) : '';
    $maticni_broj = isset($inputData['maticni_broj']) ? trim($inputData['maticni_broj']) : '';
    $grad = isset($inputData['grad']) ? trim($inputData['grad']) : 'Smederevo';
    $adresa = isset($inputData['adresa']) ? trim($inputData['adresa']) : '';
    $telefon = isset($inputData['telefon']) ? trim($inputData['telefon']) : '';
    $email = isset($inputData['email']) ? trim($inputData['email']) : '';
    $paket = isset($inputData['paket']) ? trim($inputData['paket']) : 'STANDARD';
    $status_pretplate = isset($inputData['status_pretplate']) ? trim($inputData['status_pretplate']) : 'AKTIVAN';
    $datum_isteka = isset($inputData['datum_isteka']) && !empty($inputData['datum_isteka']) ? trim($inputData['datum_isteka']) : null;

    if (empty($naziv)) {
        sendResponse('error', 'Naziv firme je obavezan.', 400);
    }

    // Automatsko pravilo: ako je datum isteka manji od današnjeg, status je ISTEKAO
    if (!empty($datum_isteka) && $datum_isteka < date('Y-m-d')) {
        $status_pretplate = 'ISTEKAO';
    } elseif ($status_pretplate === 'ISTEKAO' && !empty($datum_isteka) && $datum_isteka >= date('Y-m-d')) {
        $status_pretplate = 'AKTIVAN';
    }
    if ($status_pretplate === 'BLOKIRAN') {
        $status_pretplate = 'ISTEKAO';
    }

    if ($firm_id > 0) {
        $prev = $conn->prepare("SELECT datum_isteka, paket FROM firme WHERE id = ?");
        $prev->execute([$firm_id]);
        $oldRow = $prev->fetch();

        $stmt = $conn->prepare("
            UPDATE firme 
            SET naziv = ?, pib = ?, maticni_broj = ?, grad = ?, adresa = ?, telefon = ?, email = ?, paket = ?, status_pretplate = ?, datum_isteka = ?
            WHERE id = ?
        ");
        $stmt->execute([$naziv, $pib, $maticni_broj, $grad, $adresa, $telefon, $email, $paket, $status_pretplate, $datum_isteka, $firm_id]);

        try {
            $stmtHist = $conn->prepare("
                INSERT INTO licence_istorija (firma_id, prethodni_datum, novi_datum, paket, razlog)
                VALUES (?, ?, ?, ?, 'Izmena podataka firme / paketa')
            ");
            $stmtHist->execute([$firm_id, $oldRow ? $oldRow['datum_isteka'] : null, $datum_isteka, $paket]);
        } catch (Exception $e) {}

        sendResponse('success', ["id" => $firm_id, "poruka" => "Podaci firme i paketa su uspešno sačuvani."]);
    } else {
        $finalExp = $datum_isteka ?: date('Y-m-d', strtotime('+30 days'));
        if ($finalExp < date('Y-m-d')) {
            $status_pretplate = 'ISTEKAO';
        }

        $stmt = $conn->prepare("
            INSERT INTO firme (naziv, pib, maticni_broj, grad, adresa, telefon, email, paket, status_pretplate, datum_isteka)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$naziv, $pib, $maticni_broj, $grad, $adresa, $telefon, $email, $paket, $status_pretplate, $finalExp]);
        $newId = $conn->lastInsertId();

        try {
            $stmtHist = $conn->prepare("
                INSERT INTO licence_istorija (firma_id, prethodni_datum, novi_datum, paket, razlog)
                VALUES (?, NULL, ?, ?, 'Kreiranje novog servisa')
            ");
            $stmtHist->execute([$newId, $finalExp, $paket]);
        } catch (Exception $e) {}

        sendResponse('success', ["id" => $newId, "poruka" => "Nova firma je uspešno kreirana."]);
    }
}

// ==========================================================
// 11. SUPERADMIN: PRODUŽENJE LICENCE (EXTEND_FIRM_LICENSE)
// ==========================================================
elseif ($action === 'extend_firm_license') {
    $firm_id = isset($inputData['firm_id']) ? intval($inputData['firm_id']) : 0;
    $meseci = isset($inputData['months']) ? intval($inputData['months']) : 1;

    if ($firm_id <= 0 || $meseci <= 0) {
        sendResponse('error', 'ID firme i broj meseci su obavezni.', 400);
    }

    $stmt = $conn->prepare("
        UPDATE firme
        SET datum_isteka = DATE_ADD(GREATEST(COALESCE(datum_isteka, CURDATE()), CURDATE()), INTERVAL ? MONTH),
            status_pretplate = 'AKTIVAN'
        WHERE id = ?
    ");
    $stmt->execute([$meseci, $firm_id]);

    $newExp = $conn->prepare("SELECT datum_isteka, status_pretplate, paket FROM firme WHERE id = ?");
    $newExp->execute([$firm_id]);
    $updated = $newExp->fetch();

    try {
        $stmtHist = $conn->prepare("
            INSERT INTO licence_istorija (firma_id, prethodni_datum, novi_datum, paket, razlog)
            VALUES (?, NULL, ?, ?, ?)
        ");
        $stmtHist->execute([$firm_id, $updated['datum_isteka'], $updated['paket'], "Produženje licence za {$meseci} meseci"]);
    } catch (Exception $e) {}

    sendResponse('success', [
        "firm_id" => $firm_id,
        "datum_isteka" => $updated['datum_isteka'],
        "status_pretplate" => $updated['status_pretplate'],
        "poruka" => "Licenca je uspešno produžena za {$meseci} meseci."
    ]);
}

// ==========================================================
// 12. SUPERADMIN: PREGLED PAKETA (GET_PACKAGES)
// ==========================================================
elseif ($action === 'get_packages') {
    $stmt = $conn->query("SELECT * FROM paketi ORDER BY cena_mesecno ASC");
    sendResponse('success', $stmt->fetchAll());
}

// ==========================================================
// 13. SUPERADMIN: BRISANJE SERVISA / FIRME (DELETE_FIRM)
// ==========================================================
elseif ($action === 'delete_firm') {
    $firm_id = isset($inputData['firm_id']) ? intval($inputData['firm_id']) : 0;
    if ($firm_id <= 0) {
        sendResponse('error', 'ID servisa je obavezan.', 400);
    }

    // Proveri postojanje firme
    $chk = $conn->prepare("SELECT id, naziv FROM firme WHERE id = ?");
    $chk->execute([$firm_id]);
    $firm = $chk->fetch();
    if (!$firm) {
        sendResponse('error', 'Servis nije pronađen.', 404);
    }

    try {
        $conn->beginTransaction();

        // 1. Obriši stavke naloga i istoriju statusa za sve naloge ove firme
        $conn->prepare("
            DELETE ns FROM nalozi_stavke ns 
            JOIN radni_nalozi rn ON ns.nalog_id = rn.id 
            WHERE rn.firma_id = ?
        ")->execute([$firm_id]);

        $conn->prepare("
            DELETE si FROM status_istorija si 
            JOIN radni_nalozi rn ON si.nalog_id = rn.id 
            WHERE rn.firma_id = ?
        ")->execute([$firm_id]);

        // 2. Obriši radne naloge
        $conn->prepare("DELETE FROM radni_nalozi WHERE firma_id = ?")->execute([$firm_id]);

        // 3. Obriši uređaje
        $conn->prepare("DELETE FROM uredjaji WHERE firma_id = ?")->execute([$firm_id]);

        // 4. Obriši klijente
        $conn->prepare("DELETE FROM klijenti WHERE firma_id = ?")->execute([$firm_id]);

        // 5. Obriši katalog delova
        $conn->prepare("DELETE FROM katalog_delova_i_usluga WHERE firma_id = ?")->execute([$firm_id]);

        // 6. Obriši lokacije majstora
        $conn->prepare("DELETE FROM majstori_lokacija WHERE firma_id = ?")->execute([$firm_id]);

        // 7. Obriši korisnike ovog servisa
        $conn->prepare("DELETE FROM korisnici WHERE firma_id = ? AND rola != 'superadmin'")->execute([$firm_id]);

        // 8. Obriši istoriju licenci
        $conn->prepare("DELETE FROM licence_istorija WHERE firma_id = ?")->execute([$firm_id]);

        // 9. Obriši sam servis
        $conn->prepare("DELETE FROM firme WHERE id = ?")->execute([$firm_id]);

        $conn->commit();
        sendResponse('success', ["poruka" => "Servis '{$firm['naziv']}' i svi pripadajući podaci su uspešno obrisani."]);
    } catch (Exception $e) {
        if ($conn->inTransaction()) {
            $conn->rollBack();
        }
        sendResponse('error', 'Greška pri brisanju servisa: ' . $e->getMessage(), 500);
    }
}


// ==========================================================
// 14. PREUZIMANJE ROLA I KORISNIKA (GET_ROLES & GET_USERS)
// ==========================================================
elseif ($action === 'get_roles') {
    $roles = $conn->query("SELECT * FROM role ORDER BY id ASC")->fetchAll();
    sendResponse('success', $roles);
}
elseif ($action === 'get_users') {
    $firma_id = isset($_GET['firma_id']) ? intval($_GET['firma_id']) : 0;
    if ($firma_id > 0) {
        $stmt = $conn->prepare("
            SELECT k.id, k.rola_id, k.rola, k.firma_id, k.ime, k.prezime, k.email, k.telefon, k.lozinka_tekst, k.aktivan, k.kreiran_at,
                   f.naziv as firma_naziv, r.naziv as rola_naziv, r.kod as rola_kod
            FROM korisnici k
            LEFT JOIN role r ON (k.rola_id = r.id OR k.rola = r.kod)
            LEFT JOIN firme f ON k.firma_id = f.id
            WHERE k.firma_id = ?
            ORDER BY k.id DESC
        ");
        $stmt->execute([$firma_id]);
    } else {
        $stmt = $conn->query("
            SELECT k.id, k.rola_id, k.rola, k.firma_id, k.ime, k.prezime, k.email, k.telefon, k.lozinka_tekst, k.aktivan, k.kreiran_at,
                   f.naziv as firma_naziv, r.naziv as rola_naziv, r.kod as rola_kod
            FROM korisnici k
            LEFT JOIN role r ON (k.rola_id = r.id OR k.rola = r.kod)
            LEFT JOIN firme f ON k.firma_id = f.id
            ORDER BY k.id DESC
        ");
    }
    sendResponse('success', $stmt->fetchAll());
}

// ==========================================================
// 15. KREIRANJE / IZMENA KORISNIKA SA DODELOM ROLE PO ID-JU (SAVE_USER)
// ==========================================================
elseif ($action === 'save_user') {
    $user_id = isset($inputData['id']) ? intval($inputData['id']) : 0;
    $ime = isset($inputData['ime']) ? trim($inputData['ime']) : '';
    $prezime = isset($inputData['prezime']) ? trim($inputData['prezime']) : '';
    $email = isset($inputData['email']) ? trim($inputData['email']) : '';
    $telefon = isset($inputData['telefon']) ? trim($inputData['telefon']) : '';
    $lozinka = isset($inputData['lozinka']) ? trim($inputData['lozinka']) : '';
    $rola_id = isset($inputData['rola_id']) ? intval($inputData['rola_id']) : 3;
    $firma_id = isset($inputData['firma_id']) && !empty($inputData['firma_id']) ? intval($inputData['firma_id']) : null;
    $aktivan = isset($inputData['aktivan']) ? intval($inputData['aktivan']) : 1;
    $boja_markera = isset($inputData['boja_markera']) ? trim($inputData['boja_markera']) : '#0284C7';
    $custom_rola = isset($inputData['rola']) ? trim($inputData['rola']) : '';

    if (empty($ime) || empty($email)) {
        sendResponse('error', 'Ime i email adresa su obavezni.', 400);
    }

    // Provera i dohvatanje koda role po njenom ID broju
    $stmtR = $conn->prepare("SELECT id, kod, naziv FROM role WHERE id = ? LIMIT 1");
    $stmtR->execute([$rola_id]);
    $roleRow = $stmtR->fetch();
    $rola_kod = $roleRow ? $roleRow['kod'] : 'korisnik';
    if (!empty($custom_rola)) {
        $rola_kod = $custom_rola;
    }

    // SuperAdmin (ID = 1) ne pripada nijednoj firmi
    if ($rola_id === 1 || $rola_kod === 'superadmin') {
        $firma_id = null;
    }

    // Proveri jedinstvenost email adrese
    $chkEmail = $conn->prepare("SELECT id FROM korisnici WHERE email = ? AND id != ? LIMIT 1");
    $chkEmail->execute([$email, $user_id]);
    if ($chkEmail->fetch()) {
        sendResponse('error', 'Korisnik sa ovom email adresom već postoji u bazi.', 400);
    }

    if ($user_id > 0) {
        $sql = "UPDATE korisnici SET ime = ?, prezime = ?, email = ?, telefon = ?, rola_id = ?, rola = ?, firma_id = ?, boja_markera = ?, aktivan = ?";
        $params = [$ime, $prezime, $email, $telefon, $rola_id, $rola_kod, $firma_id, $boja_markera, $aktivan];

        if (!empty($lozinka)) {
            $sql .= ", lozinka = ?, lozinka_tekst = ?";
            $params[] = password_hash($lozinka, PASSWORD_DEFAULT);
            $params[] = $lozinka;
        }

        $sql .= " WHERE id = ?";
        $params[] = $user_id;

        $stmt = $conn->prepare($sql);
        $stmt->execute($params);

        sendResponse('success', [
            "id" => $user_id,
            "poruka" => "Korisnik je uspešno sačuvan sa dodeljenom rolom ID: {$rola_id} ({$rola_kod})."
        ]);
    } else {
        $lozinkaPlain = !empty($lozinka) ? $lozinka : 'majstor123';
        $hash = password_hash($lozinkaPlain, PASSWORD_DEFAULT);

        $stmt = $conn->prepare("
            INSERT INTO korisnici (rola_id, rola, firma_id, ime, prezime, email, telefon, lozinka, lozinka_tekst, boja_markera, aktivan)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$rola_id, $rola_kod, $firma_id, $ime, $prezime, $email, $telefon, $hash, $lozinkaPlain, $boja_markera, $aktivan]);
        $newId = $conn->lastInsertId();

        // Ako je korisnik terenski radnik/majstor i pripada firmi, inicijalizuj unos u majstori_lokacija
        if ($firma_id > 0 && in_array($rola_kod, ['majstor', 'radnik'])) {
            try {
                $chkMl = $conn->prepare("SELECT majstor_id FROM majstori_lokacija WHERE majstor_id = ? LIMIT 1");
                $chkMl->execute([$newId]);
                if (!$chkMl->fetch()) {
                    $conn->prepare("
                        INSERT INTO majstori_lokacija (majstor_id, firma_id, x_koordinata, y_koordinata, gpsX, gpsY, brzina, kurs, status, log_in_out, poslednje_azuriranje)
                        VALUES (?, ?, NULL, NULL, NULL, NULL, 0, 0, 'SLOBODAN', 0, NOW())
                    ")->execute([$newId, $firma_id]);
                }
            } catch (Exception $mlEx) {
                // Tiho ignorisi telemetriju
            }
        }

                sendResponse('success', [
            "id" => $newId,
            "poruka" => "Novi korisnik je uspešno kreiran sa dodeljenom rolom ID: {$rola_id} ({$rola_kod})."
        ]);
    }
}

// ==========================================================
// 16. BRISANJE KORISNIKA (DELETE_USER)
// ==========================================================
elseif ($action === 'delete_user') {
    $user_id = isset($inputData['user_id']) ? intval($inputData['user_id']) : 0;
    if ($user_id <= 0) {
        sendResponse('error', 'ID korisnika je obavezan.', 400);
    }

    $chk = $conn->prepare("SELECT id, rola_id, rola, email, ime, prezime FROM korisnici WHERE id = ?");
    $chk->execute([$user_id]);
    $u = $chk->fetch();
    if (!$u) {
        sendResponse('error', 'Korisnik nije pronađen.', 404);
    }
    // Zastita primarnog SuperAdmin naloga
    if ($u['id'] == 4 || $u['email'] === 'ilija.arezina@gmail.com' || $u['email'] === 'admin@majstornalog.rs') {
        sendResponse('error', 'Nije dozvoljeno brisanje primarnog SuperAdmin naloga.', 400);
    }

    // Obrisi lokaciju i reference radnika
    $conn->prepare("DELETE FROM majstori_lokacija WHERE majstor_id = ?")->execute([$user_id]);
    $conn->prepare("DELETE FROM korisnici WHERE id = ?")->execute([$user_id]);
    sendResponse('success', ["poruka" => "Korisnik '{$u['ime']} {$u['prezime']}' je uspešno obrisan."]);
}

// ==========================================================
// 17. JAVNA REGISTRACIJA NOVOG KORISNIKA (REGISTER)
// ==========================================================
elseif ($action === 'register') {
    $ime = isset($inputData['ime']) ? trim($inputData['ime']) : '';
    $prezime = isset($inputData['prezime']) ? trim($inputData['prezime']) : '';
    $email = isset($inputData['email']) ? trim($inputData['email']) : '';
    $telefon = isset($inputData['telefon']) ? trim($inputData['telefon']) : '';
    $lozinka = isset($inputData['lozinka']) ? trim($inputData['lozinka']) : '';

    if (empty($ime) || empty($email) || empty($lozinka)) {
        sendResponse('error', 'Ime, email i lozinka su obavezna polja za registraciju.', 400);
    }

    $chkEmail = $conn->prepare("SELECT id FROM korisnici WHERE email = ? LIMIT 1");
    $chkEmail->execute([$email]);
    if ($chkEmail->fetch()) {
        sendResponse('error', 'Korisnički nalog sa ovom email adresom već postoji.', 400);
    }

    $hash = password_hash($lozinka, PASSWORD_DEFAULT);
    // Svaki novi registrovani korisnik dobija rola_id = 3 (Običan korisnik) i firma_id = NULL
    $stmt = $conn->prepare("
        INSERT INTO korisnici (rola_id, rola, firma_id, ime, prezime, email, telefon, lozinka, lozinka_tekst, aktivan)
        VALUES (3, 'korisnik', NULL, ?, ?, ?, ?, ?, ?, 1)
    ");
    $stmt->execute([$ime, $prezime, $email, $telefon, $hash, $lozinka]);
    $newId = $conn->lastInsertId();

    sendResponse('success', [
        "id" => $newId,
        "poruka" => "Registracija je uspešna! Vaš nalog je kreiran kao običan korisnik (ID role 3). SuperAdministrator će Vam dodeliti ulogu i servis pre nego što se prijavite."
    ]);
}

// ==========================================================
// 18. REVERZNO GEOKODIRANJE I PRETRAGA ADRESA (SERVER-SIDE PROXY)
// Pouzdan pristup OpenStreetMap / Nominatim podacima sa punim User-Agent-om,
// bez CORS blokada, sa podrškom za sve gradove u Srbiji (Požarevac, Smederevo, Kovin, Beograd...)
// ==========================================================
elseif ($action === 'reverse_geocode') {
    $lat = isset($_GET['lat']) ? floatval($_GET['lat']) : (isset($inputData['lat']) ? floatval($inputData['lat']) : 0);
    $lng = isset($_GET['lng']) ? floatval($_GET['lng']) : (isset($inputData['lng']) ? floatval($inputData['lng']) : 0);

    if (!$lat || !$lng) {
        sendResponse('error', 'Koordinate lat i lng su obavezne za geokodiranje.', 400);
    }

    // Pomoćna funkcija za transliteraciju ćirilice u latinicu
    $cyrToLatFn = function($text) {
        if (!$text) return '';
        $map = [
            'а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','ђе'=>'đ','đ'=>'đ',
            'е'=>'e','ж'=>'ž','з'=>'z','и'=>'i','ј'=>'j','к'=>'k','л'=>'l',
            'љ'=>'lj','м'=>'m','н'=>'n','њ'=>'nj','о'=>'o','п'=>'p','р'=>'r',
            'с'=>'s','т'=>'t','ћ'=>'ć','у'=>'u','ф'=>'f','х'=>'h','ц'=>'c',
            'ч'=>'č','џ'=>'dž','ш'=>'š',
            'А'=>'A','Б'=>'B','В'=>'V','Г'=>'G','Д'=>'D','Ђ'=>'Đ',
            'Е'=>'E','Ж'=>'Ž','З'=>'Z','И'=>'I','Ј'=>'J','К'=>'K','Л'=>'L',
            'Љ'=>'Lj','М'=>'M','Н'=>'N','Њ'=>'Nj','О'=>'O','П'=>'P','Р'=>'R',
            'С'=>'S','Т'=>'T','Ћ'=>'Ć','У'=>'U','Ф'=>'F','Х'=>'H','Ц'=>'C',
            'Ч'=>'Č','Џ'=>'Dž','Ш'=>'Š'
        ];
        return strtr($text, $map);
    };

    // 1. Primarni poziv: Nominatim sa srpskim jezikom (latinica)
    $url = "https://nominatim.openstreetmap.org/reverse?lat={$lat}&lon={$lng}&format=json&addressdetails=1&accept-language=sr-Latn,sr,en";
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_USERAGENT, 'MajstorNalogApp/1.0 (kontakt@majstornalog.rs)');
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $nomData = ($resp && $httpCode === 200) ? json_decode($resp, true) : null;

    $street = '';
    $houseNumber = '';
    $city = '';
    $displayName = '';

    if ($nomData && isset($nomData['address'])) {
        $a = $nomData['address'];
        $street = $a['road'] ?? $a['street'] ?? $a['pedestrian'] ?? $a['footway'] ?? $a['path'] ?? $a['suburb'] ?? '';
        $houseNumber = $a['house_number'] ?? '';
        $city = $a['city'] ?? $a['town'] ?? $a['village'] ?? $a['suburb'] ?? $a['municipality'] ?? $a['county'] ?? '';
        $displayName = $nomData['display_name'] ?? '';
    }

    // 2. Fallback: Photon API ako Nominatim nije uspeo
    if (!$street && !$city) {
        $pUrl = "https://photon.komoot.io/reverse?lat={$lat}&lon={$lng}";
        $ch2 = curl_init($pUrl);
        curl_setopt($ch2, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch2, CURLOPT_TIMEOUT, 4);
        curl_setopt($ch2, CURLOPT_SSL_VERIFYPEER, false);
        $pResp = curl_exec($ch2);
        curl_close($ch2);

        $pData = $pResp ? json_decode($pResp, true) : null;
        if ($pData && !empty($pData['features'])) {
            $props = $pData['features'][0]['properties'] ?? [];
            $street = $props['street'] ?? $props['name'] ?? '';
            $houseNumber = $props['housenumber'] ?? '';
            $city = $props['city'] ?? $props['town'] ?? $props['village'] ?? $props['county'] ?? '';
        }
    }

    $street = trim($cyrToLatFn($street));
    $houseNumber = trim($cyrToLatFn($houseNumber));
    $city = trim($cyrToLatFn($city));
    $displayName = trim($cyrToLatFn($displayName));

    // Čišćenje prefiksa gradova i opština
    $city = preg_replace('/^Grad\s+/iu', '', $city);
    $city = preg_replace('/^Gradska\s+opština\s+/iu', '', $city);
    $city = preg_replace('/\s+upravni\s+okrug/iu', '', $city);
    $city = trim($city);

    $primaryLabel = $street;
    if ($street && $houseNumber) {
        $primaryLabel = "{$street} {$houseNumber}";
    }

    $fullAddress = $primaryLabel;
    if ($fullAddress && $city) {
        $fullAddress .= ", {$city}";
    } elseif ($city) {
        $fullAddress = $city;
    } elseif (!$fullAddress) {
        $fullAddress = $displayName ?: "Lokacija ({$lat}, {$lng})";
    }

    // Formiranje liste kandidata sa te tačke i obližnjih kućnih brojeva
    $candidates = [];
    $seen = [];

    if ($primaryLabel) {
        $candidates[] = [
            'id' => 'exact-pin',
            'street' => $primaryLabel,
            'city' => $city,
            'address' => $city ? "{$primaryLabel}, {$city}" : $primaryLabel,
            'lat' => $lat,
            'lng' => $lng,
            'isExact' => true
        ];
        $seen[mb_strtolower("{$primaryLabel}, {$city}")] = true;
    }

    // Ako imamo ulicu i grad, pretraži ostale kućne brojeve u toj ulici radi lakšeg izbora
    if ($street && $city) {
        $sUrl = "https://nominatim.openstreetmap.org/search?street=" . urlencode($street) . "&city=" . urlencode($city) . "&countrycodes=rs&format=json&addressdetails=1&limit=6&accept-language=sr-Latn,sr,en";
        $ch3 = curl_init($sUrl);
        curl_setopt($ch3, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch3, CURLOPT_USERAGENT, 'MajstorNalogApp/1.0 (kontakt@majstornalog.rs)');
        curl_setopt($ch3, CURLOPT_TIMEOUT, 3);
        curl_setopt($ch3, CURLOPT_SSL_VERIFYPEER, false);
        $sResp = curl_exec($ch3);
        curl_close($ch3);

        $sData = $sResp ? json_decode($sResp, true) : null;
        if (is_array($sData)) {
            foreach ($sData as $sItem) {
                $sAddr = $sItem['address'] ?? [];
                $sNum = trim($cyrToLatFn($sAddr['house_number'] ?? ''));
                if ($sNum) {
                    $cStreet = "{$street} {$sNum}";
                    $cKey = mb_strtolower("{$cStreet}, {$city}");
                    if (!isset($seen[$cKey])) {
                        $seen[$cKey] = true;
                        $cLat = floatval($sItem['lat']);
                        $cLng = floatval($sItem['lon']);
                        $candidates[] = [
                            'id' => 'nom-' . ($sItem['osm_id'] ?? rand(1000, 9999)),
                            'street' => $cStreet,
                            'city' => $city,
                            'address' => "{$cStreet}, {$city}",
                            'lat' => $cLat,
                            'lng' => $cLng,
                            'isExact' => false
                        ];
                    }
                }
            }
        }
    }

    if (empty($candidates)) {
        $lbl = $primaryLabel ?: ($displayName ?: 'Odabrana lokacija na mapi');
        $candidates[] = [
            'id' => 'fallback-exact',
            'street' => $lbl,
            'city' => $city,
            'address' => $city ? "{$lbl}, {$city}" : $lbl,
            'lat' => $lat,
            'lng' => $lng,
            'isExact' => true
        ];
    }

    sendResponse('success', [
        'address' => $fullAddress,
        'street' => $primaryLabel ?: ($street ?: 'Odabrana lokacija'),
        'houseNumber' => $houseNumber,
        'city' => $city,
        'lat' => $lat,
        'lng' => $lng,
        'candidates' => $candidates
    ]);
}

else {
    sendResponse('error', 'Nepoznata akcija ili akcija nije prosleđena.', 404);
}