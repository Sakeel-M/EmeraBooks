ALTER TABLE invoices ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE bills ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';