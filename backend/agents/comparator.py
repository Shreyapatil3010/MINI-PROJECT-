"""
Document comparison agent — compares two financial documents and surfaces key differences.
"""
import json
import logging
import os
import re
import time
from typing import List, Dict, Optional, Any

from groq import Groq
from models.schemas import (
    FinancialTable, FinancialMetric, UploadedDocument,
    ComparisonResult, Citation, ChartData,
)
from services.financial_calc import diff_metrics, find_inconsistencies
from services.chart_gen import ChartGenerator

logger = logging.getLogger(__name__)

# Shorter prompt = fewer output tokens needed
COMPARISON_SYSTEM_PROMPT = """You are an expert financial analyst. Compare two financial documents concisely.
Respond with ONLY valid JSON — no markdown, no extra text.
Schema:
{
  "summary": "<2 sentence summary>",
  "key_changes": [
    {"category": "Revenue|Profitability|Balance Sheet|Cash Flow|Strategy",
     "description": "<change>", "magnitude": "<+15%>",
     "significance": "High|Medium|Low",
     "doc_a_value": "<val>", "doc_b_value": "<val>"}
  ],
  "positive_changes": ["<item>"],
  "negative_changes": ["<item>"],
  "neutral_changes": ["<item>"],
  "citations": [{"document_id": "...", "page": 1, "excerpt": "..."}]
}
Keep key_changes to maximum 5 items. Keep each description under 20 words."""


def _extract_json(text: str) -> dict:
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {}


