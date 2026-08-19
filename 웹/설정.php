<?php
/* ============================================================
   가비아 호스팅 접속 정보  —  이 파일만 고치면 됩니다.
   가비아 My가비아 > 웹호스팅 > 관리 > DB정보 에서 확인하세요.
   ============================================================ */

/* 내 컴퓨터에서 미리보기로 띄울 때 쓰는 값이 있으면 그것을 먼저 읽습니다.
   (설정.local.php — git 에 올라가지 않는 파일. 서버에는 없으므로 아래 값이 그대로 쓰입니다) */
$__local = __DIR__ . '/설정.local.php';
if (is_file($__local)) require_once $__local;

// 데이터베이스 (가비아에서 발급받은 값으로 바꾸세요)
defined('DB_HOST') || define('DB_HOST', 'localhost');   // 보통 localhost, 가비아가 따로 알려주면 그 주소
defined('DB_NAME') || define('DB_NAME', 'DB이름을_여기에');
defined('DB_USER') || define('DB_USER', 'DB아이디를_여기에');
defined('DB_PASS') || define('DB_PASS', 'DB비밀번호를_여기에');

// 관리자 비밀번호 (처음 접속 후 관리자 화면에서 바꿀 수 있습니다)
defined('ADMIN_PASSWORD') || define('ADMIN_PASSWORD', '1234');

// 사이트 이름 — 화면 위쪽과 브라우저 탭에 표시됩니다
defined('SITE_NAME') || define('SITE_NAME', '타이어 공장도가격 - G');

// 한 페이지에 보여줄 상품 수
defined('PER_PAGE') || define('PER_PAGE', 100);

/* ── 아래는 건드리지 않으셔도 됩니다 ───────────────────────── */
date_default_timezone_set('Asia/Seoul');
mb_internal_encoding('UTF-8');
