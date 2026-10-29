"""
Pydantic schemas for the Financial Document Analysis Agent API.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class DocumentType(str, Enum):
    ANNUAL_REPORT = "annual_report"
    FINANCIAL_STATEMENT = "financial_statement"
    QUARTERLY_REPORT = "quarterly_report"
    INVESTOR_PRESENTATION = "investor_presentation"
    OTHER = "other"


class UploadedDocument(BaseModel):
    id: str
    filename: str
    document_type: DocumentType
    upload_time: datetime
    page_count: int
    file_size_bytes: int
    year: Optional[int] = None
    company_name: Optional[str] = None


class FinancialTableCell(BaseModel):
    value: str
    row: int
    col: int


class FinancialTable(BaseModel):
    title: Optional[str] = None
    page: int
    document_id: str
    headers: List[str]
    rows: List[List[str]]
    raw_text: Optional[str] = None


class Citation(BaseModel):
    document_id: str
    filename: str
    page: int
    excerpt: Optional[str] = None


class FinancialMetric(BaseModel):
    name: str
    values: Dict[str, float]  # year -> value
    unit: str
    change_pct: Optional[Dict[str, float]] = None  # year -> % change vs prior year


class ChartData(BaseModel):
    chart_id: str
    chart_type: str  # "line", "bar", "pie"
    title: str
    url: str  # relative path to the generated chart image


class AnalysisResponse(BaseModel):
    query: str
    answer: str
    citations: List[Citation] = []
    tables: List[FinancialTable] = []
    charts: List[ChartData] = []
    metrics: List[FinancialMetric] = []
    suggestions: List[str] = []


class ComparisonRequest(BaseModel):
    document_id_1: str
    document_id_2: str
    focus_areas: Optional[List[str]] = None  # e.g. ["revenue", "net income"]


class ComparisonResult(BaseModel):
    document_1: UploadedDocument
    document_2: UploadedDocument
    summary: str
    key_changes: List[Dict[str, Any]]
    metric_diffs: List[FinancialMetric]
    charts: List[ChartData] = []
    citations: List[Citation] = []


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    message: str
    document_ids: List[str]
    history: List[ChatMessage] = []


class ChatResponse(BaseModel):
    message: str
    analysis: Optional[AnalysisResponse] = None
