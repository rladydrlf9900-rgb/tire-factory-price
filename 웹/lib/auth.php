<?php
require_once __DIR__ . '/db.php';

function start_session(): void {
    if (session_status() === PHP_SESSION_NONE) {
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }
}

/** 저장된 관리자 비밀번호 해시. 없으면 설정.php 의 초기 비밀번호로 만들어 둔다 */
function admin_hash(): string {
    $h = setting('admin_password_hash');
    if (!$h) {
        $h = password_hash(ADMIN_PASSWORD, PASSWORD_DEFAULT);
        setting_set('admin_password_hash', $h);
    }
    return $h;
}

function admin_login(string $password): bool {
    start_session();
    if (password_verify($password, admin_hash())) {
        session_regenerate_id(true);
        $_SESSION['admin'] = true;
        $_SESSION['since'] = time();
        return true;
    }
    return false;
}

function is_admin(): bool {
    start_session();
    // 4시간이 지나면 다시 로그인
    if (!empty($_SESSION['admin']) && (time() - ($_SESSION['since'] ?? 0)) < 4 * 3600) {
        return true;
    }
    return false;
}

function require_admin(): void {
    if (!is_admin()) {
        json_err('관리자 로그인이 필요합니다.', 401);
    }
}

function admin_logout(): void {
    start_session();
    $_SESSION = [];
    session_destroy();
}

/** 무차별 대입 방지 — 같은 IP에서 10회 실패하면 10분 잠금 */
function login_blocked(): bool {
    start_session();
    $f = $_SESSION['fail'] ?? ['n' => 0, 'at' => 0];
    return $f['n'] >= 10 && (time() - $f['at']) < 600;
}

function login_failed(): void {
    start_session();
    $f = $_SESSION['fail'] ?? ['n' => 0, 'at' => 0];
    if (time() - $f['at'] > 600) $f['n'] = 0;
    $_SESSION['fail'] = ['n' => $f['n'] + 1, 'at' => time()];
}

function login_ok_reset(): void {
    start_session();
    unset($_SESSION['fail']);
}
