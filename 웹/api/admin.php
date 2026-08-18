<?php
/* 관리자용 — 로그인, 제조사별 현황, 업로드, 되돌리기, 비밀번호 변경 */
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/sheet.php';
require_once __DIR__ . '/../lib/parse.php';

$action = (string)($_REQUEST['action'] ?? '');

/* ── 로그인 ─────────────────────────────────────────── */
if ($action === 'login') {
    if (login_blocked()) {
        json_err('비밀번호를 여러 번 틀렸습니다. 10분 뒤에 다시 시도해 주세요.', 429);
    }
    $pw = (string)($_POST['password'] ?? '');
    if (admin_login($pw)) {
        login_ok_reset();
        json_out(['ok' => true]);
    }
    login_failed();
    json_err('비밀번호가 맞지 않습니다.', 401);
}

if ($action === 'logout') {
    admin_logout();
    json_out(['ok' => true]);
}

if ($action === 'check') {
    json_out(['ok' => true, 'admin' => is_admin()]);
}

/* 여기부터는 관리자만 */
require_admin();

/* ── 제조사별 현황 (관리자 화면의 박스) ────────────────── */
if ($action === 'status') {
    $brands = db()->query('SELECT name FROM brands ORDER BY sort_no ASC, name ASC')
                  ->fetchAll(PDO::FETCH_COLUMN);

    $last = [];
    $st = db()->query(
        'SELECT u1.brand, u1.filename, u1.uploaded_at, u1.row_count
           FROM uploads u1
           JOIN (SELECT brand, MAX(id) AS mid FROM uploads GROUP BY brand) u2
             ON u1.id = u2.mid'
    );
    foreach ($st as $r) $last[$r['brand']] = $r;

    $counts = [];
    foreach (db()->query('SELECT brand, COUNT(*) c FROM tires GROUP BY brand') as $r) {
        $counts[$r['brand']] = (int)$r['c'];
    }

    $out = [];
    foreach ($brands as $b) {
        $l = $last[$b] ?? null;
        $days = null;
        if ($l) {
            $days = (int)floor((time() - strtotime($l['uploaded_at'])) / 86400);
        }
        $out[] = [
            'brand'    => $b,
            'filename' => $l['filename'] ?? '',
            'when'     => $l['uploaded_at'] ?? '',
            'days'     => $days,
            'rows'     => $counts[$b] ?? 0,
        ];
    }

    $history = db()->query(
        'SELECT id, brand, filename, row_count, uploaded_at, restored
           FROM uploads ORDER BY id DESC LIMIT 20'
    )->fetchAll();

    json_out(['ok' => true, 'brands' => $out, 'history' => $history]);
}

/* ── 큰 파일을 조각내서 받기 ────────────────────────────
   호스팅의 업로드 용량 제한(보통 2~8MB)에 걸리지 않도록
   브라우저가 1MB씩 잘라 보내면 여기서 이어붙인다.            */
if ($action === 'chunk') {
    $key   = preg_replace('/[^a-zA-Z0-9]/', '', (string)($_POST['key'] ?? ''));
    $index = (int)($_POST['index'] ?? 0);
    if ($key === '' || strlen($key) > 40) json_err('업로드 번호가 올바르지 않습니다.');

    if (!isset($_FILES['blob']) || $_FILES['blob']['error'] !== UPLOAD_ERR_OK) {
        json_err('조각이 제대로 올라오지 않았습니다.');
    }

    $dir = __DIR__ . '/../data/tmp';
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) json_err('임시 폴더를 만들지 못했습니다. data 폴더 권한을 확인하세요.');

    $path = $dir . '/' . $key . '.part';
    if ($index === 0) @unlink($path);                 // 첫 조각이면 새로 시작

    $in = fopen($_FILES['blob']['tmp_name'], 'rb');
    $out = fopen($path, 'ab');
    if (!$in || !$out) json_err('임시 파일을 열지 못했습니다.');
    if (!flock($out, LOCK_EX)) json_err('임시 파일이 사용 중입니다.');
    stream_copy_to_stream($in, $out);
    flock($out, LOCK_UN);
    fclose($in); fclose($out);

    // 오래된 찌꺼기 청소 (1시간 지난 것)
    foreach (glob($dir . '/*.part') ?: [] as $old) {
        if (filemtime($old) < time() - 3600) @unlink($old);
    }

    json_out(['ok' => true, 'size' => filesize($path)]);
}

