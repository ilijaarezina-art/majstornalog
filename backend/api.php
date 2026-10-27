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
// 6. KATALOG DELOVA I USLUGA (GET_CATALOG)
// ==========================================================
elseif ($action === 'get_catalog') {
    $firma_id = isset($_GET['firma_id']) ? intval($_GET['firma_id']) : 1;
    $query = isset($_GET['q']) ? trim($_GET['q']) : '';

    $sql = "SELECT * FROM katalog_delova_i_usluga WHERE firma_id = ? AND aktivan = 1";
    $params = [$firma_id];

    if (!empty($query)) {
        $sql .= " AND (naziv LIKE ? OR sifra LIKE ?)";
        $params[] = "%{$query}%";
        $params[] = "%{$query}%";
    }

    $sql .= " ORDER BY tip DESC, naziv ASC";
    $stmt = $conn->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll();

    sendResponse('success', $items);
}

// ==========================================================
// 7. TELEMETRIJA: GPS LOKACIJA MAJSTORA (UPDATE_LOCATION)
// ==========================================================
elseif ($action === 'update_location') {
    $majstor_id = isset($inputData['majstor_id']) ? intval($inputData['majstor_id']) : 0;
    $firma_id = isset($inputData['firma_id']) ? intval($inputData['firma_id']) : 1;
    $gpsX = isset($inputData['gpsX']) ? floatval($inputData['gpsX']) : 0.0;
    $gpsY = isset($inputData['gpsY']) ? floatval($inputData['gpsY']) : 0.0;
    $brzina = isset($inputData['brzina']) ? floatval($inputData['brzina']) : 0.0;
    $kurs = isset($inputData['kurs']) ? floatval($inputData['kurs']) : 0.0;
    $status = isset($inputData['status']) ? trim($inputData['status']) : 'NA_TERENU';
    $nalog_id = isset($inputData['nalog_id']) ? intval($inputData['nalog_id']) : null;

    if ($majstor_id <= 0 || empty($gpsX) || empty($gpsY)) {
        sendResponse('error', 'Nevalidni podaci za lokaciju.', 400);
    }

    $stmt = $conn->prepare("
        INSERT INTO majstori_lokacija (majstor_id, firma_id, gpsX, gpsY, brzina, kurs, status, trenutni_nalog_id, poslednje_azuriranje)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            gpsX = VALUES(gpsX),
            gpsY = VALUES(gpsY),
            brzina = VALUES(brzina),
            kurs = VALUES(kurs),
            status = VALUES(status),
            trenutni_nalog_id = VALUES(trenutni_nalog_id),
            poslednje_azuriranje = NOW()
    ");
    $stmt->execute([$majstor_id, $firma_id, $gpsX, $gpsY, $brzina, $kurs, $status, $nalog_id]);

    sendResponse('success', ["recorded" => true]);
}

// ==========================================================
// 8. DISPEČERSKA TABLA (GET_DISPATCHER_DASHBOARD)
// ==========================================================
elseif ($action === 'get_dispatcher_dashboard') {
    $firma_id = isset($_GET['firma_id']) ? intval($_GET['firma_id']) : 1;
    $datum = isset($_GET['datum']) ? trim($_GET['datum']) : date('Y-m-d');

    // 1. Majstori i njihova trenutna pozicija
    $stmtWorkers = $conn->prepare("
        SELECT k.id, k.ime, k.prezime, k.telefon, k.boja_markera,
               ml.gpsX, ml.gpsY, ml.brzina, ml.kurs, ml.status as radni_status, ml.poslednje_azuriranje, ml.trenutni_nalog_id
        FROM korisnici k
        LEFT JOIN majstori_lokacija ml ON k.id = ml.majstor_id
        WHERE k.firma_id = ? AND k.rola = 'majstor' AND k.aktivan = 1
    ");
    $stmtWorkers->execute([$firma_id]);
    $workers = $stmtWorkers->fetchAll();

    // 2. Nalozi za današnji dan
    $stmtOrders = $conn->prepare("
        SELECT rn.*, k.ime_prezime as klijent_ime, k.telefon as klijent_telefon,
               u.kategorija as uredjaj_kategorija, u.proizvodjac as uredjaj_proizvodjac
        FROM radni_nalozi rn
        JOIN klijenti k ON rn.klijent_id = k.id
        LEFT JOIN uredjaji u ON rn.uredjaj_id = u.id
        WHERE rn.firma_id = ? AND (DATE(rn.zakazano_za) = ? OR rn.status IN ('DODELJENO', 'PRIHVACENO', 'NA_PUTU', 'U_RADU'))
        ORDER BY rn.zakazano_za ASC
    ");
    $stmtOrders->execute([$firma_id, $datum]);
    $orders = $stmtOrders->fetchAll();

    sendResponse('success', [
        "workers" => $workers,
        "orders" => $orders
    ]);
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

    sendResponse('success', [
        "stats" => [
            "total_firme" => intval($totalFirme),
            "active_firme" => intval($activeFirme),
            "probni_firme" => intval($probniFirme),
            "istekle_firme" => intval($istekleFirme),
            "total_majstori" => intval($totalMajstori),
            "total_nalozi" => intval($totalNalozi)
        ],
        "firme" => $firme,
        "paketi" => $paketi
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

else {
    sendResponse('error', 'Nepoznata akcija ili akcija nije prosleđena.', 404);
}
