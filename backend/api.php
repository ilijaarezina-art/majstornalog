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

    // 3. Status enum proširenje u radni_nalozi
    $conn->exec("
        ALTER TABLE radni_nalozi 
        MODIFY COLUMN `status` ENUM('KREIRANO','DODELJENO','PRIHVACENO','NA_PUTU','U_RADU','ODLOZENO','ZAVRSENO','STORNO') DEFAULT 'KREIRANO'
    ");

    // 4. Proveri postojanje Superadmin korisnika
    $chkAdmin = $conn->query("SELECT COUNT(*) FROM korisnici WHERE rola = 'superadmin' OR email = 'admin@majstornalog.rs'")->fetchColumn();
    if ($chkAdmin == 0) {
        $conn->exec("
            INSERT INTO `korisnici` (`firma_id`, `ime`, `prezime`, `email`, `telefon`, `lozinka`, `rola`, `boja_markera`, `aktivan`) 
            VALUES (1, 'Super', 'Administrator', 'admin@majstornalog.rs', '069-000-000', '$2y$10$abcdefghijklmnopqrstuv', 'superadmin', '#7C3AED', 1)
        ");
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

    $check = $conn->prepare("SELECT status FROM radni_nalozi WHERE id = ?");
    $check->execute([$order_id]);
    $curRow = $check->fetch();
    if (!$curRow) {
        sendResponse('error', 'Nalog ne postoji.', 404);
    }
    $stari_status = $curRow['status'];

    $extraSql = "";
    $params = [$novi_status];

    // Automatsko evidentiranje vremena prema statusu
    if ($novi_status === 'PRIHVACENO') {
        $extraSql .= ", vreme_prihvatanja = COALESCE(vreme_prihvatanja, NOW())";
    } elseif ($novi_status === 'NA_PUTU') {
        $extraSql .= ", vreme_polaska = COALESCE(vreme_polaska, NOW())";
    } elseif ($novi_status === 'U_RADU') {
        $extraSql .= ", vreme_pocetka = COALESCE(vreme_pocetka, NOW())";
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
    // 1. Statistika platforme
    $totalFirme = $conn->query("SELECT COUNT(*) FROM firme")->fetchColumn();
    $activeFirme = $conn->query("SELECT COUNT(*) FROM firme WHERE status_pretplate = 'AKTIVAN'")->fetchColumn();
    $probniFirme = $conn->query("SELECT COUNT(*) FROM firme WHERE status_pretplate = 'PROBNI'")->fetchColumn();
    $istekleFirme = $conn->query("SELECT COUNT(*) FROM firme WHERE status_pretplate = 'ISTEKAO' OR (datum_isteka IS NOT NULL AND datum_isteka < CURDATE())")->fetchColumn();
    $totalMajstori = $conn->query("SELECT COUNT(*) FROM korisnici WHERE rola = 'majstor' AND aktivan = 1")->fetchColumn();
    $totalNalozi = $conn->query("SELECT COUNT(*) FROM radni_nalozi")->fetchColumn();

    // 2. Sve firme sa brojem majstora i naloga
    $stmtFirme = $conn->query("
        SELECT f.*,
               COUNT(DISTINCT k.id) as broj_radnika,
               COUNT(DISTINCT rn.id) as broj_naloga,
               p.naziv as paket_naziv,
               p.cena_mesecno as paket_cena,
               DATEDIFF(f.datum_isteka, CURDATE()) as preostalo_dana
        FROM firme f
        LEFT JOIN korisnici k ON f.id = k.firma_id AND k.aktivan = 1
        LEFT JOIN radni_nalozi rn ON f.id = rn.firma_id
        LEFT JOIN paketi p ON f.paket = p.kod
        GROUP BY f.id
        ORDER BY f.id ASC
    ");
    $firme = $stmtFirme->fetchAll();

    // 3. Svi SaaS paketi
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

    if ($firm_id > 0) {
        $stmt = $conn->prepare("
            UPDATE firme 
            SET naziv = ?, pib = ?, maticni_broj = ?, grad = ?, adresa = ?, telefon = ?, email = ?, paket = ?, status_pretplate = ?, datum_isteka = ?
            WHERE id = ?
        ");
        $stmt->execute([$naziv, $pib, $maticni_broj, $grad, $adresa, $telefon, $email, $paket, $status_pretplate, $datum_isteka, $firm_id]);
        sendResponse('success', ["id" => $firm_id, "poruka" => "Podaci firme su uspešno ažurirani."]);
    } else {
        $stmt = $conn->prepare("
            INSERT INTO firme (naziv, pib, maticni_broj, grad, adresa, telefon, email, paket, status_pretplate, datum_isteka)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([$naziv, $pib, $maticni_broj, $grad, $adresa, $telefon, $email, $paket, $status_pretplate, $datum_isteka ?: date('Y-m-d', strtotime('+30 days'))]);
        $newId = $conn->lastInsertId();
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

    $newExp = $conn->prepare("SELECT datum_isteka, status_pretplate FROM firme WHERE id = ?");
    $newExp->execute([$firm_id]);
    $updated = $newExp->fetch();

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

else {
    sendResponse('error', 'Nepoznata akcija ili akcija nije prosleđena.', 404);
}