/* ── 가격표 반영 ───────────────────────────────────────── */
if ($action === 'upload') {
    $brand = trim((string)($_POST['brand'] ?? ''));
    if ($brand === '') json_err('어느 제조사인지 알 수 없습니다.');

    $name    = trim((string)($_POST['filename'] ?? ''));
    $tmpKey  = preg_replace('/[^a-zA-Z0-9]/', '', (string)($_POST['key'] ?? ''));
    $partial = null;

    if ($tmpKey !== '') {
        // 조각내서 올린 경우
        $partial = __DIR__ . '/../data/tmp/' . $tmpKey . '.part';
        if (!is_file($partial)) json_err('올라온 파일을 찾지 못했습니다. 다시 올려주세요.');
        $tmp = $partial;
        if ($name === '') $name = 'upload.xlsx';
    } else {
        // 한 번에 올린 경우
        if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
            $code = $_FILES['file']['error'] ?? -1;
            $msg = ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE)
                 ? '파일이 너무 큽니다. 잠시 후 다시 시도하면 조각내어 올립니다.'
                 : '파일이 제대로 올라오지 않았습니다.';
            json_err($msg);
        }
        $tmp  = $_FILES['file']['tmp_name'];
        $name = $_FILES['file']['name'];
    }

    try {
        $rows   = read_table($tmp, $name);
        $parsed = parse_rows($rows, $brand);
    } catch (Throwable $e) {
        if ($partial) @unlink($partial);
        json_err($e->getMessage());
    }

    $items = $parsed['items'];

    $pdo = db();
    $pdo->beginTransaction();
    try {
        // 되돌리기용으로 기존 내용을 담아두고, 무엇이 달라지는지도 센다
        $old = $pdo->prepare('SELECT brand, model, product, size, spec, season, price, width, aspect, inch, visible, updated_at FROM tires WHERE brand = ?');
        $old->execute([$brand]);
        $oldRows = $old->fetchAll();
        $backup  = json_encode($oldRows, JSON_UNESCAPED_UNICODE);
        $diff    = diff_counts($oldRows, $items);

        $pdo->prepare('DELETE FROM tires WHERE brand = ?')->execute([$brand]);

        /* 한 줄씩 넣으면 10,000행에 수십 초가 걸린다.
           500줄씩 묶어서 한 번에 넣으면 수십 배 빨라진다. */
        $now  = date('Y-m-d H:i:s');
        $cols = 'INSERT INTO tires (brand, model, product, size, spec, season, price, width, aspect, inch, visible, updated_at) VALUES ';
        $step = 500;
        for ($i = 0, $n = count($items); $i < $n; $i += $step) {
            $slice = array_slice($items, $i, $step);
            $vals  = [];
            foreach ($slice as $it) {
                array_push($vals,
                    $it['brand'], $it['model'], $it['product'], $it['size'], $it['spec'],
                    $it['season'], $it['price'], $it['width'], $it['aspect'], $it['inch'], $now
                );
            }
            $ph = implode(',', array_fill(0, count($slice), '(?,?,?,?,?,?,?,?,?,?,1,?)'));
            $pdo->prepare($cols . $ph)->execute($vals);
        }

        $log = $pdo->prepare('INSERT INTO uploads (brand, filename, row_count, uploaded_at, backup) VALUES (?, ?, ?, ?, ?)');
        $log->execute([$brand, mb_substr($name, 0, 255), count($items), $now, $backup]);
        $uploadId = (int)$pdo->lastInsertId();

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        if ($partial) @unlink($partial);
        json_err('저장 중 문제가 생겨 되돌렸습니다. 기존 가격표는 그대로입니다.');
    }

    // 올린 원본을 그대로 보관해 두면 나중에 다시 받을 수 있다
    $keepDir = __DIR__ . '/../data/files';
    if (!is_dir($keepDir)) @mkdir($keepDir, 0755, true);
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if ($ext !== 'xlsx' && $ext !== 'csv') $ext = 'dat';
    @copy($tmp, $keepDir . '/' . $uploadId . '.' . $ext);
    if ($partial) @unlink($partial);

    cache_clear();
    rebuild_static();

    json_out([
        'ok'      => true,
        'brand'   => $brand,
        'saved'   => count($items),
        'skipped' => $parsed['skipped'],
        'diff'    => $diff,
        'when'    => date('Y-m-d H:i'),
        'file'    => $name,
    ]);
}

