<?php
/* ============================================================
   엑셀(.xlsx) / CSV 읽기 — 외부 라이브러리 없이 PHP 기본 기능만 사용
   xlsx 는 사실 zip 안에 XML 이 들어있는 구조라서 ZipArchive 로 열 수 있다.
   ============================================================ */

/** 엑셀 열 이름(A, B, ... AA)을 0부터 시작하는 번호로 */
function col_index(string $ref): int {
    $n = 0;
    $len = strlen($ref);
    for ($i = 0; $i < $len; $i++) {
        $c = $ref[$i];
        if ($c < 'A' || $c > 'Z') break;
        $n = $n * 26 + (ord($c) - 64);
    }
    return $n - 1;
}

/** .xlsx → 2차원 배열 */
function read_xlsx(string $path): array {
    if (!class_exists('ZipArchive')) {
        throw new RuntimeException('서버에 ZipArchive 모듈이 없어 엑셀을 읽을 수 없습니다. CSV로 올려주세요.');
    }
    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        throw new RuntimeException('엑셀 파일을 열지 못했습니다. 파일이 손상되었을 수 있습니다.');
    }

    // 공유 문자열 (엑셀은 반복되는 글자를 여기에 모아둔다)
    $shared = [];
    $ssXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($ssXml !== false) {
        $sx = @simplexml_load_string($ssXml);
        if ($sx) {
            foreach ($sx->si as $si) {
                // <t> 가 여러 조각(<r><t>)으로 나뉘어 있을 수 있다
                $text = '';
                if (isset($si->t)) {
                    $text = (string)$si->t;
                } else {
                    foreach ($si->r as $r) $text .= (string)$r->t;
                }
                $shared[] = $text;
            }
        }
    }

    // 첫 번째 시트 찾기
    $sheetPath = 'xl/worksheets/sheet1.xml';
    if ($zip->locateName($sheetPath) === false) {
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (strpos($name, 'xl/worksheets/sheet') === 0 && substr($name, -4) === '.xml') {
                $sheetPath = $name;
                break;
            }
        }
    }
    $sheetXml = $zip->getFromName($sheetPath);
    $zip->close();
    if ($sheetXml === false) {
        throw new RuntimeException('엑셀 안에서 시트를 찾지 못했습니다.');
    }

    $sx = @simplexml_load_string($sheetXml);
    if (!$sx) throw new RuntimeException('엑셀 내용을 해석하지 못했습니다.');

    $rows = [];
    foreach ($sx->sheetData->row as $row) {
        $line = [];
        foreach ($row->c as $c) {
            $ref  = (string)$c['r'];
            $idx  = $ref !== '' ? col_index($ref) : count($line);
            $type = (string)$c['t'];
            $val  = '';

            if ($type === 's') {                       // 공유 문자열
                $i = (int)$c->v;
                $val = $shared[$i] ?? '';
            } elseif ($type === 'inlineStr') {          // 셀 안에 직접 쓴 글자
                $val = isset($c->is->t) ? (string)$c->is->t : '';
                if ($val === '' && isset($c->is->r)) {
                    foreach ($c->is->r as $r) $val .= (string)$r->t;
                }
            } else {                                    // 숫자 등
                $val = isset($c->v) ? (string)$c->v : '';
            }
            $line[$idx] = trim($val);
        }
        if (!$line) { $rows[] = []; continue; }
        // 빈 칸 메우기
        $max = max(array_keys($line));
        $full = [];
        for ($i = 0; $i <= $max; $i++) $full[$i] = $line[$i] ?? '';
        $rows[] = $full;
    }
    return $rows;
}

/** CSV → 2차원 배열 (한글 엑셀 CSV 는 보통 CP949 라서 자동 변환) */
function read_csv(string $path): array {
    $raw = file_get_contents($path);
    if ($raw === false) throw new RuntimeException('파일을 읽지 못했습니다.');

    // BOM 제거
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);

    if (!mb_check_encoding($raw, 'UTF-8')) {
        $conv = @mb_convert_encoding($raw, 'UTF-8', 'CP949');
        if ($conv !== false) $raw = $conv;
    }

    $rows = [];
    $fh = fopen('php://temp', 'r+');
    fwrite($fh, $raw);
    rewind($fh);
    while (($line = fgetcsv($fh)) !== false) {
        if ($line === [null]) continue;                 // 빈 줄
        $rows[] = array_map(fn($v) => trim((string)$v), $line);
    }
    fclose($fh);
    return $rows;
}

/** 확장자를 보고 알맞은 방법으로 읽는다 */
function read_table(string $path, string $filename): array {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($ext === 'csv' || $ext === 'txt') return read_csv($path);
    if ($ext === 'xlsx')                  return read_xlsx($path);
    if ($ext === 'xls') {
        throw new RuntimeException('구형 .xls 는 읽을 수 없습니다. 엑셀에서 "다른 이름으로 저장 → .xlsx" 로 바꿔서 올려주세요.');
    }
    throw new RuntimeException('xlsx 또는 csv 파일만 올릴 수 있습니다.');
}
