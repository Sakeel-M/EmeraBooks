"""
Grant a permanent ("lifetime") active subscription to an organization, bypassing
Stripe. Use this for comp accounts, internal staff, or partners.

The script looks up the organization via an org member's email (the user must
have signed up and completed onboarding so that an OrgMember + Organization row
exists). It then upserts a row into `org_subscriptions` with:
  - status = "active"
  - plan_tier = <chosen plan>
  - current_period_end = NULL (no expiration)
  - stripe_customer_id / stripe_subscription_id = NULL (manual grant)

Re-running with the same email is safe: an existing subscription is updated
in place, never duplicated.

Usage (inside the Flask container or with a configured FLASK env):

    docker exec finance-app-flask-1 python scripts/grant_lifetime.py \
        --email user@example.com \
        --plan pro

Optional flags:
    --plan starter | pro          (default: pro)
    --period-end YYYY-MM-DD       (default: NULL = lifetime)
    --dry-run                     (preview without writing)
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

# Allow running both from `/app` (container) and from the repo root.
HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

from app import app  # noqa: E402
from models.base import db  # noqa: E402
from models.tier0 import OrgMember, Organization  # noqa: E402
from models.billing import OrgSubscription  # noqa: E402


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Grant a lifetime active subscription to an organization.")
    p.add_argument("--email", required=True, help="Email of any member of the target organization")
    p.add_argument("--plan", choices=["starter", "pro"], default="pro", help="Plan tier to grant (default: pro)")
    p.add_argument(
        "--period-end",
        default=None,
        help="Optional ISO date (YYYY-MM-DD) for current_period_end. Omit for lifetime (NULL).",
    )
    p.add_argument("--dry-run", action="store_true", help="Preview without writing")
    return p.parse_args()


def main() -> int:
    args = parse_args()
    email = args.email.strip().lower()

    with app.app_context():
        member = (
            OrgMember.query.filter(db.func.lower(OrgMember.user_email) == email).first()
        )
        if not member:
            print(f"[error] No org_members row for email '{email}'.")
            print("        The user must sign up and complete onboarding (which creates the org and the membership) before lifetime access can be granted.")
            return 1

        org = Organization.query.get(member.org_id)
        org_name = org.name if org else "(unknown org)"

        period_end = None
        if args.period_end:
            try:
                period_end = datetime.strptime(args.period_end, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                print(f"[error] --period-end must be YYYY-MM-DD; got '{args.period_end}'.")
                return 1

        existing = OrgSubscription.query.filter_by(org_id=member.org_id).first()

        action = "update" if existing else "create"
        print("--- Plan ---")
        print(f"  email      : {email}")
        print(f"  user_id    : {member.user_id}")
        print(f"  org_id     : {member.org_id}")
        print(f"  org_name   : {org_name}")
        print(f"  action     : {action} subscription")
        print(f"  plan_tier  : {args.plan}")
        print(f"  status     : active")
        print(f"  period_end : {period_end.isoformat() if period_end else 'NULL (lifetime)'}")

        if args.dry_run:
            print("[dry-run] no changes written.")
            return 0

        if existing:
            existing.status = "active"
            existing.plan_tier = args.plan
            existing.current_period_end = period_end
            existing.cancel_at_period_end = False
            existing.billing_email = email
            existing.updated_at = datetime.now(timezone.utc)
        else:
            sub = OrgSubscription(
                org_id=member.org_id,
                billing_email=email,
                stripe_customer_id=None,
                stripe_subscription_id=None,
                plan_tier=args.plan,
                status="active",
                current_period_end=period_end,
                cancel_at_period_end=False,
            )
            db.session.add(sub)

        db.session.commit()
        print(f"[ok] {action}d org_subscriptions row for org_id={member.org_id}, status=active, plan={args.plan}.")
        return 0


if __name__ == "__main__":
    sys.exit(main())
