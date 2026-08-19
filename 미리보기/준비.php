<?php
/* ============================================================
   내 컴퓨터에서 사이트를 띄워보기 위한 준비 —  MySQL 없이 SQLite 로 돌린다.
   실제 서버(가비아 · MySQL)와는 아무 상관이 없는 파일이다.

     php 준비.php                     ← 예시 가격표를 넣는다
     php 준비.php "C:\경로\가격표.xlsx" 넥센
     php 준비.php --비우기             ← 데이터베이스를 지우고 처음부터

   표 구조는 설치/schema.sql 과 같아야 한다. 한쪽만 고치지 말 것.
   ============================================================ */

if (PHP_SAPI !== 'cli') { http_response_code(403); die('명령창에서만 실행합니다.'); }

$뿌리   = dirname(__DIR__);
$웹     = $뿌리 . '/웹';
$디비파일 = __DIR__ . '/미리보기.sqlite';

/* 1. 미리보기용 설정 파일 — 없으면 만든다 (git 에 올라가지 않는다) */
$설정로컬 = $웹 . '/설정.local.php';
if (!is_file($설정로컬)) {
    $내용 = "<?php\n"
          . "/* 내 컴퓨터에서 미리보기로 띄울 때만 쓰는 값 — git 에 올라가지 않습니다.\n"
          . "   미리보기/준비.php 가 만들었습니다. 지워도 다시 만들어집니다. */\n"
          . "define('DB_HOST', 'sqlite');\n"
          . "define('DB_NAME', " . var_export(str_replace('\\', '/', $디비파일), true) . ");\n";
    file_put_contents($설정로컬, str_replace("\n", "\r\n", $내용));
    echo "설정.local.php 를 만들었습니다.\n";
}

if (in_array('--비우기', $argv, true)) {
    foreach ([$디비파일, $디비파일 . '-wal', $디비파일 . '-shm', $웹 . '/assets/price.json'] as $f) {
        if (is_file($f)) { unlink($f); echo "지웠습니다 : " . basename($f) . "\n"; }
    }
}

require_once $웹 . '/lib/db.php';
require_once $웹 . '/lib/sheet.php';
require_once $웹 . '/lib/parse.php';

if (!db_is_sqlite()) {
    die("설정.local.php 가 SQLite 를 가리키고 있지 않습니다. 그 파일을 지우고 다시 실행하세요.\n");
}

/* 2. 표 만들기 — 설치/schema.sql 을 SQLite 말로 옮긴 것 */
db()->exec("
CREATE TABLE IF NOT EXISTS tires (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  brand      TEXT    NOT NULL,
  model      TEXT    NOT NULL DEFAULT '',
  product    TEXT    NOT NULL DEFAULT '',
  size       TEXT    NOT NULL,
  spec       TEXT    NOT NULL DEFAULT '',
  season     TEXT    NOT NULL DEFAULT '',
  price      INTEGER NOT NULL DEFAULT 0,
  width      INTEGER, aspect INTEGER, inch INTEGER,
  visible    INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_brand       ON tires (brand);
CREATE INDEX IF NOT EXISTS idx_size        ON tires (size);
CREATE INDEX IF NOT EXISTS idx_price       ON tires (price);
CREATE INDEX IF NOT EXISTS idx_season      ON tires (season);
CREATE INDEX IF NOT EXISTS idx_spec3       ON tires (width, aspect, inch, price);
CREATE INDEX IF NOT EXISTS idx_inch        ON tires (inch, price);
CREATE INDEX IF NOT EXISTS idx_model       ON tires (model);
CREATE INDEX IF NOT EXISTS idx_product     ON tires (product);
CREATE INDEX IF NOT EXISTS idx_brand_price ON tires (brand, price);

CREATE TABLE IF NOT EXISTS uploads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  brand       TEXT    NOT NULL,
  filename    TEXT    NOT NULL,
  row_count   INTEGER NOT NULL DEFAULT 0,
  uploaded_at TEXT    NOT NULL,
  backup      TEXT,
  restored    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_when ON uploads (uploaded_at);

CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS brands (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL UNIQUE,
  sort_no INTEGER NOT NULL DEFAULT 0
);
");

$기본제조사 = ['한국' => 1, '금호' => 2, '넥센' => 3, '미쉐린' => 4, '콘티넨탈' => 5,
              '브리지스톤' => 6, '피렐리' => 7, '던롭' => 8, '굿이어' => 9, '요코하마' => 10];
$ins = db()->prepare(sql_insert_ignore() . ' brands (name, sort_no) VALUES (?, ?)');
foreach ($기본제조사 as $이름 => $순서) $ins->execute([$이름, $순서]);

/* 3. 가격표 넣기 */
$인자 = array_values(array_filter(array_slice($argv, 1), fn($a) => substr($a, 0, 2) !== '--'));
$파일 = $인자[0] ?? ($뿌리 . '/자료/예시_넥센가격표.xlsx');

if (!is_file($파일)) {
    echo "가격표 파일이 없어 표만 만들었습니다 : $파일\n";
    exit;
}

$이름 = basename($파일);
$제조사 = $인자[1] ?? '';
if ($제조사 === '') {                       // 파일 이름에 제조사가 들어 있으면 그것으로
    foreach (array_keys($기본제조사) as $b) if (mb_strpos($이름, $b) !== false) { $제조사 = $b; break; }
}
if ($제조사 === '') $제조사 = '넥센';

$rows   = read_table($파일, $이름);
$parsed = parse_rows($rows, $제조사);
$items  = $parsed['items'];

$pdo = db();
$pdo->beginTransaction();
$pdo->prepare('DELETE FROM tires WHERE brand = ?')->execute([$제조사]);
$지금 = date('Y-m-d H:i:s');
$넣기 = $pdo->prepare(
    'INSERT INTO tires (brand, model, product, size, spec, season, price, width, aspect, inch, visible, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)'
);
foreach ($items as $it) {
    $넣기->execute([$it['brand'], $it['model'], $it['product'], $it['size'], $it['spec'],
                   $it['season'], $it['price'], $it['width'], $it['aspect'], $it['inch'], $지금]);
}
$pdo->prepare('INSERT INTO uploads (brand, filename, row_count, uploaded_at, backup) VALUES (?, ?, ?, ?, ?)')
    ->execute([$제조사, $이름, count($items), $지금, null]);
$pdo->commit();

cache_clear();
rebuild_static();

$남김 = count($parsed['skipped']);
echo "넣었습니다 : {$제조사} " . count($items) . "개 품목" . ($남김 ? " (못 읽은 줄 {$남김}개)" : "") . "\n";
echo "전체 품목  : " . (int)db()->query('SELECT COUNT(*) FROM tires WHERE visible = 1')->fetchColumn() . "\n";
