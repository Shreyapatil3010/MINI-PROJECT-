"""
PDF Validator — checks if uploaded PDF is a financial document.
Returns a confidence score and detailed reason.
"""
import re
from typing import Dict, List, Tuple


# ── Financial keyword groups ─────────────────────────────────────────────────

FINANCIAL_KEYWORDS = {
    "revenue_income": [
        "revenue", "net revenue", "total revenue", "net sales", "total sales",
        "gross profit", "net income", "net loss", "net earnings",
        "operating income", "operating profit", "ebitda",
    ],
    "balance_sheet": [
        "total assets", "total liabilities", "shareholders equity",
        "stockholders equity", "retained earnings", "long-term debt",
        "current assets", "current liabilities", "cash and cash equivalents",
        "accounts receivable", "accounts payable", "inventory",
    ],
    "cash_flow": [
        "cash flow", "operating activities", "investing activities",
        "financing activities", "capital expenditure", "capex",
        "free cash flow", "net cash",
    ],
    "report_type": [
        "annual report", "10-k", "10k", "quarterly report", "10-q",
        "financial statements", "balance sheet", "income statement",
        "earnings per share", "eps", "dividend", "fiscal year",
        "investor presentation", "form 10", "sec filing",
    ],
    "financial_numbers": [
        "million", "billion", "thousand", "usd", "inr", "eur",
        "per share", "fiscal", "quarter", "year ended",
    ],
}

# Non-financial document indicators
NON_FINANCIAL_KEYWORDS = [
    "question paper", "exam", "assignment", "syllabus", "lecture",
    "chapter", "exercise", "marks", "student", "university",
    "homework", "theory", "definition", "example", "solution",
    "mcq", "multiple choice", "answer key", "roll no", "seat no",
    "recipe", "ingredients", "medical report", "prescription",
    "passport", "visa", "certificate", "admit card",
]


def validate_financial_pdf(page_texts: Dict[int, str], filename: str = "") -> Tuple[bool, float, str, str]:
    """
    Validate if a PDF is a financial document.

    Returns:
        is_financial  — True/False
        confidence    — 0.0 to 1.0
        doc_category  — detected category string
        message       — human-readable explanation
    """
    # ── Filename-based quick detection ───────────────────────────────────
    filename_lower = filename.lower()
    FINANCIAL_FILENAME_HINTS = [
        "annual", "report", "10-k", "10k", "quarterly", "10-q",
        "financial", "earnings", "investor", "aapl", "nasdaq",
        "balance", "income", "revenue", "statement", "filing",
    ]
    filename_score = sum(1 for h in FINANCIAL_FILENAME_HINTS if h in filename_lower)
    filename_boost = min(filename_score * 0.1, 0.3)

    # Combine first 10 pages for analysis
    combined = " ".join(
        page_texts.get(i, "") for i in range(1, min(11, max(page_texts.keys(), default=1) + 1))
    ).lower()

    if not combined.strip():
        return False, 0.0, "empty", "No text could be extracted from this PDF."

    # ── Count keyword hits ────────────────────────────────────────────────
    hits: Dict[str, int] = {}
    total_hits = 0
    for category, keywords in FINANCIAL_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in combined)
        hits[category] = count
        total_hits += count

    # ── Check non-financial signals ───────────────────────────────────────
    non_fin_hits = sum(1 for kw in NON_FINANCIAL_KEYWORDS if kw in combined)

    # ── Scoring ───────────────────────────────────────────────────────────
    # Max possible hits
    max_hits = sum(len(v) for v in FINANCIAL_KEYWORDS.values())
    raw_score = total_hits / max_hits + filename_boost

    # Boost if report_type keywords found
    if hits.get("report_type", 0) >= 2:
        raw_score = min(raw_score + 0.25, 1.0)

    # Penalty for non-financial content
    if non_fin_hits >= 3:
        raw_score = max(raw_score - (non_fin_hits * 0.08), 0.0)

    # ── Category detection ────────────────────────────────────────────────
    if hits.get("report_type", 0) >= 2:
        if "annual report" in combined or "10-k" in combined:
            category = "Annual Report"
        elif "quarterly" in combined or "10-q" in combined:
            category = "Quarterly Report"
        elif "investor" in combined and "presentation" in combined:
            category = "Investor Presentation"
        else:
            category = "Financial Statement"
    elif hits.get("balance_sheet", 0) >= 3:
        category = "Financial Statement"
    elif hits.get("revenue_income", 0) >= 2:
        category = "Financial Document"
    elif non_fin_hits >= 3:
        category = "Non-Financial Document"
    else:
        category = "Unknown Document"

    # ── Decision ──────────────────────────────────────────────────────────
    # If strong report-type keywords found, always mark as financial
    strong_financial = hits.get("report_type", 0) >= 1 or hits.get("revenue_income", 0) >= 2
    is_financial = (raw_score >= 0.03 and non_fin_hits < 8) or strong_financial

    if is_financial:
        if raw_score >= 0.3:
            confidence_label = "High confidence"
        elif raw_score >= 0.1:
            confidence_label = "Medium confidence"
        else:
            confidence_label = "Low confidence"

        message = (
            f"✅ {confidence_label} — This appears to be a {category}. "
            f"Found {total_hits} financial indicators across {len(page_texts)} pages."
        )
    else:
        found_categories = [cat for cat, cnt in hits.items() if cnt > 0]
        if non_fin_hits >= 3:
            message = (
                f"⚠️ This document does not appear to be a financial report. "
                f"It looks like a {category} (detected {non_fin_hits} non-financial terms). "
                f"Please upload an Annual Report, Financial Statement, or similar document."
            )
        else:
            message = (
                f"⚠️ Could not confirm this is a financial document "
                f"(only {total_hits} financial indicators found). "
                f"Results may be limited. For best results, upload Annual Reports or Financial Statements."
            )

    return is_financial, round(raw_score, 3), category, message


def get_validation_details(page_texts: Dict[int, str], filename: str = "") -> Dict:
    """Return full validation details for API response."""
    is_financial, confidence, category, message = validate_financial_pdf(page_texts, filename)

    combined = " ".join(page_texts.get(i, "") for i in range(1, 6)).lower()
    found_keywords = []
    for kw_list in FINANCIAL_KEYWORDS.values():
        for kw in kw_list:
            if kw in combined:
                found_keywords.append(kw)

    return {
        "is_financial": is_financial,
        "confidence": confidence,
        "category": category,
        "message": message,
        "found_keywords": found_keywords[:15],  # top 15
        "warning": not is_financial,
    }
