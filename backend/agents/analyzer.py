"""
Core financial analysis agent — uses Groq LLM to reason over extracted data.
"""
import json
import logging
import os
import re
from typing import List, Dict, Optional, Any

from groq import Groq
from models.schemas import (
    FinancialTable,
    FinancialMetric,
    AnalysisResponse,
    Citation,
    ChartData,
    ChatMessage,
)
from services.financial_calc import find_inconsistencies
from services.chart_gen import ChartGenerator

logger = logging.getLogger(__name__)


SYSTEM_PROMPT = """You are an expert financial analyst AI.

LANGUAGE INSTRUCTION: If the user asks a question in Hindi or if language="hi" is specified, respond in Hindi (Devanagari script). Otherwise respond in English. Always keep financial numbers, metric names, and document citations in their original format regardless of language. Analyze financial documents and answer questions accurately.

You have access to extracted financial tables, computed metrics, and page text from financial reports.

Guidelines:
1. Always cite the specific document and page number when referencing data
2. Express numbers clearly with appropriate units (millions, %, etc.)
3. Identify trends, anomalies, and notable changes
4. Be precise — use exact figures from the documents
5. If data is insufficient, say so explicitly
6. When comparing years, highlight the most significant changes first
7. Flag any financial inconsistencies or red flags you notice

You MUST respond with ONLY a valid JSON object — no extra text, no markdown, no explanation outside the JSON.
Use this exact schema:
{
  "answer": "<narrative answer to the question>",
  "key_points": ["<bullet point 1>", "<bullet point 2>"],
  "metrics_referenced": ["<metric name 1>"],
  "citations": [{"document_id": "...", "page": 1, "excerpt": "..."}],
  "suggested_followup": ["<question 1>", "<question 2>"]
}"""


def _extract_json(text: str) -> dict:
    """Robustly extract JSON from LLM response even if wrapped in markdown."""
    # Try direct parse first
    try:
        return json.loads(text)
    except Exception:
        pass
    # Try extracting from ```json ... ``` block
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except Exception:
            pass
    # Try finding first { ... } block
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {}


