<?php
/* ============================================================
   화면 조각 만들기 — 홈과 규격·브랜드 페이지가 같이 쓴다.
   검색엔진이 읽을 수 있도록 첫 화면 내용은 서버에서 HTML 로 찍어준다.
   ============================================================ */
require_once __DIR__ . '/db.php';

function h(?string $s): string {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

function money(int $n): string {
    return number_format($n);
}

/** "225-45-18" → ['225/45R18', 225, 45, 18]  아니면 null */
function slug_to_size(string $slug): ?array {
    if (!preg_match('/^(\d{3})-(\d{2})-(\d{2})$/', $slug, $m)) return null;
    return [$m[1] . '/' . $m[2] . 'R' . $m[3], (int)$m[1], (int)$m[2], (int)$m[3]];
}

function size_to_slug(string $size): string {
    return str_replace(['/', 'R'], ['-', '-'], $size);
}

/** 이 규격으로 규격 페이지 주소(/225-45-18)를 만들 수 있는가.
 *  화물(195R15)·오프로드(35X12.50R18) 규격은 편평비가 없어 주소를 만들 수 없다 */
function size_has_page(string $size): bool {
    return (bool)preg_match('#^\d{3}/\d{2}R\d{2}$#', $size);
}

/** 사이트에서 가장 많이 쓰이는 규격 (내부 링크용) */
function popular_sizes(int $limit = 40): array {
    $c = cache_get('popular_sizes_' . $limit, 3600);
    if ($c !== null) return $c;
    $st = db()->prepare(
        'SELECT size, COUNT(*) c FROM tires WHERE visible = 1 GROUP BY size ORDER BY c DESC LIMIT ' . (int)$limit
    );
    $st->execute();
    $rows = $st->fetchAll();
    cache_put('popular_sizes_' . $limit, $rows);
    return $rows;
}

function all_brands(): array {
    $c = cache_get('all_brands', 3600);
    if ($c !== null) return $c;
    $rows = db()->query(
        'SELECT b.name, COUNT(t.id) c
           FROM brands b LEFT JOIN tires t ON t.brand = b.name AND t.visible = 1
          GROUP BY b.name, b.sort_no ORDER BY b.sort_no ASC'
    )->fetchAll();
    cache_put('all_brands', $rows);
    return $rows;
}

function total_count(): int {
    $c = cache_get('total_count', 600);
    if ($c !== null) return (int)$c;
    $n = (int)db()->query('SELECT COUNT(*) FROM tires WHERE visible = 1')->fetchColumn();
    cache_put('total_count', $n);
    return $n;
}

function last_updated(): string {
    $c = cache_get('last_updated', 600);
    if ($c !== null) return (string)$c;
    $v = (string)(db()->query('SELECT MAX(uploaded_at) FROM uploads')->fetchColumn() ?: '');
    cache_put('last_updated', $v);
    return $v;
}

/** 표의 한 줄 — 검색엔진이 읽는 부분이라 서버에서 찍는다 */
function row_html(array $r, int $i): string {
    return '<div class="pcard" data-i="' . $i . '">' .
        '<div class="pname">' .
            '<div class="pline">' .
                '<span class="bb" data-b="' . h($r['brand']) . '">' . h($r['brand']) . '</span>' .
                '<span class="mo">' . h($r['model']) . '</span>' .
                '<span class="pr">' . ($r['product'] !== '' ? '/ ' . h($r['product']) : '') . '</span>' .
            '</div>' .
            '<div class="bot num"><b>' . h($r['size']) . '</b> <i>' . h($r['spec']) . '</i></div>' .
        '</div>' .
        '<div class="nums">' .
            '<div class="col fac"><span class="c-fac num">' . money((int)$r['price']) . '</span>' .
                '<span class="lb">공장도가 (원)</span></div>' .
            '<div class="col dcc"><span class="dccell">' .
                '<input class="dcinp num" type="number" min="0" max="95" value="" aria-label="DC율">' .
                '<span class="pc">%</span></span></div>' .
            '<div class="col sal"><span class="c-sale num" data-sale>' . money((int)$r['price']) . '</span>' .
                '<span class="lb">할인가 (원)</span></div>' .
        '</div>' .
    '</div>';
}

/**
 * 페이지 전체를 그린다.
 * $opt = [title, desc, canonical, h1, lead, rows, preset(JSON 초기필터), version]
 */
/** 파일 번호표 — 고친 시각과 파일 크기를 합친다.
 *  시각만 쓰면 같은 초에 두 번 고쳤을 때 번호가 그대로라, 손님이 옛 파일을 계속 쓴다.
 *  크기까지 넣으면 내용이 달라진 것을 거의 확실하게 잡아낸다. */
function asset_ver(string $path, string $fallback): string {
    $t = @filemtime($path);
    if (!$t) return $fallback;
    return $t . '-' . (@filesize($path) ?: 0);
}

function render_page(array $opt): void {
    /* 페이지 자체는 브라우저에 저장해 두면 안 된다.
       이 안에 파일 번호표(?v=)가 들어 있어서, 옛 페이지가 남아 있으면
       바뀐 디자인·가격표를 손님이 못 받아간다. 페이지는 늘 새로 받고,
       그 안에 적힌 번호표가 그대로면 파일은 저장해 둔 것을 쓴다. */
    header("Cache-Control: no-cache, must-revalidate");
    $title = $opt['title'];
    $desc  = $opt['desc'];
    $ver   = $opt['version'] ?? '1';
    /* 번호표는 파일마다 따로 — 가격표만 바뀌었는데 디자인 파일까지 다시 받게 하거나,
       디자인을 고쳤는데 손님 화면에 반영이 안 되는 일을 막는다 */
    $vcss  = asset_ver(__DIR__ . '/../assets/style.css', $ver);
    $vjs   = asset_ver(__DIR__ . '/../assets/app.js',   $ver);
    $vjson = asset_ver(__DIR__ . '/../assets/price.json', $ver);
    $vico  = asset_ver(__DIR__ . '/../assets/icon.svg', $ver);
    $rows  = $opt['rows'] ?? [];
    $canon = $opt['canonical'] ?? '';

    $brands  = all_brands();
    ?><!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= h($title) ?></title>
<meta name="description" content="<?= h($desc) ?>">
<?php if ($canon): ?><link rel="canonical" href="<?= h($canon) ?>">
<?php endif; ?>
<meta property="og:type" content="website">
<meta property="og:title" content="<?= h($title) ?>">
<meta property="og:description" content="<?= h($desc) ?>">
<meta property="og:site_name" content="<?= h(SITE_NAME) ?>">
<link rel="icon" type="image/svg+xml" href="/assets/icon.svg?v=<?= h($vico) ?>">
<link rel="apple-touch-icon" href="/assets/icon-192.png?v=<?= h($vico) ?>">
<meta name="theme-color" content="#2e7df6">
<link rel="stylesheet" href="/assets/style.css?v=<?= h($vcss) ?>">
</head>
<body>

<div id="view-app">
  <header class="top">
    <div class="top-in">
      <div class="logo">
        <button class="mk" id="mk-admin" type="button" aria-label="관리자 화면 (두 번 클릭)" title="관리자 화면 — 두 번 클릭"><svg viewBox="0 0 192 192" aria-hidden="true" focusable="false"><rect width="192" height="192" rx="40" fill="currentColor"/><circle cx="96" cy="96" r="62" fill="none" stroke="#fff" stroke-width="21"/><rect x="96" y="87" width="36" height="19" fill="#fff"/></svg></button>
        <a class="txt" href="/">타이어 <b>공장도가격</b> <i>- G</i></a>
      </div>
    </div>
  </header>

  <div class="shell">
    <?php /* 큰 검색창 — 오른쪽 돋보기를 눌러도 검색된다 (Enter 를 못 누르는 경우) */ ?>
    <div class="gsearch">
      <input class="inp" id="q" type="search" placeholder="검색) 2355519" autocomplete="off" value="<?= h($opt['q'] ?? '') ?>">
      <button class="qbtn" id="qgo" type="button" aria-label="검색" title="검색">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
      </button>
    </div>

    <?php /* 제조사 — 가격표가 올라온 제조사만 나온다 */ ?>
    <div class="brandbar">
      <div class="bchips" id="brandlist"><?php foreach ($brands as $b): if (!$b['c']) continue; ?>
        <button class="bchip<?= (($opt['brand'] ?? '') === $b['name'] ? ' on' : '') ?>" type="button" data-b="<?= h($b['name']) ?>"><?= h($b['name']) ?></button>
      <?php endforeach; ?></div>
    </div>

    <div class="main">
      <div class="pagehead">
        <div>
          <?php if (!empty($opt['h1'])): ?><h1><?= h($opt['h1']) ?></h1><?php endif; ?>
          <?php if (!empty($opt['lead'])): ?><p><?= h($opt['lead']) ?></p><?php endif; ?>
        </div>
        <?php /* 나중에 광고를 넣을 자리. 비어 있으면 화면에 아무것도 나타나지 않는다 */ ?>
        <div class="adslot" id="adslot"></div>
      </div>

      <div class="fchips" id="chips" hidden></div>

      <div class="tblwrap">
        <div class="cards" id="rows"><?php
          foreach ($rows as $i => $r) echo row_html($r, $i);
          if (!$rows) echo '<div class="empty"><b>등록된 상품이 없습니다.</b>가격표가 올라오면 여기에 표시됩니다.</div>';
        ?></div>
        <div class="pager" id="pager"></div>
      </div>

    </div>
  </div>
</div>

<?php require __DIR__ . '/admin_ui.php'; ?>

<div class="toast" id="toast"></div>

<script>
  window.__PRESET = <?= json_encode($opt['preset'] ?? [], JSON_UNESCAPED_UNICODE) ?>;
  /* 제조사 박스 순서 — 아무것도 안 고른 첫 화면을 이 차례로 보여준다 */
  window.__BRANDS = <?= json_encode(array_column($brands, 'name'), JSON_UNESCAPED_UNICODE) ?>;
  window.__PER = <?= (int)PER_PAGE ?>;
  window.__DATA_URL = "/assets/price.json?v=<?= h($vjson) ?>";
</script>
<script src="/assets/app.js?v=<?= h($vjs) ?>"></script>
</body>
</html><?php
}