/* ── 올렸던 원본 파일 다시 받기 ────────────────────────── */
if ($action === 'download') {
    $id = (int)($_GET['id'] ?? 0);
    $st = db()->prepare('SELECT filename FROM uploads WHERE id = ?');
    $st->execute([$id]);
    $up = $st->fetch();
    if (!$up) json_err('그런 기록이 없습니다.', 404);

    $dir = __DIR__ . '/../data/files';
    $found = null;
    foreach (['xlsx', 'csv', 'dat'] as $ext) {
        if (is_file($dir . '/' . $id . '.' . $ext)) { $found = $dir . '/' . $id . '.' . $ext; break; }
    }
    if (!$found) json_err('원본 파일이 남아 있지 않습니다.', 404);

    header('Content-Type: application/octet-stream');
    header('Content-Length: ' . filesize($found));
    header('Content-Disposition: attachment; filename="' . rawurlencode($up['filename']) . '"');
    readfile($found);
    exit;
}

/* ── 되돌리기 ──────────────────────────────────────────── */
if ($action === 'rollback') {
    $id = (int)($_POST['id'] ?? 0);
    $st = db()->prepare('SELECT * FROM uploads WHERE id = ?');
    $st->execute([$id]);
    $up = $st->fetch();
    if (!$up)              json_err('그런 기록이 없습니다.');
    if ($up['restored'])   json_err('이미 되돌린 기록입니다.');
    if (!$up['backup'])    json_err('되돌릴 자료가 남아 있지 않습니다.');

    $old = json_decode($up['backup'], true);
    if (!is_array($old)) json_err('백업 자료를 읽지 못했습니다.');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM tires WHERE brand = ?')->execute([$up['brand']]);
        $ins = $pdo->prepare(
            'INSERT INTO tires (brand, model, product, size, spec, season, price, width, aspect, inch, visible, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        foreach ($old as $o) {
            $ins->execute([
                $o['brand'], $o['model'], $o['product'], $o['size'], $o['spec'], $o['season'],
                $o['price'], $o['width'], $o['aspect'], $o['inch'], $o['visible'], $o['updated_at'],
            ]);
        }
        $pdo->prepare('UPDATE uploads SET restored = 1 WHERE id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_err('되돌리는 중 문제가 생겼습니다.');
    }

    cache_clear();
    rebuild_static();

    json_out(['ok' => true, 'restored' => count($old), 'brand' => $up['brand']]);
}

/* ── 제조사 추가 / 삭제 / 순서 ─────────────────────────── */
if ($action === 'brand_add') {
    $name = trim((string)($_POST['name'] ?? ''));
    if ($name === '') json_err('제조사 이름을 입력해 주세요.');
    // MySQL 은 넣는 표를 그 안에서 다시 읽지 못하므로 순서번호를 먼저 구한다
    $next = (int)db()->query('SELECT COALESCE(MAX(sort_no), 0) + 1 FROM brands')->fetchColumn();
    $st = db()->prepare('INSERT IGNORE INTO brands (name, sort_no) VALUES (?, ?)');
    $st->execute([mb_substr($name, 0, 40), $next]);
    cache_clear();
    json_out(['ok' => true]);
}

if ($action === 'brand_del') {
    $name = trim((string)($_POST['name'] ?? ''));
    db()->prepare('DELETE FROM brands WHERE name = ?')->execute([$name]);
    db()->prepare('DELETE FROM tires  WHERE brand = ?')->execute([$name]);
    cache_clear();
    rebuild_static();
    json_out(['ok' => true]);
}

/* 관리자 화면에서 번호를 고쳐 순서를 바꾼다 */
if ($action === 'brand_order') {
    $names = json_decode((string)($_POST['names'] ?? '[]'), true);
    if (!is_array($names) || !$names) json_err('순서 목록이 올바르지 않습니다.');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $up = $pdo->prepare('UPDATE brands SET sort_no = ? WHERE name = ?');
        foreach (array_values($names) as $i => $n) $up->execute([$i + 1, (string)$n]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        json_err('순서를 저장하지 못했습니다.');
    }
    cache_clear();
    json_out(['ok' => true]);
}

/* ── 비밀번호 변경 ─────────────────────────────────────── */
if ($action === 'password') {
    $new = (string)($_POST['new'] ?? '');
    if (mb_strlen($new) < 4) json_err('비밀번호는 4자 이상으로 정해주세요.');
    setting_set('admin_password_hash', password_hash($new, PASSWORD_DEFAULT));
    json_out(['ok' => true]);
}

json_err('알 수 없는 요청입니다.', 404);

