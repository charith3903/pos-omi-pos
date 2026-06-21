-- GIN index for fast JSONB containment queries (@>) on product attributes.
-- Covers queries like: attributes @> '{"vehicle_make":"Toyota"}'
CREATE INDEX IF NOT EXISTS idx_products_attributes_gin
  ON products USING GIN (attributes jsonb_path_ops);

-- Expression indexes for the most common SPARE_PARTS search patterns.
-- These accelerate ILIKE searches on individual attribute keys.
CREATE INDEX IF NOT EXISTS idx_products_attr_part_number
  ON products ((attributes->>'part_number'))
  WHERE attributes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_attr_oem_number
  ON products ((attributes->>'oem_number'))
  WHERE attributes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_attr_vehicle_make
  ON products ((attributes->>'vehicle_make'))
  WHERE attributes IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_attr_vehicle_model
  ON products ((attributes->>'vehicle_model'))
  WHERE attributes IS NOT NULL;
