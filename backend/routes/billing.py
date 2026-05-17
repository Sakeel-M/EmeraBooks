"""Stripe billing routes — keyed per Organization.

Subscription lifecycle is owned by the Organization the user belongs to:
- All members of the org share access while the subscription is active.
- Only owner / admin can change plan or cancel.
"""
import os
import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g
from auth import require_auth
from models.base import db
from models.billing import OrgSubscription
from models.tier0 import OrgMember, Organization

billing_bp = Blueprint("billing", __name__, url_prefix="/api/billing")


# ── Helpers ──────────────────────────────────────────────────────────────

def _stripe():
    """Lazy import + configure Stripe SDK so missing key only fails at request time."""
    import stripe as _s
    _s.api_key = os.getenv("STRIPE_SECRET_KEY", "")
    return _s


def _sget(obj, key, default=None):
    """Safely read a key from a Stripe StripeObject (no .get method) or a plain dict."""
    if obj is None:
        return default
    try:
        v = obj[key]
    except (KeyError, TypeError, AttributeError):
        return default
    return default if v is None else v


PLAN_TO_PRICE_ENV = {
    "starter": "STRIPE_PRICE_STARTER",
    "pro": "STRIPE_PRICE_PRO",
}


def _price_id_for_plan(plan):
    env_var = PLAN_TO_PRICE_ENV.get(plan)
    if not env_var:
        return None
    return os.getenv(env_var, "")


def _plan_from_price_id(price_id):
    if not price_id:
        return None
    if price_id == os.getenv("STRIPE_PRICE_STARTER"):
        return "starter"
    if price_id == os.getenv("STRIPE_PRICE_PRO"):
        return "pro"
    return None


def _get_user_org_membership():
    """Returns the OrgMember row for the current user, or None."""
    return OrgMember.query.filter_by(user_id=uuid.UUID(g.user_id)).first()


def _require_org_admin():
    """Returns (org_member, error_response). If error_response is not None,
    the caller should return it. Allows roles 'owner' and 'admin'."""
    member = _get_user_org_membership()
    if not member:
        return None, (jsonify({"error": "User is not a member of any organization"}), 404)
    if member.role not in ("owner", "admin"):
        return None, (jsonify({"error": "Only org owners or admins can manage billing"}), 403)
    return member, None


def _get_or_create_customer(stripe, org, billing_email):
    """Look up existing OrgSubscription for the org; if it has a customer_id, return it.
    Otherwise create a Stripe Customer and persist it."""
    sub = OrgSubscription.query.filter_by(org_id=org.id).first()
    if sub and sub.stripe_customer_id:
        return sub.stripe_customer_id, sub

    customer = stripe.Customer.create(
        email=billing_email,
        name=org.name,
        metadata={"org_id": str(org.id), "org_slug": org.slug},
    )

    if not sub:
        sub = OrgSubscription(
            org_id=org.id,
            billing_email=billing_email,
            stripe_customer_id=customer.id,
            status="incomplete",
        )
        db.session.add(sub)
    else:
        sub.stripe_customer_id = customer.id
        if billing_email:
            sub.billing_email = billing_email
    db.session.commit()
    return customer.id, sub


# ── Read endpoints ───────────────────────────────────────────────────────

@billing_bp.route("/subscription", methods=["GET"])
@require_auth
def get_my_subscription():
    member = _get_user_org_membership()
    if not member:
        return jsonify(None), 200
    sub = OrgSubscription.query.filter_by(org_id=member.org_id).first()
    if not sub:
        return jsonify(None), 200
    payload = sub.to_dict()
    # Surface the caller's role so the frontend can hide admin actions
    payload["my_role"] = member.role
    return jsonify(payload), 200


