<?php
/* 규격별 / 제조사별 페이지 — 검색엔진에 걸리는 페이지들 */
require_once __DIR__ . '/설정.php';
require_once __DIR__ . '/lib/page.php';

$ver  = @filemtime(__DIR__ . '/assets/price.json') ?: 1;
$type = (string)($_GET['type'] ?? '');
$key  = (string)($_GET['key'] ?? '');

function not_found(): void {
    http_response_code(404);
    header('Location: /', true, 302);
    exit;
}

if ($type === 'size') {
    $sz = slug_to_size($key);
    if (!$sz) not_found();
    [$size, $w, $a, $inch] = $sz;

    $st = db()->prepare(
        'SELECT brand, model, product, size, spec, season, price
           FROM tires WHERE visible = 1 AND width = ? AND aspect = ? AND inch = ?
          ORDER BY price ASC, id ASC LIMIT 200'
    );
    $st->execute([$w, $a, $inch]);
    $rows = $st->fetchAll();
    if (!$rows) not_found();

    // 화면에는 30줄만 그리지만 안내 문구에는 전체 건수를 쓴다
    $c = db()->prepare('SELECT COUNT(*) FROM tires WHERE visible = 1 AND width = ? AND aspect = ? AND inch = ?');
    $c->execute([$w, $a, $inch]);
    $cnt = (int)$c->fetchColumn();

    $cheapest = (int)$rows[0]['price'];
    $brandsIn = array_values(array_unique(array_map(fn($r) => $r['brand'], $rows)));

    render_page([
        'version'   => (string)$ver,
        'title'     => $size . ' 타이어 공장도가격 — 브랜드별 최저가 비교 | ' . SITE_NAME,
        'desc'      => $size . ' 규격 타이어의 공장도가격을 브랜드별로 비교하세요. '
                     . implode(' · ', array_slice($brandsIn, 0, 6)) . ' 등 ' . $cnt . '개 품목, 최저 '
                     . number_format($cheapest) . '원부터. DC율을 넣으면 할인가가 바로 계산됩니다.',
        'canonical' => '',
        'h1'        => $size . ' 타이어 공장도가격',
        'lead'      => '이 규격으로 ' . number_format($cnt) . '개 품목이 등록되어 있습니다. 최저 ' . number_format($cheapest) . '원 (1본 기준 · 부가세 별도)',
        'rows'      => array_slice($rows, 0, 30),
        'q'         => $size,
        'preset'    => ['q' => $size],
    ]);
    exit;
}

if ($type === 'brand') {
    $brand = trim(rawurldecode($key));
    if ($brand === '' || mb_strlen($brand) > 40) not_found();

    $st = db()->prepare(
        'SELECT brand, model, product, size, spec, season, price
           FROM tires WHERE visible = 1 AND brand = ? ORDER BY price ASC, id ASC LIMIT 30'
    );
    $st->execute([$brand]);
    $rows = $st->fetchAll();
    if (!$rows) not_found();

    $c = db()->prepare('SELECT COUNT(*) FROM tires WHERE visible = 1 AND brand = ?');
    $c->execute([$brand]);
    $cnt = (int)$c->fetchColumn();

    render_page([
        'version'   => (string)$ver,
        'title'     => $brand . '타이어 공장도가격표 — 규격별 전체 목록 | ' . SITE_NAME,
        'desc'      => $brand . ' 타이어의 공장도가격을 규격별로 확인하세요. ' . number_format($cnt)
                     . '개 품목 등록. DC율을 넣으면 할인가가 바로 계산됩니다.',
        'canonical' => '',
        'h1'        => $brand . ' 공장도가격표',
        'lead'      => number_format($cnt) . '개 품목이 등록되어 있습니다. (1본 기준 · 부가세 별도)',
        'rows'      => $rows,
        'brand'     => $brand,
        'preset'    => ['brands' => [$brand]],
    ]);
    exit;
}

not_found();

