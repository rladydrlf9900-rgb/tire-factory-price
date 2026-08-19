<?php
/* ============================================================
   내 컴퓨터에서 띄울 때의 주소 규칙 —  웹/.htaccess 의 RewriteRule 과 같은 일을 한다.
   가비아(아파치)에는 .htaccess 가 있으므로 이 파일은 서버에 올리지 않는다.
   ============================================================ */

$뿌리 = $_SERVER['DOCUMENT_ROOT'];
$길   = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');

/* 설정·라이브러리·자료는 브라우저로 못 열게 (.htaccess 의 Deny 와 같다) */
if (preg_match('#^/(lib|data)/#u', $길) || preg_match('#^/설정(\.local)?\.php$#u', $길)) {
    http_response_code(403);
    echo '403';
    return true;
}

/* /225-45-18 → 규격 페이지 */
if (preg_match('#^/(\d{3})-(\d{2})-(\d{2})/?$#', $길, $m)) {
    $_GET['type'] = 'size';
    $_GET['key']  = "$m[1]-$m[2]-$m[3]";
    require $뿌리 . '/view.php';
    return true;
}

/* /브랜드/한국 → 제조사 페이지  (view.php 가 다시 풀어보므로 도로 감싸서 넘긴다) */
if (preg_match('#^/(브랜드|brand)/([^/]+)/?$#u', $길, $m)) {
    $_GET['type'] = 'brand';
    $_GET['key']  = rawurlencode($m[2]);
    require $뿌리 . '/view.php';
    return true;
}

if ($길 === '/sitemap.xml') { require $뿌리 . '/sitemap.php'; return true; }
if ($길 === '/')            { require $뿌리 . '/index.php';   return true; }

return false;        // 진짜 파일이면 서버가 알아서 내준다
