"""
PDF extraction service: parses documents, extracts text, tables, and metadata.
"""
import os
import re
import uuid
import logging
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime

import pdfplumber
import PyPDF2

from models.schemas import FinancialTable, UploadedDocument, DocumentType

logger = logging.getLogger(__name__)


# ─── Helpers ────────────────────────────────────────────────────────────────

YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")

REPORT_TYPE_KEYWORDS: Dict[DocumentType, List[str]] = {
    DocumentType.ANNUAL_REPORT: ["annual report", "10-k", "10k"],
    DocumentType.QUARTERLY_REPORT: ["quarterly report", "10-q", "10q"],
    DocumentType.FINANCIAL_STATEMENT: ["financial statement", "balance sheet", "income statement", "cash flow"],
    DocumentType.INVESTOR_PRESENTATION: ["investor presentation", "investor day", "earnings presentation"],
}


def _detect_doc_type(text: str) -> DocumentType:
    lower = text.lower()
    for doc_type, keywords in REPORT_TYPE_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return doc_type
    return DocumentType.OTHER


def _detect_year(text: str) -> Optional[int]:
    matches = YEAR_PATTERN.findall(text[:3000])  # check only the first part
    if matches:
        years = sorted(set(int(y) for y in matches), reverse=True)
        # prefer the most recent year that looks like a report year
        for y in years:
            if 2000 <= y <= datetime.utcnow().year + 1:
                return y
    return None


def _detect_company(text: str) -> Optional[str]:
    """Naive heuristic: look for 'Company Name: ...' or bold header lines."""
    lines = text.split("\n")
    for line in lines[:20]:
        line = line.strip()
        if len(line) > 3 and len(line) < 80 and line.isupper():
            return line.title()
    return None


# ─── Table cleaning ──────────────────────────────────────────────────────────

def _clean_cell(cell: Any) -> str:
    if cell is None:
        return ""
    return str(cell).strip()


def _table_to_schema(raw_table: List[List[Any]], page_num: int, doc_id: str) -> Optional[FinancialTable]:
    """Convert a pdfplumber raw table to our FinancialTable schema."""
    if not raw_table or len(raw_table) < 2:
        return None

    cleaned = [[_clean_cell(c) for c in row] for row in raw_table]
    # First non-empty row = headers
    headers = cleaned[0]
    rows = cleaned[1:]

    # Skip tables with fewer than 2 columns or all empty
    if len(headers) < 2:
        return None
    if all(all(c == "" for c in row) for row in rows):
        return None

    return FinancialTable(
        page=page_num,
        document_id=doc_id,
        headers=headers,
        rows=rows,
    )


# ─── Main extraction ─────────────────────────────────────────────────────────

class PDFExtractor:
    def __init__(self, upload_dir: str = "./uploads"):
        self.upload_dir = Path(upload_dir)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    def extract(self, file_path: str, doc_id: str) -> Tuple[UploadedDocument, List[FinancialTable], Dict[int, str]]:
        """
        Extract metadata, tables, and page text from a PDF.

        Returns:
            doc_meta    – UploadedDocument schema
            tables      – list of FinancialTable objects
            page_texts  – dict mapping page_number -> raw text
        """
        path = Path(file_path)
        file_size = path.stat().st_size
        tables: List[FinancialTable] = []
        page_texts: Dict[int, str] = {}
        full_text = ""

        with pdfplumber.open(file_path) as pdf:
            page_count = len(pdf.pages)

            for page_num, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                page_texts[page_num] = text
                full_text += f"\n{text}"

                # Extract tables from this page
                raw_tables = page.extract_tables()
                for raw_table in raw_tables:
                    table = _table_to_schema(raw_table, page_num, doc_id)
                    if table:
                        tables.append(table)

        doc_type = _detect_doc_type(full_text)
        year = _detect_year(full_text)
        company = _detect_company(full_text)

        doc_meta = UploadedDocument(
            id=doc_id,
            filename=path.name,
            document_type=doc_type,
            upload_time=datetime.utcnow(),
            page_count=page_count,
            file_size_bytes=file_size,
            year=year,
            company_name=company,
        )

        logger.info(
            "Extracted doc=%s pages=%d tables=%d type=%s year=%s",
            path.name, page_count, len(tables), doc_type, year,
        )
        return doc_meta, tables, page_texts

    def get_page_text(self, file_path: str, page: int) -> str:
        """Return text for a specific page (1-indexed)."""
        with pdfplumber.open(file_path) as pdf:
            if 1 <= page <= len(pdf.pages):
                return pdf.pages[page - 1].extract_text() or ""
        return ""

    def search_text(self, page_texts: Dict[int, str], query: str) -> List[Tuple[int, str]]:
        """Search for a keyword across all pages; return (page, snippet) tuples."""
        results = []
        q = query.lower()
        for page_num, text in page_texts.items():
            lower_text = text.lower()
            idx = lower_text.find(q)
            if idx != -1:
                start = max(0, idx - 100)
                end = min(len(text), idx + 200)
                snippet = text[start:end].replace("\n", " ")
                results.append((page_num, snippet))
        return results
