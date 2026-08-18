<?php
require_once __DIR__ . '/../설정.php';

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            die('데이터베이스에 연결하지 못했습니다. 설정.php 의 DB 정보를 확인해 주세요.');
        }
    }
    return $pdo;
}

/** JSON 응답 후 종료 */
function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_err(string $msg, int $code = 400): void {
    json_out(['ok' => false, 'error' => $msg], $code);
}

/** 설정값 읽기 (없으면 기본값) */
function setting(string $key, ?string $default = null): ?string {
    $st = db()->prepare('SELECT v FROM settings WHERE k = ?');
    $st->execute([$key]);
    $row = $st->fetch();
    return $row ? $row['v'] : $default;
}

function setting_set(string $key, string $val): void {
    $st = db()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)');
    $st->execute([$key, $val]);
}

/* ============================================================
   조회 결과 캐시
   같은 검색을 여러 사람이 동시에 해도 DB 는 한 번만 일하게 한다.
   ============================================================ */
function cache_dir(): string {
    $dir = __DIR__ . '/../data/cache';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    return $dir;
}

function cache_get(string $key, int $ttl = 60) {
    $f = cache_dir() . '/' . sha1($key) . '.json';
    if (!is_file($f) || filemtime($f) < time() - $ttl) return null;
    $raw = @file_get_contents($f);
    return $raw === false ? null : json_decode($raw, true);
}

function cache_put(string $key, $data): void {
    $f = cache_dir() . '/' . sha1($key) . '.json';
    @file_put_contents($f, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

/** 가격표가 바뀌면 캐시를 통째로 비운다 */
function cache_clear(): void {
    foreach (glob(cache_dir() . '/*.json') ?: [] as $f) @unlink($f);
}

/* ============================================================
   가격표 전체를 정적 파일 하나로 만들어 둔다.
   방문자는 이 파일만 받아가고, 검색·필터는 브라우저에서 처리한다.
   → 사람이 아무리 몰려도 서버는 파일 하나만 내주면 된다.
   ============================================================ */
function rebuild_static(): void {
    $st = db()->query(
        'SELECT brand, model, product, size, spec, season, price
           FROM tires WHERE visible = 1 ORDER BY price ASC, id ASC'
    );

    // 자리를 아끼려고 배열로 줄여서 담는다
    $rows = [];
    foreach ($st as $r) {
        $rows[] = [
            $r['brand'], $r['model'], $r['product'], $r['size'],
            $r['spec'], $r['season'], (int)$r['price'],
        ];
    }

    $payload = [
        'f'  => ['brand', 'model', 'product', 'size', 'spec', 'season', 'price'],
        'at' => date('Y-m-d H:i'),
        'n'  => count($rows),
        'd'  => $rows,
    ];

    $dir = __DIR__ . '/../assets';
    if (!is_dir($dir)) @mkdir($dir, 0755, true);

    // 쓰는 도중에 방문자가 반쪽짜리 파일을 받지 않도록 임시로 쓰고 바꿔치기한다
    $tmp = $dir . '/price.json.tmp';
    @file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_UNICODE), LOCK_EX);
    @rename($tmp, $dir . '/price.json');
}

/** 올린 파일이 기존과 무엇이 다른지 센다 */
function diff_counts(array $oldRows, array $newRows): array {
    $key = fn($r) => ($r['model'] ?? '') . '|' . ($r['size'] ?? '') . '|' . ($r['spec'] ?? '');
    $old = [];
    foreach ($oldRows as $r) $old[$key($r)] = (int)$r['price'];

    $added = 0; $changed = 0; $same = 0; $hit = [];
    foreach ($newRows as $r) {
        $k = $key($r);
        if (!array_key_exists($k, $old)) { $added++; continue; }
        $hit[$k] = true;
        if ($old[$k] === (int)$r['price']) $same++; else $changed++;
    }
    $gone = count($old) - count($hit);

    return ['added' => $added, 'changed' => $changed, 'same' => $same, 'gone' => $gone];
}
