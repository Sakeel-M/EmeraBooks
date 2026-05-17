"""Single-document AI parser for Add Invoice/Bill Receipt dialogs.

Accepts a PDF or image (one supplier invoice or one customer invoice),
renders the first page to PNG if needed, hands it to OpenAI Vision
(gpt-4o-mini), and returns the extracted header fields as JSON.

Nothing is persisted — this is parse-only.
"""

import base64
import io
import json
import re
from datetime import datetime

import fitz  # PyMuPDF
import openai
from flask import Blueprint, jsonify, request

from auth import require_auth

document_parser_bp = Blueprint("document_parser", __name__, url_prefix="/api")

_ALLOWED_EXT = {"pdf", "jpg", "jpeg", "png", "webp"}
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB


def _ext(filename: str) -> str:
    return (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()


def _pdf_first_page_to_png(pdf_bytes: bytes) -> bytes:
    """Render page 1 of a PDF to a PNG bytes blob at ~144 DPI."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.page_count == 0:
            raise ValueError("PDF has no pages")
        page = doc.load_page(0)
        # 144 DPI = 2x default
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
        return pix.tobytes("png")
    finally:
        doc.close()


def _coerce_date(raw):
    """Return YYYY-MM-DD or None."""
    if not raw or not isinstance(raw, str):
        return None
    s = raw.strip()
    # Already ISO?
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    # Try common formats
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%m/%d/%Y", "%Y/%m/%d", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _coerce_number(raw):
    if raw is None:
        return None
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        # Strip currency symbols/spaces/commas, keep digits, dot, minus
        cleaned = re.sub(r"[^\d.\-]", "", raw)
        if not cleaned or cleaned in ("-", "."):
            return None
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


@document_parser_bp.route("/parse-document", methods=["POST"])
@require_auth
def parse_document():
    file = request.files.get("file")
    kind = (request.form.get("kind") or "invoice").lower()
    if kind not in ("invoice", "bill"):
        return jsonify({"error": "kind must be 'invoice' or 'bill'"}), 400
    if file is None or not file.filename:
        return jsonify({"error": "file is required"}), 400

    ext = _ext(file.filename)
    if ext not in _ALLOWED_EXT:
        return jsonify({"error": f"Unsupported file type .{ext}. Allowed: PDF, JPG, PNG, WEBP"}), 400

    blob = file.read()
    if not blob:
        return jsonify({"error": "empty file"}), 400
    if len(blob) > _MAX_BYTES:
        return jsonify({"error": "file too large (max 10 MB)"}), 413

    # Render PDF to PNG if needed; otherwise pass image bytes through
    if ext == "pdf":
        try:
            png_bytes = _pdf_first_page_to_png(blob)
            mime = "image/png"
        except Exception as e:
            return jsonify({"error": f"Failed to read PDF: {e}"}), 400
    else:
        png_bytes = blob
        mime = "image/" + ("jpeg" if ext == "jpg" else ext)

    if not openai.api_key:
        return jsonify({"error": "OpenAI API key is not configured on the server"}), 503

    b64 = base64.b64encode(png_bytes).decode("ascii")

    counterparty_label = "supplier or vendor that issued the bill" if kind == "bill" else "customer being billed"
    system_prompt = (
        "You are an expert invoice/bill parser. Extract the header fields from the document image. "
        "Return ONLY a JSON object with this exact shape:\n"
        "{\n"
        '  "counterparty_name": string | null,  // ' + counterparty_label + "\n"
        '  "doc_number": string | null,         // invoice number / bill number\n'
        '  "doc_date": string | null,           // YYYY-MM-DD\n'
        '  "subtotal": number | null,           // amount before tax, plain decimal, no currency symbol\n'
        '  "tax_amount": number | null,         // VAT/tax amount, plain decimal\n'
        '  "total": number | null,              // grand total, plain decimal\n'
        '  "currency": string | null            // ISO code, e.g. AED, USD, EUR\n'
        "}\n"
        "Use null for any field you cannot determine. Numbers must be plain decimals (no commas, no symbols)."
    )

    try:
        response = openai.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"Parse this {kind}."},
                        {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
                    ],
                },
            ],
            response_format={"type": "json_object"},
            max_tokens=400,
            temperature=0.0,
        )
        raw = response.choices[0].message.content or "{}"
        parsed = json.loads(raw)
    except Exception as e:
        return jsonify({"error": f"AI extraction failed: {e}"}), 502

    out = {
        "counterparty_name": parsed.get("counterparty_name") or None,
        "doc_number": parsed.get("doc_number") or None,
        "doc_date": _coerce_date(parsed.get("doc_date")),
        "subtotal": _coerce_number(parsed.get("subtotal")),
        "tax_amount": _coerce_number(parsed.get("tax_amount")),
        "total": _coerce_number(parsed.get("total")),
        "currency": (parsed.get("currency") or "AED").upper() if parsed.get("currency") else "AED",
    }
    return jsonify(out)
