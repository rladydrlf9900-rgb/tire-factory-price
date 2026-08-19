<?php
/* 검색엔진에게 "이런 페이지들이 있다"고 알려주는 목록 */
require_once __DIR__ . '/설정.php';
require_once __DIR__ . '/lib/page.php';

header('Content-Type: application/xml; charset=utf-8');

$host = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
      . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');

$mod = last_updated() ? substr(last_updated(), 0, 10) : date('Y-m-d');

$urls = [['loc' => $host . '/', 'pri' => '1.0', 'freq' => 'daily']];

/* 등록된 모든 규격 */
$sizes = db()->query('SELECT size, COUNT(*) c FROM tires WHERE visible = 1 GROUP BY size ORDER BY c DESC')
             ->fetchAll();
foreach ($sizes as $s) {
    /* 화물·오프로드 규격은 규격 페이지 주소를 만들 수 없다 — 사이트맵에 넣지 않는다 */
    if (!size_has_page($s['size'])) continue;
    $urls[] = [
        'loc'  => $host . '/' . size_to_slug($s['size']),
        'pri'  => $s['c'] >= 10 ? '0.9' : '0.6',
        'freq' => 'daily',
    ];
}

/* 제조사 */
foreach (all_brands() as $b) {
    if (!$b['c']) continue;
    $urls[] = ['loc' => $host . '/brand/' . rawurlencode($b['name']), 'pri' => '0.8', 'freq' => 'daily'];
}

echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($urls as $u) {
    echo "  <url>\n";
    echo '    <loc>' . htmlspecialchars($u['loc'], ENT_XML1) . "</loc>\n";
    echo '    <lastmod>' . $mod . "</lastmod>\n";
    echo '    <changefreq>' . $u['freq'] . "</changefreq>\n";
    echo '    <priority>' . $u['pri'] . "</priority>\n";
    echo "  </url>\n";
}
echo "</urlset>\n";

