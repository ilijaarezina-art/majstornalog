<?php
// ========================================================
// CONFIG.PHP — BAZA PODATAKA (AUTO-DETECT: LOKALNO / LIVE CPANEL)
// ========================================================

$isLocal = in_array($_SERVER['HTTP_HOST'] ?? '', ['localhost', '127.0.0.1']) 
           || (php_sapi_name() === 'cli' && empty($_SERVER['HTTP_HOST']));

if ($isLocal) {
    // Lokalno XAMPP okruženje
    define('DB_HOST', '127.0.0.1');
    define('DB_PORT', '3306');
    define('DB_NAME', 'majstornalog');
    define('DB_USER', 'root');
    define('DB_PASS', '');
} else {
    // Produkcija — Live cPanel server (isti server kao ZapišiTo na bookmymusic.rs)
    define('DB_HOST', 'localhost');
    define('DB_PORT', '3306');
    define('DB_NAME', 'bookmymurs_majstornalog');
    define('DB_USER', 'bookmymurs_ilija');
    define('DB_PASS', 'Stefan5656!');
}

// CORS zaglavlja za mobilnu i web aplikaciju
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

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
