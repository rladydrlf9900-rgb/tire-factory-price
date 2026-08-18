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

function all_seasons(): array {
    $c = cache_get('all_seasons', 3600);
    if ($c !== null) return $c;
    $rows = db()->query(
        'SELECT DISTINCT season FROM tires WHERE visible = 1 AND season <> "" ORDER BY FIELD(season,"사계절","여름","겨울","SUV"), season'
    )->fetchAll(PDO::FETCH_COLUMN);
    cache_put('all_seasons', $rows);
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
    return '<tr data-i="' . $i . '">' .
        '<td class="c-brand">' . h($r['brand']) . '</td>' .
        '<td class="c-model">' . h($r['model']) . '</td>' .
        '<td class="c-name">' . h($r['product']) . '</td>' .
        '<td class="c-spec num">' . h($r['size']) . ' <i>' . h($r['spec']) . '</i></td>' .
        '<td class="t-c" style="font-size:12.5px;color:var(--ink-2);font-weight:600">' . h($r['season']) . '</td>' .
        '<td class="t-r"><span class="c-fac num">' . money((int)$r['price']) . '</span><u>원</u></td>' .
        '<td class="t-c"><span class="dccell">' .
            '<input class="dcinp num" type="number" min="0" max="95" value="" aria-label="DC율">' .
            '<span class="pc">%</span></span></td>' .
        '<td class="t-r"><span class="c-sale num" data-sale>' . money((int)$r['price']) . '</span><span class="won">원</span></td>' .
    '</tr>';
}

/**
 * 페이지 전체를 그린다.
 * $opt = [title, desc, canonical, h1, lead, rows, preset(JSON 초기필터), version]
 */
function render_page(array $opt): void {
    $title = $opt['title'];
    $desc  = $opt['desc'];
    $ver   = $opt['version'] ?? '1';
    $rows  = $opt['rows'] ?? [];
    $canon = $opt['canonical'] ?? '';

    $brands  = all_brands();
    $seasons = all_seasons();
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
<link rel="stylesheet" href="/assets/style.css?v=<?= h($ver) ?>">
</head>
<body>

<div id="view-app">
  <header class="top">
    <div class="top-in">
      <a class="logo" href="/">
        <button class="mk" id="mk-admin" type="button" aria-label="관리자"></button>
        <span class="txt">타이어<b>공장도가격</b></span>
      </a>
      <div class="gsearch">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/></svg>
        <input class="inp" id="q" type="search" placeholder="제품명 또는 규격 검색 (예: 벤투스, 225/45R18)" autocomplete="off" value="<?= h($opt['q'] ?? '') ?>">
      </div>
    </div>
  </header>

  <div class="shell">
    <?php /* 휴대폰에서만 보이는 필터 접기 버튼 — PC 화면에는 나타나지 않는다 */ ?>
    <button class="filterbtn" id="filterbtn" type="button" aria-expanded="false" aria-controls="rail">
      <span id="filterbtn-label">제조사 · 계절 골라보기</span><i>▾</i>
    </button>
    <aside class="rail" id="rail">
      <div class="fset">
        <h4>제조사</h4>
        <div id="brandlist"><?php foreach ($brands as $b): if (!$b['c']) continue; ?>
          <label class="ck"><input type="checkbox" value="<?= h($b['name']) ?>"<?= (($opt['brand'] ?? '') === $b['name'] ? ' checked' : '') ?>><?= h($b['name']) ?></label>
        <?php endforeach; ?></div>
      </div>
      <?php if ($seasons): ?>
      <div class="fset" id="season-set">
        <h4>계절</h4>
        <div id="seasonlist"><?php foreach ($seasons as $s): ?>
          <label class="ck"><input type="checkbox" value="<?= h($s) ?>"><?= h($s) ?></label>
        <?php endforeach; ?></div>
      </div>
      <?php endif; ?>
    </aside>

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
        <div class="tscroll">
          <table class="grid">
            <thead>
              <tr>
                <th style="width:92px">제조사</th>
                <th>모델</th>
                <th style="width:150px">제품명</th>
                <th style="width:190px">규격</th>
                <th class="t-c" style="width:80px">계절</th>
                <th class="t-r" style="width:130px">공장도가</th>
                <th class="t-c" style="width:96px">DC율</th>
                <th class="t-r" style="width:140px">할인가</th>
              </tr>
            </thead>
            <tbody id="rows"><?php
              foreach ($rows as $i => $r) echo row_html($r, $i);
              if (!$rows) echo '<tr><td colspan="8"><div class="empty"><b>등록된 상품이 없습니다.</b>가격표가 올라오면 여기에 표시됩니다.</div></td></tr>';
            ?></tbody>
          </table>
        </div>
        <div class="mobcards" id="mrows"></div>
        <div class="pager" id="pager"></div>
      </div>

    </div>
  </div>
</div>

<?php require __DIR__ . '/admin_ui.php'; ?>

<div class="toast" id="toast"></div>

<script>
  window.__PRESET = <?= json_encode($opt['preset'] ?? [], JSON_UNESCAPED_UNICODE) ?>;
  window.__DATA_URL = "/assets/price.json?v=<?= h($ver) ?>";
</script>
<script src="/assets/app.js?v=<?= h($ver) ?>"></script>
</body>
</html><?php
}