class FinancialAnalyzerAgent:
    def __init__(self, charts_dir: str = "./charts"):
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        self.model = os.getenv("GROQ_MODEL", "qwen/qwen3.8-27b")
        self.chart_gen = ChartGenerator(charts_dir=charts_dir)

    def _build_context(
        self,
        tables: List[FinancialTable],
        metrics: List[FinancialMetric],
        page_texts: Dict[str, Dict[int, str]],
        doc_names: Dict[str, str],
    ) -> str:
        """Build a context string for the LLM."""
        parts: List[str] = []

        parts.append("=== UPLOADED DOCUMENTS ===")
        for doc_id, name in doc_names.items():
            parts.append(f"- {name} (id: {doc_id})")

        parts.append("\n=== EXTRACTED FINANCIAL TABLES ===")
        for t in tables[:20]:
            doc_name = doc_names.get(t.document_id, t.document_id)
            header_str = " | ".join(t.headers)
            parts.append(f"\n[{doc_name}, Page {t.page}]")
            parts.append(f"Headers: {header_str}")
            for row in t.rows[:6]:
                parts.append("  " + " | ".join(row))

        parts.append("\n=== COMPUTED FINANCIAL METRICS ===")
        for m in metrics:
            values_str = ", ".join(f"{yr}: {val:,.2f}" for yr, val in sorted(m.values.items()))
            change_str = ""
            if m.change_pct:
                changes = ", ".join(f"{yr}: {chg:+.1f}%" for yr, chg in sorted(m.change_pct.items()))
                change_str = f" | YoY: {changes}"
            parts.append(f"- {m.name} ({m.unit}): {values_str}{change_str}")

        inconsistencies = find_inconsistencies(metrics)
        if inconsistencies:
            parts.append("\n=== DETECTED ANOMALIES ===")
            for flag in inconsistencies:
                parts.append(f"⚠ {flag}")

        return "\n".join(parts)

    def analyze(
        self,
        query: str,
        tables: List[FinancialTable],
        metrics: List[FinancialMetric],
        page_texts: Dict[str, Dict[int, str]],
        doc_names: Dict[str, str],
        doc_ids: List[str],
        history: Optional[List[ChatMessage]] = None,
    ) -> AnalysisResponse:
        context = self._build_context(tables, metrics, page_texts, doc_names)

        messages: List[Dict[str, str]] = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"FINANCIAL DATA CONTEXT:\n{context}"},
        ]

        if history:
            for msg in history[-4:]:
                messages.append({"role": msg.role, "content": msg.content})

        messages.append({"role": "user", "content": f"QUESTION: {query}\n\nRemember: respond with ONLY valid JSON."})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.2,
                max_tokens=900,
            )
            raw = response.choices[0].message.content or ""
            data = _extract_json(raw)
            if not data:
                data = {"answer": raw, "key_points": [], "metrics_referenced": [], "citations": [], "suggested_followup": []}
        except Exception as e:
            logger.error("LLM call failed: %s", e)
            data = {
                "answer": f"Analysis error: {str(e)}",
                "key_points": [],
                "metrics_referenced": [],
                "citations": [],
                "suggested_followup": [],
            }

        # Build citations
        citations = []
        for c in data.get("citations", []):
            doc_id = c.get("document_id", doc_ids[0] if doc_ids else "")
            citations.append(
                Citation(
                    document_id=doc_id,
                    filename=doc_names.get(doc_id, ""),
                    page=c.get("page", 0),
                    excerpt=c.get("excerpt"),
                )
            )

        # Generate charts for mentioned metrics
        charts: List[ChartData] = []
        mentioned = data.get("metrics_referenced", [])
        for metric in metrics:
            if any(m.lower() in metric.name.lower() for m in mentioned):
                if len(metric.values) >= 2:
                    charts.append(self.chart_gen.line_chart(metric))
                    growth = self.chart_gen.growth_rate_chart(metric)
                    if growth:
                        charts.append(growth)
                if len(charts) >= 4:
                    break

        answer_text = data.get("answer", "")
        key_points = data.get("key_points", [])
        if key_points:
            answer_text += "\n\nKey Points:\n" + "\n".join(f"• {p}" for p in key_points)

        return AnalysisResponse(
            query=query,
            answer=answer_text,
            citations=citations,
            tables=[t for t in tables if t.page <= 5][:5],
            charts=charts,
            metrics=[m for m in metrics if any(
                ref.lower() in m.name.lower() for ref in mentioned
            )] if mentioned else metrics[:5],
            suggestions=data.get("suggested_followup", []),
        )

    def quick_summary(
        self,
        metrics: List[FinancialMetric],
        doc_names: Dict[str, str],
    ) -> str:
        """Generate a one-paragraph executive summary from the metrics."""
        if not metrics:
            return "No financial data could be extracted from the uploaded documents."

        metric_lines = []
        for m in metrics[:8]:
            years = sorted(m.values.keys())
            if len(years) >= 2:
                first_val = m.values[years[0]]
                last_val = m.values[years[-1]]
                change = ((last_val - first_val) / abs(first_val) * 100) if first_val != 0 else 0
                metric_lines.append(
                    f"{m.name}: {first_val:,.1f} ({years[0]}) → {last_val:,.1f} ({years[-1]}) [{change:+.1f}%]"
                )

        prompt = f"""Based on these financial metrics, write a concise 3-sentence executive summary:
Documents: {', '.join(doc_names.values())}
{chr(10).join(metric_lines)}
Focus on the most important trends, growth patterns, and any concerns."""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=250,
            )
            return response.choices[0].message.content or "Summary unavailable."
        except Exception as e:
            logger.error("Summary generation failed: %s", e)
            return "Summary unavailable."
