<?php
/**
 * ==========================================================
 * MajstorNalog - REST API Backend
 * Multi-tenant sistem za terenske radne naloge
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

// ----------------------------------------------------------
// 1. Prijava na sistem (LOGIN)
// ----------------------------------------------------------
if ($action === 'login') {
    $email = isset($inputData['email']) ? trim($inputData['email']) : '';
    $password = isset($inputData['password']) ? trim($inputData['password']) : '';

    if (empty($email) || empty($password)) {
        sendResponse('error', 'Email i lozinka su obavezni.', 400);
    }

    $stmt = $conn->prepare("
        SELECT k.*, f.naziv as firma_naziv, f.pib as firma_pib, f.logo_url as firma_logo, f.status_pretplate
        FROM korisnici k
        JOIN firme f ON k.firma_id = f.id
        WHERE k.email = ? AND k.aktivan = 1
        LIMIT 1
    ");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    // Za razvoj / demo: podržano poređenje sa hešom ili demo lozinkom 'majstor123' / 'admin123'
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

// ----------------------------------------------------------
// 2. Moji radni nalozi za danas (za majstora na terenu)
// ----------------------------------------------------------
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
          AND (DATE(rn.zakazano_za) = ? OR rn.status IN ('NA_PUTU', 'U_RADU'))
        ORDER BY 
            CASE rn.status
                WHEN 'U_RADU' THEN 1
                WHEN 'NA_PUTU' THEN 2
                WHEN 'DODELJENO' THEN 3
                WHEN 'ZAVRSENO' THEN 4
                ELSE 5
            END,
            rn.zakazano_za ASC
    ");
    $stmt->execute([$majstor_id, $datum]);
    $orders = $stmt->fetchAll();

    sendResponse('success', $orders);
}

// ----------------------------------------------------------
// 3. Detalji jednog radnog naloga sa stavkama
// ----------------------------------------------------------
elseif ($action === 'get_order_details') {
    $order_id = isset($_GET['order_id']) ? intval($_GET['order_id']) : 0;

    if ($order_id <= 0) {
        sendResponse('error', 'ID naloga je obavezan.', 400);
    }

    $stmt = $conn->prepare("
        SELECT rn.*, 
               k.ime_prezime as klijent_ime, k.telefon as klijent_telefon, k.sprat_stan, k.grad as klijent_grad,
               u.kategorija as uredjaj_kategorija, u.proizvodjac as uredjaj_proizvodjac, u.model as uredjaj_model, u.serijski_broj as uredjaj_sn
        FROM radni_nalozi rn
        JOIN klijenti k ON rn.klijent_id = k.id
        LEFT JOIN uredjaji u ON rn.uredjaj_id = u.id
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

    sendResponse('success', $order);
}

// ----------------------------------------------------------
// 4. Promena statusa naloga (KRENUO / NA_PUTU, STIGAO / U_RADU)
// ----------------------------------------------------------
elseif ($action === 'update_order_status') {
    $order_id = isset($inputData['order_id']) ? intval($inputData['order_id']) : 0;
    $novi_status = isset($inputData['status']) ? trim($inputData['status']) : '';
    $majstor_id = isset($inputData['majstor_id']) ? intval($inputData['majstor_id']) : null;
    $komentar = isset($inputData['komentar']) ? trim($inputData['komentar']) : '';

    if ($order_id <= 0 || empty($novi_status)) {
        sendResponse('error', 'ID naloga i novi status su obavezni.', 400);
    }

    // Provera postojećeg statusa
    $check = $conn->prepare("SELECT status FROM radni_nalozi WHERE id = ?");
    $check->execute([$order_id]);
    $curRow = $check->fetch();
    if (!$curRow) {
        sendResponse('error', 'Nalog ne postoji.', 404);
    }
    $stari_status = $curRow['status'];

    $extraSql = "";
    $params = [$novi_status];

    if ($novi_status === 'U_RADU' && $stari_status !== 'U_RADU') {
        $extraSql .= ", vreme_pocetka = NOW()";
    }

    $params[] = $order_id;
    $stmt = $conn->prepare("UPDATE radni_nalozi SET status = ? {$extraSql}, poslednja_promena = NOW() WHERE id = ?");
    $stmt->execute($params);

    // Zapis u audit istoriju
    $logStmt = $conn->prepare("INSERT INTO status_istorija (nalog_id, prethodni_status, novi_status, promenio_id, komentar) VALUES (?, ?, ?, ?, ?)");
    $logStmt->execute([$order_id, $stari_status, $novi_status, $majstor_id, $komentar]);

    sendResponse('success', [
        "order_id" => $order_id,
        "prethodni_status" => $stari_status,
        "novi_status" => $novi_status
    ]);
}

// ----------------------------------------------------------
// 5. Završetak radnog naloga (Materijal, potpis, slike, cena)
// ----------------------------------------------------------
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
        $logStmt = $conn->prepare("INSERT INTO status_istorija (nalog_id, prethodni_status, novi_status, promenio_id, komentar) VALUES (?, 'U_RADU', 'ZAVRSENO', ?, 'Završena intervencija i preuzet potpis')");
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

// ----------------------------------------------------------
// 6. Katalog delova i usluga (za brzo dodavanje na terenu)
// ----------------------------------------------------------
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

// ----------------------------------------------------------
// 7. Telemetrija: Slanje GPS lokacije majstora u realnom vremenu
// ----------------------------------------------------------
elseif ($action === 'update_location') {
    $majstor_id = isset($inputData['majstor_id']) ? intval($inputData['majstor_id']) : 0;
    $firma_id = isset($inputData['firma_id']) ? intval($inputData['firma_id']) : 1;
    $gpsX = isset($inputData['gpsX']) ? floatval($inputData['gpsX']) : 0.0;
    $gpsY = isset($inputData['gpsY']) ? floatval($inputData['gpsY']) : 0.0;
    $brzina = isset($inputData['brzina']) ? floatval($inputData['brzina']) : 0.0;
    $kurs = isset($inputData['kurs']) ? floatval($inputData['kurs']) : 0.0;
    $baterija = isset($inputData['baterija']) ? intval($inputData['baterija']) : null;
    $status = isset($inputData['status']) ? trim($inputData['status']) : 'NA_TERENU';
    $nalog_id = isset($inputData['nalog_id']) ? intval($inputData['nalog_id']) : null;

    if ($majstor_id <= 0 || empty($gpsX) || empty($gpsY)) {
        sendResponse('error', 'Nevalidni podaci za lokaciju.', 400);
    }

    $stmt = $conn->prepare("
        INSERT INTO majstori_lokacija (majstor_id, firma_id, gpsX, gpsY, brzina, kurs, baterija, status, trenutni_nalog_id, poslednja_promena)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
            gpsX = VALUES(gpsX),
            gpsY = VALUES(gpsY),
            brzina = VALUES(brzina),
            kurs = VALUES(kurs),
            baterija = VALUES(baterija),
            status = VALUES(status),
            trenutni_nalog_id = VALUES(trenutni_nalog_id),
            poslednja_promena = NOW()
    ");
    $stmt->execute([$majstor_id, $firma_id, $gpsX, $gpsY, $brzina, $kurs, $baterija, $status, $nalog_id]);

    sendResponse('success', ["recorded" => true]);
}

// ----------------------------------------------------------
// 8. Dispečerska tabla (Uživo majstori + nalozi za mapu)
// ----------------------------------------------------------
elseif ($action === 'get_dispatcher_dashboard') {
    $firma_id = isset($_GET['firma_id']) ? intval($_GET['firma_id']) : 1;
    $datum = isset($_GET['datum']) ? trim($_GET['datum']) : date('Y-m-d');

    // 1. Majstori i njihova trenutna pozicija
    $stmtWorkers = $conn->prepare("
        SELECT k.id, k.ime, k.prezime, k.telefon, k.boja_markera,
               ml.gpsX, ml.gpsY, ml.brzina, ml.kurs, ml.baterija, ml.status as radni_status, ml.poslednja_promena, ml.trenutni_nalog_id
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
        WHERE rn.firma_id = ? AND (DATE(rn.zakazano_za) = ? OR rn.status IN ('DODELJENO', 'NA_PUTU', 'U_RADU'))
        ORDER BY rn.zakazano_za ASC
    ");
    $stmtOrders->execute([$firma_id, $datum]);
    $orders = $stmtOrders->fetchAll();

    sendResponse('success', [
        "workers" => $workers,
        "orders" => $orders
    ]);
}

else {
    sendResponse('error', 'Nepoznata akcija ili akcija nije prosleđena.', 404);
}
