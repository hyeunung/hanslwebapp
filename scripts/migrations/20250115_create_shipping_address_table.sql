-- 택배 배송지 정보 테이블 생성
CREATE TABLE shipping_address (
    id BIGSERIAL PRIMARY KEY,
    company TEXT NOT NULL,
    employee TEXT NOT NULL,
    position TEXT,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX idx_shipping_address_company ON shipping_address(company);
CREATE INDEX idx_shipping_address_employee ON shipping_address(employee);
CREATE INDEX idx_shipping_address_phone ON shipping_address(phone);

-- 검색을 위한 복합 인덱스
CREATE INDEX idx_shipping_address_company_employee ON shipping_address(company, employee);

-- RLS (Row Level Security) 활성화
ALTER TABLE shipping_address ENABLE ROW LEVEL SECURITY;

-- 정책 생성 (모든 인증된 사용자가 읽기 가능)
CREATE POLICY "Enable read access for all users" ON shipping_address
    FOR SELECT USING (true);

-- 정책 생성 (인증된 사용자가 삽입/업데이트/삭제 가능)
CREATE POLICY "Enable insert for authenticated users only" ON shipping_address
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users only" ON shipping_address
    FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users only" ON shipping_address
    FOR DELETE USING (true);