@billing_bp.route("/invoices", methods=["GET"])
@require_auth
def list_invoices():
    """List the org's Stripe invoices (most recent first)."""
    member = _get_user_org_membership()
    if not member:
        return jsonify({"invoices": []}), 200

    sub = OrgSubscription.query.filter_by(org_id=member.org_id).first()
    if not sub or not sub.stripe_customer_id:
        return jsonify({"invoices": []}), 200

    if not os.getenv("STRIPE_SECRET_KEY"):
        return jsonify({"invoices": []}), 200

    stripe = _stripe()
    try:
        result = stripe.Invoice.list(customer=sub.stripe_customer_id, limit=50)
        invoices = []
        for inv in result.data:
            lines_obj = _sget(inv, "lines") or {}
            lines_data = _sget(lines_obj, "data") or []
            description = _sget(lines_data[0], "description") if lines_data else None
            invoices.append({
                "id": _sget(inv, "id"),
                "number": _sget(inv, "number"),
                "status": _sget(inv, "status"),
                "amount_due": _sget(inv, "amount_due") or 0,
                "amount_paid": _sget(inv, "amount_paid") or 0,
                "currency": (_sget(inv, "currency") or "aed").upper(),
                "created": _sget(inv, "created"),
                "period_start": _sget(inv, "period_start"),
                "period_end": _sget(inv, "period_end"),
                "hosted_invoice_url": _sget(inv, "hosted_invoice_url"),
                "invoice_pdf": _sget(inv, "invoice_pdf"),
                "description": description,
            })
        return jsonify({"invoices": invoices}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Stripe error: {type(e).__name__}: {e}"}), 500


# ── Action endpoints ────────────────────────────────────────────────────

@billing_bp.route("/checkout", methods=["POST"])
@require_auth
def create_checkout_session():
    data = request.get_json() or {}
    plan = data.get("plan")
    if plan not in ("starter", "pro"):
        return jsonify({"error": "plan must be 'starter' or 'pro'"}), 400

    member, err = _require_org_admin()
    if err:
        return err

    org = Organization.query.get(member.org_id)
    if not org:
        return jsonify({"error": "Organization not found"}), 404

    price_id = _price_id_for_plan(plan)
    if not price_id:
        return jsonify({"error": f"Stripe price for plan '{plan}' is not configured on the server"}), 500

    if not os.getenv("STRIPE_SECRET_KEY"):
        return jsonify({"error": "Stripe is not configured on the server"}), 500

    stripe = _stripe()
    try:
        customer_id, _sub = _get_or_create_customer(stripe, org, g.user_email)

        success_url = os.getenv(
            "STRIPE_SUCCESS_URL",
            "https://app.example.com/billing/success?session_id={CHECKOUT_SESSION_ID}",
        )
        cancel_url = os.getenv("STRIPE_CANCEL_URL", "https://app.example.com/pricing?canceled=1")

        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            allow_promotion_codes=True,
            metadata={"org_id": str(org.id), "plan": plan},
            subscription_data={"metadata": {"org_id": str(org.id), "plan": plan}},
        )
        return jsonify({"url": session.url}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Stripe error: {type(e).__name__}: {e}"}), 500


@billing_bp.route("/portal", methods=["POST"])
@require_auth
def create_portal_session():
    if not os.getenv("STRIPE_SECRET_KEY"):
        return jsonify({"error": "Stripe is not configured on the server"}), 500

    member, err = _require_org_admin()
    if err:
        return err

    sub = OrgSubscription.query.filter_by(org_id=member.org_id).first()
    if not sub or not sub.stripe_customer_id:
        return jsonify({"error": "No Stripe customer for this organization"}), 404

    stripe = _stripe()
    try:
        return_url = os.getenv("STRIPE_PORTAL_RETURN_URL") or "https://app.emarabooks.com/settings"
        if "?" in return_url:
            return_url = return_url.split("?")[0]
        portal = stripe.billing_portal.Session.create(
            customer=sub.stripe_customer_id,
            return_url=return_url,
        )
        return jsonify({"url": portal.url}), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Stripe error: {type(e).__name__}: {e}"}), 500


@billing_bp.route("/cancel", methods=["POST"])
@require_auth
def cancel_subscription():
    """Cancel at period end — user keeps access until the current paid period runs out."""
    if not os.getenv("STRIPE_SECRET_KEY"):
        return jsonify({"error": "Stripe is not configured on the server"}), 500

    member, err = _require_org_admin()
    if err:
        return err

    sub = OrgSubscription.query.filter_by(org_id=member.org_id).first()
    if not sub or not sub.stripe_subscription_id:
        return jsonify({"error": "No active subscription to cancel"}), 404

    stripe = _stripe()
    try:
        updated = stripe.Subscription.modify(
            sub.stripe_subscription_id,
            cancel_at_period_end=True,
        )
        sub.cancel_at_period_end = True
        cpe = _period_end_from_subscription(updated)
        if cpe:
            sub.current_period_end = datetime.fromtimestamp(cpe, tz=timezone.utc)
        db.session.commit()
        return jsonify(sub.to_dict()), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Stripe error: {type(e).__name__}: {e}"}), 500


@billing_bp.route("/reactivate", methods=["POST"])
@require_auth
def reactivate_subscription():
    """Undo a pending cancellation — user keeps the same plan rolling."""
    if not os.getenv("STRIPE_SECRET_KEY"):
        return jsonify({"error": "Stripe is not configured on the server"}), 500

    member, err = _require_org_admin()
    if err:
        return err

    sub = OrgSubscription.query.filter_by(org_id=member.org_id).first()
    if not sub or not sub.stripe_subscription_id:
        return jsonify({"error": "No subscription found"}), 404
    if not sub.cancel_at_period_end:
        return jsonify({"error": "Subscription is not pending cancellation"}), 400

    stripe = _stripe()
    try:
        stripe.Subscription.modify(
            sub.stripe_subscription_id,
            cancel_at_period_end=False,
        )
        sub.cancel_at_period_end = False
        db.session.commit()
        return jsonify(sub.to_dict()), 200
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": f"Stripe error: {type(e).__name__}: {e}"}), 500


# ── Webhook ─────────────────────────────────────────────────────────────

def _resolve_org_id(stripe_sub_or_session, customer_id):
    """Find the org_id from either subscription metadata, customer metadata, or by looking up
    the user's org via app_user_id (legacy customers from the per-user era)."""
    meta = _sget(stripe_sub_or_session, "metadata") or {}
    org_id = _sget(meta, "org_id")
    if org_id:
        return org_id

    if customer_id:
        try:
            stripe = _stripe()
            cust = stripe.Customer.retrieve(customer_id)
            cust_md = _sget(cust, "metadata") or {}
            if _sget(cust_md, "org_id"):
                return _sget(cust_md, "org_id")
            user_id = _sget(meta, "app_user_id") or _sget(cust_md, "app_user_id")
            if user_id:
                from models.tier0 import OrgMember
                member = OrgMember.query.filter_by(user_id=uuid.UUID(user_id)).first()
                if member:
                    return str(member.org_id)
        except Exception as e:
            print(f"[billing] org resolution from customer failed: {e}")
    return None


def _period_end_from_subscription(stripe_sub):
    """Newer Stripe API versions moved current_period_end from the Subscription onto each
    SubscriptionItem. Read from whichever is present."""
    cpe = _sget(stripe_sub, "current_period_end")
    if cpe:
        return cpe
    items_obj = _sget(stripe_sub, "items") or {}
    items = _sget(items_obj, "data") or []
    if items:
        return _sget(items[0], "current_period_end")
    return None


def _upsert_from_subscription(stripe_sub):
    """Take a Stripe Subscription and upsert our OrgSubscription row by stripe_customer_id
    (falls back to org_id resolution via metadata or legacy app_user_id)."""
    customer_id = _sget(stripe_sub, "customer")
    if not customer_id:
        return None

    sub_row = OrgSubscription.query.filter_by(stripe_customer_id=customer_id).first()
    if not sub_row:
        org_id = _resolve_org_id(stripe_sub, customer_id)
        if org_id:
            try:
                sub_row = OrgSubscription.query.filter_by(org_id=uuid.UUID(org_id)).first()
            except (ValueError, TypeError):
                pass
            if not sub_row:
                try:
                    stripe = _stripe()
                    cust = stripe.Customer.retrieve(customer_id)
                    email = _sget(cust, "email") or "unknown@example.com"
                except Exception:
                    email = "unknown@example.com"
                sub_row = OrgSubscription(
                    org_id=uuid.UUID(org_id),
                    billing_email=email,
                    stripe_customer_id=customer_id,
                    status="incomplete",
                )
                db.session.add(sub_row)
                db.session.flush()
            sub_row.stripe_customer_id = customer_id
        else:
            print(f"[billing] webhook received subscription for unknown customer {customer_id}; can't resolve org")
            return None

    items_obj = _sget(stripe_sub, "items") or {}
    items = _sget(items_obj, "data") or []
    price_id = None
    if items:
        price_obj = _sget(items[0], "price")
        price_id = _sget(price_obj, "id")
    plan = _plan_from_price_id(price_id)

    sub_row.stripe_subscription_id = _sget(stripe_sub, "id")
    if plan:
        sub_row.plan_tier = plan
    sub_row.status = _sget(stripe_sub, "status") or sub_row.status
    sub_row.cancel_at_period_end = bool(_sget(stripe_sub, "cancel_at_period_end") or False)
    cpe = _period_end_from_subscription(stripe_sub)
    if cpe:
        sub_row.current_period_end = datetime.fromtimestamp(cpe, tz=timezone.utc)
    db.session.commit()
    return sub_row


@billing_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    """Stripe webhook handler. Verifies signature using STRIPE_WEBHOOK_SECRET."""
    payload = request.data
    sig_header = request.headers.get("Stripe-Signature", "")
    secret = os.getenv("STRIPE_WEBHOOK_SECRET", "")

    if not secret:
        return jsonify({"error": "Webhook secret not configured"}), 500

    stripe = _stripe()
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, secret)
    except ValueError:
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({"error": "Invalid signature"}), 400

    event_type = _sget(event, "type") or ""
    obj = _sget(_sget(event, "data") or {}, "object") or {}

    try:
        if event_type == "checkout.session.completed":
            sub_id = _sget(obj, "subscription")
            customer_id = _sget(obj, "customer")
            if sub_id:
                stripe_sub = stripe.Subscription.retrieve(sub_id)
                _upsert_from_subscription(stripe_sub)
            elif customer_id:
                row = OrgSubscription.query.filter_by(stripe_customer_id=customer_id).first()
                if row:
                    row.status = "active"
                    db.session.commit()

        elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
            _upsert_from_subscription(obj)

        elif event_type == "customer.subscription.deleted":
            customer_id = _sget(obj, "customer")
            row = OrgSubscription.query.filter_by(stripe_customer_id=customer_id).first()
            if row:
                row.status = "canceled"
                row.cancel_at_period_end = False
                db.session.commit()

        elif event_type == "invoice.payment_failed":
            customer_id = _sget(obj, "customer")
            row = OrgSubscription.query.filter_by(stripe_customer_id=customer_id).first()
            if row:
                row.status = "past_due"
                db.session.commit()

        elif event_type == "invoice.payment_succeeded":
            customer_id = _sget(obj, "customer")
            row = OrgSubscription.query.filter_by(stripe_customer_id=customer_id).first()
            if row and row.status in ("incomplete", "past_due", "unpaid"):
                row.status = "active"
                db.session.commit()
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[billing] webhook handler error for {event_type}: {e}")

    return jsonify({"received": True}), 200
