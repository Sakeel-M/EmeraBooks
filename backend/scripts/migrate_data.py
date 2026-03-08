"""
One-time data migration script: Supabase PostgreSQL → Docker PostgreSQL.

Usage:
  export SUPABASE_DB_URL="postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres"
  export DOCKER_DB_URL="postgresql://emerabooks:changeme@localhost:5433/emerabooks"
  python scripts/migrate_data.py
"""
import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor

SUPABASE_DB_URL = os.getenv("SUPABASE_DB_URL")
DOCKER_DB_URL = os.getenv("DOCKER_DB_URL", "postgresql://emerabooks:changeme@localhost:5433/emerabooks")

# Tables in foreign-key-safe order
TABLES = [
    # Tier 0
    "organizations",
    "org_members",
    "clients",
    "user_active_client",
    # Tier 1
    "v2_connections",
    "v2_bank_accounts",
    "v2_uploaded_files",
    "v2_sync_runs",
    # Tier 2
    "v2_accounts",
    "v2_vendors",
    "v2_customers",
    "v2_transactions",
    "v2_bills",
    "v2_invoices",
    "v2_payment_allocations",
    # Tier 3
    "v2_reconciliation_sessions",
    "v2_reconciliation_items",
    "v2_matching_rules",
    # Tier 4
    "v2_risk_alerts",
    "v2_variance_baselines",
    "v2_control_settings",
    "v2_audit_logs",
    # Extra tables (not in v2 migration but referenced by hooks)
    "user_roles",
    "categories",
]


def migrate():
    if not SUPABASE_DB_URL:
        print("ERROR: Set SUPABASE_DB_URL environment variable")
        sys.exit(1)

    src = psycopg2.connect(SUPABASE_DB_URL)
    dst = psycopg2.connect(DOCKER_DB_URL)
    dst.autocommit = False

    src_cur = src.cursor(cursor_factory=RealDictCursor)
    dst_cur = dst.cursor()

    for table in TABLES:
        try:
            # Check if table exists in source
            src_cur.execute(
                "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = %s)",
                (table,)
            )
            if not src_cur.fetchone()["exists"]:
                print(f"  SKIP {table} (not in source)")
                continue

            # Fetch all rows from source
            src_cur.execute(f'SELECT * FROM public."{table}"')
            rows = src_cur.fetchall()
            if not rows:
                print(f"  SKIP {table} (empty)")
                continue

            columns = list(rows[0].keys())
            col_names = ", ".join(f'"{c}"' for c in columns)
            placeholders = ", ".join(["%s"] * len(columns))

            # Insert into destination
            insert_sql = f'INSERT INTO public."{table}" ({col_names}) VALUES ({placeholders}) ON CONFLICT DO NOTHING'

            count = 0
            for row in rows:
                values = [row[c] for c in columns]
                try:
                    dst_cur.execute(insert_sql, values)
                    count += 1
                except Exception as e:
                    print(f"  WARN {table}: skipped row — {e}")
                    dst.rollback()
                    continue

            dst.commit()
            print(f"  OK   {table}: {count}/{len(rows)} rows migrated")

        except Exception as e:
            dst.rollback()
            print(f"  ERR  {table}: {e}")

    src_cur.close()
    dst_cur.close()
    src.close()
    dst.close()
    print("\nMigration complete!")


if __name__ == "__main__":
    migrate()
