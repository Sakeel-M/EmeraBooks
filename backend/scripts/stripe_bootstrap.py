"""
One-shot, idempotent bootstrap for Stripe products / prices / webhook endpoint.

Usage:
    STRIPE_SECRET_KEY=sk_test_xxx python stripe_bootstrap.py
    STRIPE_SECRET_KEY=sk_live_xxx WEBHOOK_URL=https://app.example.com/api/billing/webhook python stripe_bootstrap.py

Outputs the four env vars to paste into backend/.env.
"""
import os
import sys
import stripe

WEBHOOK_URL = os.getenv("WEBHOOK_URL", "https://app.emarabooks.com/api/billing/webhook")
WEBHOOK_EVENTS = [
    "checkout.session.completed",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.payment_failed",
    "invoice.payment_succeeded",
]

PLANS = [
    {
        "key": "starter",
        "name": "EMARA Books — Starter",
        "description": "Software access only.",
        "amount": 19900,  # 199 AED in fils (smallest unit)
    },
    {
        "key": "pro",
        "name": "EMARA Books — Pro",
        "description": "Software + tax filing + bookkeeping.",
        "amount": 99900,  # 999 AED in fils
    },
]


def _meta(obj):
    """Stripe's metadata is a StripeObject — convert to plain dict."""
    md = obj.get("metadata") if hasattr(obj, "get") else None
    if md is None:
        return {}
    if hasattr(md, "to_dict_recursive"):
        return md.to_dict_recursive()
    return dict(md)


def find_product_by_metadata(plan_key):
    """Search across products for one tagged with metadata.emara_plan == plan_key."""
    for prod in stripe.Product.list(limit=100, active=True).auto_paging_iter():
        if _meta(prod).get("emara_plan") == plan_key:
            return prod
    return None


def find_recurring_price(product_id, amount):
    """Find an active recurring AED price for the product matching the target amount."""
    for price in stripe.Price.list(product=product_id, active=True, limit=100).auto_paging_iter():
        rec = price.get("recurring") if hasattr(price, "get") else None
        rec_interval = rec.interval if rec is not None else None
        if (
            price.currency == "aed"
            and price.unit_amount == amount
            and rec is not None
            and rec_interval == "month"
        ):
            return price
    return None


def ensure_product_and_price(plan):
    prod = find_product_by_metadata(plan["key"])
    if prod:
        print(f"[ok] product '{plan['name']}' already exists: {prod.id}")
    else:
        prod = stripe.Product.create(
            name=plan["name"],
            description=plan["description"],
            metadata={"emara_plan": plan["key"]},
        )
        print(f"[+ ] created product '{plan['name']}': {prod.id}")

    price = find_recurring_price(prod.id, plan["amount"])
    if price:
        print(f"[ok] price for '{plan['name']}' already exists: {price.id}")
    else:
        price = stripe.Price.create(
            product=prod.id,
            unit_amount=plan["amount"],
            currency="aed",
            recurring={"interval": "month"},
            metadata={"emara_plan": plan["key"]},
        )
        print(f"[+ ] created price for '{plan['name']}': {price.id}")

    return price.id


def ensure_webhook():
    """Find or create webhook endpoint matching WEBHOOK_URL. Returns (id, secret_or_None).
    Note: Stripe only returns the signing secret on creation, never on retrieval. If the
    endpoint already exists, this returns None for the secret and we tell the user to
    rotate it (or use the previously-captured secret)."""
    for ep in stripe.WebhookEndpoint.list(limit=100).auto_paging_iter():
        if ep.url == WEBHOOK_URL:
            print(f"[ok] webhook endpoint already exists: {ep.id}")
            print(f"[!! ] Stripe only reveals the signing secret on creation.")
            print(f"      If you don't have it saved, delete this endpoint and re-run:")
            print(f"      stripe.WebhookEndpoint.delete('{ep.id}')")
            return ep.id, None

    ep = stripe.WebhookEndpoint.create(
        url=WEBHOOK_URL,
        enabled_events=WEBHOOK_EVENTS,
        description="EMARA Books subscription webhooks",
    )
    print(f"[+ ] created webhook endpoint: {ep.id}")
    return ep.id, ep.secret


def main():
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key:
        print("ERROR: STRIPE_SECRET_KEY env var is required.")
        sys.exit(1)
    if not (key.startswith("sk_test_") or key.startswith("sk_live_")):
        print("ERROR: STRIPE_SECRET_KEY must start with sk_test_ or sk_live_.")
        sys.exit(1)

    mode = "TEST" if key.startswith("sk_test_") else "LIVE"
    stripe.api_key = key

    print(f"\n=== Bootstrapping Stripe in {mode} mode ===\n")

    print("--- Products + Prices ---")
    price_starter = ensure_product_and_price(PLANS[0])
    price_pro = ensure_product_and_price(PLANS[1])

    print(f"\n--- Webhook endpoint ({WEBHOOK_URL}) ---")
    _, whsec = ensure_webhook()

    print("\n=== Done ===\n")
    print("Paste these into your .env (replacing existing Stripe vars):\n")
    print(f"STRIPE_SECRET_KEY={key}")
    if whsec:
        print(f"STRIPE_WEBHOOK_SECRET={whsec}")
    else:
        print(f"# STRIPE_WEBHOOK_SECRET=<unchanged — webhook already existed; use the value you saved earlier>")
    print(f"STRIPE_PRICE_STARTER={price_starter}")
    print(f"STRIPE_PRICE_PRO={price_pro}")
    print()


if __name__ == "__main__":
    main()
