<?php
/* 홈 — 전체 가격표 */
require_once __DIR__ . '/설정.php';
require_once __DIR__ . '/lib/page.php';

$ver = @filemtime(__DIR__ . '/assets/price.json') ?: 1;

/* 첫 화면은 제조사 박스 순서대로 보여준다. 같은 제조사 안에서는 싼 것부터.
   검색하면 그때부터 가격순으로 바뀐다 (assets/app.js) */
$st = db()->prepare(
    'SELECT t.brand, t.model, t.product, t.size, t.spec, t.season, t.price
       FROM tires t LEFT JOIN brands b ON b.name = t.brand
      WHERE t.visible = 1
      ORDER BY COALESCE(b.sort_no, 9999) ASC, t.price ASC, t.id ASC
      LIMIT ' . (int)PER_PAGE
);
$st->execute();
$rows = $st->fetchAll();

$n = total_count();

render_page([
    'version'   => (string)$ver,
    'title'     => '타이어 공장도가격 - G',
    'desc'      => '한국·금호·넥센·미쉐린 등 전 브랜드 타이어 공장도가격을 규격별로 무료 조회하세요. DC율을 넣으면 할인가가 바로 계산됩니다. 현재 ' . number_format($n) . '개 품목 등록.',
    'canonical' => '',
    'h1'        => '',      // 홈은 제목·설명 없이 표만 보여준다
    'lead'      => '',
    'rows'      => $rows,
    'preset'    => new stdClass(),
]);
