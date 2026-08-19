-- ============================================================
--  타이어공장도가격 — 데이터베이스 만들기
--  가비아 > 웹호스팅 관리 > phpMyAdmin 에서 이 내용을 붙여넣고 실행하세요.
-- ============================================================

-- 1. 가격표
CREATE TABLE IF NOT EXISTS tires (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  brand     VARCHAR(40)  NOT NULL COMMENT '제조사',
  model     VARCHAR(120) NOT NULL DEFAULT '' COMMENT '모델 (예: AU7)',
  product   VARCHAR(120) NOT NULL DEFAULT '' COMMENT '제품명 (예: 엔페라)',
  size      VARCHAR(40)  NOT NULL COMMENT '규격 (예: 225/45R18)',
  spec      VARCHAR(40)  NOT NULL DEFAULT '' COMMENT '하중지수·속도기호 (예: 95Y XL)',
  season    VARCHAR(20)  NOT NULL DEFAULT '' COMMENT '계절 (사계절/여름/겨울/SUV)',
  price     INT          NOT NULL DEFAULT 0 COMMENT '공장도가 (원, 부가세 별도)',
  width     SMALLINT     NULL COMMENT '단면폭',
  aspect    SMALLINT     NULL COMMENT '편평비',
  inch      SMALLINT     NULL COMMENT '휠 인치',
  visible   TINYINT      NOT NULL DEFAULT 1 COMMENT '1=노출',
  updated_at DATETIME    NOT NULL,
  KEY idx_brand   (brand),
  KEY idx_size    (size),
  KEY idx_price   (price),
  KEY idx_season  (season),
  -- 규격 검색이 인덱스를 그대로 타게 하는 핵심 인덱스
  KEY idx_spec3   (width, aspect, inch, price),
  KEY idx_inch    (inch, price),
  KEY idx_model   (model(20)),
  KEY idx_product (product(20)),
  -- 제조사 필터 + 가격 정렬을 한 번에 처리
  KEY idx_brand_price (brand, price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. 업로드 이력 (되돌리기용 백업 포함)
CREATE TABLE IF NOT EXISTS uploads (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  brand       VARCHAR(40)  NOT NULL,
  filename    VARCHAR(255) NOT NULL,
  row_count   INT          NOT NULL DEFAULT 0,
  uploaded_at DATETIME     NOT NULL,
  backup      LONGTEXT     NULL COMMENT '덮어쓰기 전 데이터 (되돌리기용)',
  restored    TINYINT      NOT NULL DEFAULT 0,
  KEY idx_when (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 설정값 (관리자 비밀번호 등)
CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(40) PRIMARY KEY,
  v TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. 취급 제조사 목록 (관리자 화면의 박스 순서)
CREATE TABLE IF NOT EXISTS brands (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(40) NOT NULL UNIQUE,
  sort_no  INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO brands (name, sort_no) VALUES
 ('한국', 1), ('금호', 2), ('넥센', 3), ('미쉐린', 4), ('콘티넨탈', 5),
 ('브리지스톤', 6), ('피렐리', 7), ('던롭', 8), ('굿이어', 9), ('요코하마', 10),
 ('토요', 11), ('브레데스타인', 12), ('파이어스톤', 13), ('사일룬', 14);