class DocumentComparatorAgent:
    def __init__(self, charts_dir: str = "./charts"):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model         = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
        self.fallback_model = os.getenv("GROQ_MODEL_FALLBACK", "qwen/qwen3.8-27b")
        self.chart_gen = ChartGenerator(charts_dir=charts_dir)

    def _build_comparison_context(
        self,
        doc_a: UploadedDocument, doc_b: UploadedDocument,
        metrics_a: List[FinancialMetric], metrics_b: List[FinancialMetric],
        page_texts_a: Dict[int, str], page_texts_b: Dict[int, str],
        focus_areas: Optional[List[str]] = None,
    ) -> str:
        """Build compact context — keeps token count low."""
        parts = []

        parts.append(f"DOC A: {doc_a.filename} | Type: {doc_a.document_type.value} | Year: {doc_a.year}")
        parts.append(f"DOC B: {doc_b.filename} | Type: {doc_b.document_type.value} | Year: {doc_b.year}")

        # Metrics — limit to top 6 per doc
        parts.append("\nMETRICS DOC A:")
        for m in metrics_a[:6]:
            vals = ", ".join(f"{yr}: {val:,.0f}" for yr, val in sorted(m.values.items()))
            parts.append(f"  {m.name}: {vals} {m.unit}")

        parts.append("\nMETRICS DOC B:")
        for m in metrics_b[:6]:
            vals = ", ".join(f"{yr}: {val:,.0f}" for yr, val in sorted(m.values.items()))
            parts.append(f"  {m.name}: {vals} {m.unit}")

        # Diffs
        diffs = diff_metrics(metrics_a, metrics_b, doc_a.filename, doc_b.filename)
        if diffs:
            parts.append("\nKEY DIFFERENCES:")
            for d in list(diffs)[:5]:
                deltas = d.get("deltas", {})
                if deltas:
                    delta_str = ", ".join(f"{yr}: {v:+,.0f}" for yr, v in sorted(deltas.items()))
                    parts.append(f"  {d['metric']}: {delta_str}")

        # Anomalies
        for doc_name, flags in [
            (doc_a.filename, find_inconsistencies(metrics_a)),
            (doc_b.filename, find_inconsistencies(metrics_b)),
        ]:
            for flag in flags[:2]:
                parts.append(f"ANOMALY ({doc_name}): {flag}")

        # Short narrative — only first page, 200 chars max
        for doc_name, texts in [(doc_a.filename, page_texts_a), (doc_b.filename, page_texts_b)]:
            first_text = texts.get(1, "")[:200].replace("\n", " ")
            if first_text:
                parts.append(f"\n{doc_name} (p.1): {first_text}...")

        if focus_areas:
            parts.append(f"Focus: {', '.join(focus_areas)}")

        return "\n".join(parts)

    def _call_llm(self, messages: list, max_tokens: int, model: str) -> str:
        """Call LLM with retry on rate limit."""
        for attempt in range(2):
            try:
                response = self.client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0.2,
                    max_tokens=max_tokens,
                )
                return response.choices[0].message.content or ""
            except Exception as e:
                err_str = str(e)
                if "rate_limit" in err_str or "429" in err_str:
                    if attempt == 0:
                        logger.warning("Rate limit hit on %s, waiting 5s...", model)
                        time.sleep(5)
                        continue
                raise
        return ""

    def compare(
        self,
        doc_a: UploadedDocument, doc_b: UploadedDocument,
        metrics_a: List[FinancialMetric], metrics_b: List[FinancialMetric],
        tables_a: List[FinancialTable], tables_b: List[FinancialTable],
        page_texts_a: Dict[int, str], page_texts_b: Dict[int, str],
        focus_areas: Optional[List[str]] = None,
    ) -> ComparisonResult:

        context = self._build_comparison_context(
            doc_a, doc_b, metrics_a, metrics_b,
            page_texts_a, page_texts_b, focus_areas,
        )

        messages = [
            {"role": "system", "content": COMPARISON_SYSTEM_PROMPT},
            {"role": "user", "content": f"Compare:\n{context}\n\nRespond with ONLY JSON."},
        ]

        data: dict = {}
        # Try primary model first, then fallback
        for model, max_tok in [(self.model, 800), (self.fallback_model, 800)]:
            try:
                raw = self._call_llm(messages, max_tok, model)
                data = _extract_json(raw)
                if data:
                    logger.info("Comparison done with model=%s", model)
                    break
                # If no JSON, use raw text as summary
                if raw:
                    data = {
                        "summary": raw[:400],
                        "key_changes": [], "positive_changes": [],
                        "negative_changes": [], "neutral_changes": [], "citations": [],
                    }
                    break
            except Exception as e:
                logger.error("Model %s failed: %s", model, e)
                continue

        if not data:
            data = {
                "summary": "Comparison could not be completed. Please try again.",
                "key_changes": [], "positive_changes": [],
                "negative_changes": [], "neutral_changes": [], "citations": [],
            }

        # Citations
        citations = []
        for c in data.get("citations", []):
            doc_id = c.get("document_id", "")
            filename = doc_a.filename if (doc_a.id in doc_id or doc_a.filename in doc_id) else doc_b.filename
            citations.append(Citation(
                document_id=doc_id or doc_a.id,
                filename=filename,
                page=c.get("page", 0),
                excerpt=c.get("excerpt"),
            ))

        # Charts
        charts: List[ChartData] = []
        diffs = diff_metrics(metrics_a, metrics_b, doc_a.filename, doc_b.filename)
        if diffs:
            try:
                charts.append(self.chart_gen.comparison_bar_chart(
                    diffs, doc_a.filename[:20], doc_b.filename[:20]
                ))
            except Exception:
                pass

        merged = self._merge_metrics(metrics_a, metrics_b)
        if len(merged) >= 2:
            try:
                charts.append(self.chart_gen.multi_metric_chart(
                    merged[:4], title="Key Metrics Comparison"
                ))
            except Exception:
                pass

        # Metric diffs
        lookup_a = {m.name: m for m in metrics_a}
        metric_diffs = [lookup_a[n] for n in (set(lookup_a) | {m.name for m in metrics_b}) if n in lookup_a]

        return ComparisonResult(
            document_1=doc_a,
            document_2=doc_b,
            summary=data.get("summary", ""),
            key_changes=data.get("key_changes", []),
            metric_diffs=metric_diffs,
            charts=charts,
            citations=citations,
        )

    def _merge_metrics(self, a: List[FinancialMetric], b: List[FinancialMetric]) -> List[FinancialMetric]:
        merged: Dict[str, FinancialMetric] = {}
        for m in a + b:
            if m.name not in merged:
                merged[m.name] = FinancialMetric(name=m.name, values=dict(m.values), unit=m.unit)
            else:
                merged[m.name].values.update(m.values)
        return list(merged.values())
