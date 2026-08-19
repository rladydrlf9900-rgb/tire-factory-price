<?php
require_once __DIR__ . '/../설정.php';

/** 내 컴퓨터에서 미리보기로 띄운 상태인가 (DB_HOST 가 'sqlite' 면 DB_NAME 이 파일 경로다) */
function db_is_sqlite(): bool {
    return strtolower(DB_HOST) === 'sqlite';
}

function db(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $lite = db_is_sqlite();
        $dsn  = $lite ? 'sqlite:' . DB_NAME
                      : 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
        try {
            $pdo = new PDO($dsn, $lite ? null : DB_USER, $lite ? null : DB_PASS, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
            ]);
            if ($lite) {
                // SQLite 에는 MySQL 의 FIELD() 가 없다 — 계절 정렬이 같은 순서로 나오게 직접 만든다
                $pdo->sqliteCreateFunction('FIELD', function (...$a) {
                    $v = array_shift($a);
                    foreach ($a as $i => $x) if ((string)$x === (string)$v) return $i + 1;
                    return 0;                       // 목록에 없으면 0 — MySQL 과 같다
                });
            }
        } catch (PDOException $e) {
            http_response_code(500);
            die('데이터베이스에 연결하지 못했습니다. 설정.php 의 DB 정보를 확인해 주세요.');
        }
    }
    return $pdo;
}

/** 이미 있으면 그냥 넘어가는 INSERT — MySQL 과 SQLite 의 표기가 다르다 */
function sql_insert_ignore(): string {
    return db_is_sqlite() ? 'INSERT OR IGNORE INTO' : 'INSERT IGNORE INTO';
}

/** JSON 응답 후 종료 */
function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');

    /* 파일명 같은 데 글자가 깨져 있으면 json_encode 가 통째로 실패해서
       빈 응답이 나가고, 관리자 화면이 아무것도 못 그린다.
       깨진 글자는 물음표로 바꿔 넣고, 그래도 안 되면 이유를 알려준다. */
    $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false) {
        $json = json_encode(['ok' => false, 'error' => '자료에 읽을 수 없는 글자가 있습니다.']);
    }
    echo $json;
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
    $sql = db_is_sqlite()
        ? 'INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v'
        : 'INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)';
    $st = db()->prepare($sql);
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

    /* 글자가 깨진 칸이 하나라도 있으면 json_encode 가 통째로 실패한다.
       그대로 두면 빈 파일이 덮어써져 사이트에서 상품이 몽땅 사라진다.
       깨진 글자는 물음표로 바꿔 넣고, 그래도 안 되면 기존 파일을 건드리지 않는다. */
    $json = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    if ($json === false || $json === '') return;

    // 쓰는 도중에 방문자가 반쪽짜리 파일을 받지 않도록 임시로 쓰고 바꿔치기한다
    $tmp = $dir . '/price.json.tmp';
    if (@file_put_contents($tmp, $json, LOCK_EX) === false) return;
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
