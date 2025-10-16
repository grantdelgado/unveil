-- Audit query to find foreign key columns without supporting indexes
-- Usage: Run this query to identify FK columns that may benefit from indexing
-- Expected result after FK index migration: 0 rows

WITH fk AS (
  SELECT
    c.oid AS fk_oid,
    c.conname,
    c.conrelid::regclass AS fk_table,
    unnest(c.conkey) AS fk_colnum
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
),
fk_cols AS (
  SELECT
    f.conname,
    f.fk_table,
    a.attname AS fk_column
  FROM fk f
  JOIN pg_attribute a
    ON a.attrelid = f.fk_table::regclass
   AND a.attnum   = f.fk_colnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
),
indexed AS (
  SELECT DISTINCT
    c.relname::regclass AS tbl,
    a.attname AS col
  FROM pg_class c
  JOIN pg_index i ON i.indrelid = c.oid
  JOIN pg_attribute a ON a.attrelid = c.oid
   AND a.attnum = ANY(i.indkey)
  WHERE c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    AND i.indisvalid AND i.indisready
)
SELECT
  f.fk_table AS table_name,
  f.fk_column AS column_name,
  f.conname AS constraint_name,
  'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_' || 
    replace(f.fk_table::text, 'public.', '') || '__' || f.fk_column || 
    ' ON ' || f.fk_table || ' (' || f.fk_column || ');' AS suggested_index
FROM fk_cols f
LEFT JOIN indexed ix
  ON ix.tbl::text = f.fk_table::text
 AND ix.col       = f.fk_column
WHERE ix.col IS NULL
ORDER BY f.fk_table, f.fk_column;
