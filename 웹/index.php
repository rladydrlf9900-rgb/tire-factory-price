<?php
/* 홈 — 전체 가격표 */
require_once __DIR__ . '/설정.php';
require_once __DIR__ . '/lib/page.php';

$ver = @filemtime(__DIR__ . '/assets/price.json') ?: 1;

$st = db()->prepare('SELECT brand, model, product, size, spec, season, price FROM tires WHERE visible = 1 ORDER BY price ASC, id ASC LIMIT 30');
$st->execute();
$rows = $st->fetchAll();

$n = total_count();

render_page([
    'version'   => (string)$ver,
    'title'     => '타이어 공장도가격 조회 — 전 브랜드 규격별 도매가 무료 비교 | ' . SITE_NAME,
    'desc'      => '한국·금호·넥센·미쉐린 등 전 브랜드 타이어 공장도가격을 규격별로 무료 조회하세요. DC율을 넣으면 할인가가 바로 계산됩니다. 현재 ' . number_format($n) . '개 품목 등록.',
    'canonical' => '',
    'h1'        => '',      // 홈은 제목·설명 없이 표만 보여준다
    'lead'      => '',
    'rows'      => $rows,
    'preset'    => new stdClass(),
]);
