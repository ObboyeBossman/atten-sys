-- ============================================================================
-- scripts/extract-attendance.sql
--
-- Purpose:
--   Reads the raw legacy MySQL dump (group_D.sql) from a temporary table,
--   extracts all 2,793 attendance rows (is_deleted = 0), and emits a
--   formatted VALUES literal ready to paste directly into STEP 6 of
--   supabase/migrations/0007_group_d_import.sql.
--
-- Source table column order (from the MySQL dump header):
--   id, session_id, student_index, telephone, scan_token,
--   marked_at, selfie_path, access_time, is_deleted, arrival_status, is_archived
--
-- Output tuple order (matches the migration INSERT column list):
--   (session_id, student_index, arrival_status, marked_at, selfie_path, scan_token, is_deleted)
--
-- Usage:
--   1. Open a psql session against any Postgres database (version ≥ 13).
--
--   2. Create the staging table:
--        CREATE TEMP TABLE raw_dump_lines (line text);
--
--   3. Load the dump file:
--        \copy raw_dump_lines FROM '/absolute/path/to/group_D.sql'
--
--   4. Run this script and redirect output:
--        \i scripts/extract-attendance.sql > /tmp/attendance_values.sql
--      Or from the shell:
--        psql -d <dbname> -f scripts/extract-attendance.sql -o /tmp/attendance_values.sql
--
--   5. Open /tmp/attendance_values.sql, remove the trailing comma from the
--      last row, then paste the entire block as the VALUES body in STEP 6.
--
-- Notes:
--   • All 2,793 source rows have is_deleted = 0; the WHERE clause below
--     filters defensively anyway.
--   • 44 rows have NULL selfie_path — these are dispute-resolved check-ins
--     (scan_token like 'DISPUTE_RESOLVE_%'). NULL is preserved as-is.
--   • scan_token is always present (no NULLs in the source data).
--   • The regex anchors on the BC/ index-number prefix so it matches only
--     attendance data rows and skips all DDL, comments, and other inserts.
-- ============================================================================

\pset tuples_only on
\pset format unaligned

-- ---------------------------------------------------------------------------
-- Parse each MySQL attendance data row and emit a Postgres VALUES tuple.
--
-- Source row shape (one logical line in the dump, ending with , or );):
--   (id, session_id, 'BC/XX/YY/NNN', 'phone', 'scan_token',
--    'marked_at', 'selfie_path'|NULL, 'access_time', is_deleted,
--    'arrival_status', is_archived),
--
-- Regex group map:
--   m[1]  session_id        integer
--   m[2]  student_index     'BC/...'  (captured without outer quotes)
--   m[3]  scan_token        'TOKEN'   (captured without outer quotes)
--   m[4]  marked_at         'YYYY-MM-DD HH:MM:SS' (without outer quotes)
--   m[5]  selfie_path       raw fragment — either NULL or 'path/...'
--   m[6]  is_deleted        0 or 1
--   m[7]  arrival_status    'on_time' | 'late' (without outer quotes)
-- ---------------------------------------------------------------------------

WITH parsed AS (
    SELECT
        regexp_match(
            -- Normalise line endings and strip trailing comma/semicolon
            -- so the regex does not need to handle both.
            regexp_replace(trim(line), '[,;]\s*$', ''),
            -- ── Regex ─────────────────────────────────────────────────────
            -- Matches the full MySQL VALUES row for the attendance table.
            -- Groups are numbered by capture-group order (left paren = open).
            --
            --  \(                           opening paren
            --  \d+,\s*                      id  (discarded)
            --  (\d+),\s*                  [1] session_id
            --  '(BC/[^']+)',\s*           [2] student_index
            --  '[^']*',\s*                    telephone  (discarded)
            --  '([^']+)',\s*              [3] scan_token
            --  '([^']+)',\s*              [4] marked_at
            --  (NULL|'[^']*'),\s*         [5] selfie_path (NULL or quoted)
            --  '[^']+',\s*                    access_time (discarded)
            --  ([01]),\s*                 [6] is_deleted
            --  '([^']+)',\s*              [7] arrival_status
            --  [01]                           is_archived (discarded)
            --  \)                           closing paren
            E'\\((\\d+),\\s*''(BC/[^'']+)'',\\s*''[^'']*'',\\s*''([^'']+)'',\\s*''([^'']+)'',\\s*(NULL|''[^'']*''),\\s*''[^'']*'',\\s*([01]),\\s*''([^'']+)'',\\s*[01]\\)'
        ) AS m
    FROM raw_dump_lines
    -- Fast pre-filter: only lines that look like attendance data rows.
    -- The BC/ prefix uniquely identifies student index numbers in this dump.
    WHERE line LIKE '(%, ''BC/%'', %'
)
SELECT
    -- Emit one VALUES tuple per row.
    -- Strings are quoted with %L (Postgres dollar-safe literal quoting).
    -- Integers and NULL are emitted raw with %s.
    format(
        '    (%s, %L, %L, %L, %s, %L, %s),',
        m[1],   -- session_id       integer → raw
        m[2],   -- student_index    text    → quoted
        m[7],   -- arrival_status   text    → quoted
        m[4],   -- marked_at        text    → quoted
        m[5],   -- selfie_path      NULL or quoted string → raw (already correct)
        m[3],   -- scan_token       text    → quoted
        m[6]    -- is_deleted       integer → raw
    )
FROM parsed
-- Exclude deleted rows (defensive; all source rows have is_deleted = 0).
WHERE m IS NOT NULL
  AND m[6] = '0'
ORDER BY
    -- Preserve original session order, then check-in time order within session.
    m[1]::int,
    m[4];
