"""
Financial Document Analysis Agent — FastAPI backend entry point.
"""
import os
import uuid
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from pydantic import BaseModel
import aiofiles
from dotenv import load_dotenv
from sqlalchemy.orm import Session

from models.schemas import (
    UploadedDocument, AnalysisResponse, ComparisonRequest,
    ComparisonResult, ChatRequest, ChatMessage,
    FinancialMetric, FinancialTable, DocumentType,
)
from services.pdf_extractor import PDFExtractor
from services.pdf_validator import get_validation_details
from services.financial_calc import tables_to_metrics, find_inconsistencies, compute_summary_stats
from services.pdf_export import generate_analysis_pdf
from agents.analyzer import FinancialAnalyzerAgent
from agents.comparator import DocumentComparatorAgent
from database import (
    init_db, get_db, save_document, save_conversation,
    get_conversations, delete_conversation, DBConversation,
)

# ─── Setup ───────────────────────────────────────────────────────────────────

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "./uploads")
CHARTS_DIR = os.getenv("CHARTS_DIR", "./charts")
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))

Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
Path(CHARTS_DIR).mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Financial Document Analysis Agent",
    description="AI-powered financial document analysis, trend detection, and document comparison",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/charts", StaticFiles(directory=CHARTS_DIR), name="charts")

# ─── Init DB ─────────────────────────────────────────────────────────────────
init_db()

# ─── In-memory store ─────────────────────────────────────────────────────────
documents: Dict[str, UploadedDocument] = {}
doc_tables: Dict[str, List[FinancialTable]] = {}
doc_page_texts: Dict[str, Dict[int, str]] = {}
doc_metrics: Dict[str, List[FinancialMetric]] = {}
doc_file_paths: Dict[str, str] = {}

# ─── Services ────────────────────────────────────────────────────────────────
extractor = PDFExtractor(upload_dir=UPLOAD_DIR)
analyzer  = FinancialAnalyzerAgent(charts_dir=CHARTS_DIR)
comparator = DocumentComparatorAgent(charts_dir=CHARTS_DIR)


# ════════════════════════════════════════════════════════════════════════════
# BASIC ROUTES
# ════════════════════════════════════════════════════════════════════════════

@app.get("/")
def root():
    return {"message": "Financial Document Analysis Agent API v2", "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok", "documents_loaded": len(documents)}


# ─── Document Upload ─────────────────────────────────────────────────────────

@app.post("/documents/upload", response_model=UploadedDocument)
async def upload_document(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    content = await file.read()
    if len(content) / (1024 * 1024) > MAX_UPLOAD_MB:
        raise HTTPException(status_code=413, detail=f"File too large. Max: {MAX_UPLOAD_MB}MB")

    doc_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}_{file.filename}")

    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)

    try:
        doc_meta, tables, page_texts = extractor.extract(file_path, doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF extraction failed: {str(e)}")

    metrics = tables_to_metrics(tables, page_texts)

    documents[doc_id]       = doc_meta
    doc_tables[doc_id]      = tables
    doc_page_texts[doc_id]  = page_texts
    doc_metrics[doc_id]     = metrics
    doc_file_paths[doc_id]  = file_path

    # Save to DB
    save_document(db, doc_meta.model_dump(), file_path)

    # ── Financial document validation ──
    validation = get_validation_details(page_texts, file.filename)
    logger.info(
        "Uploaded doc=%s tables=%d metrics=%d financial=%s confidence=%.2f",
        file.filename, len(tables), len(metrics),
        validation["is_financial"], validation["confidence"]
    )

    # Hard reject clearly non-financial documents
    if not validation["is_financial"] and validation["confidence"] < 0.02:
        # Cleanup the file
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=422,
            detail=(
                f"'{file.filename}' does not appear to be a financial document "
                f"({validation['category']}). "
                f"Please upload Annual Reports, Financial Statements, Balance Sheets, "
                f"Quarterly Reports, or Investor Presentations."
            )
        )

    return doc_meta


@app.get("/documents", response_model=List[UploadedDocument])
def list_documents():
    return list(documents.values())

@app.get("/documents/{doc_id}", response_model=UploadedDocument)
def get_document(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    return documents[doc_id]

@app.delete("/documents/{doc_id}")
def delete_document(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    fp = doc_file_paths.pop(doc_id, None)
    if fp and os.path.exists(fp):
        os.remove(fp)
    documents.pop(doc_id)
    doc_tables.pop(doc_id, None)
    doc_page_texts.pop(doc_id, None)
    doc_metrics.pop(doc_id, None)
    return {"deleted": doc_id}


# ─── Analysis ────────────────────────────────────────────────────────────────

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(request: ChatRequest):
    if not request.document_ids:
        raise HTTPException(status_code=400, detail="At least one document_id required.")

    all_tables: List[FinancialTable] = []
    all_page_texts: Dict[str, Dict[int, str]] = {}
    doc_names: Dict[str, str] = {}

    for doc_id in request.document_ids:
        if doc_id not in documents:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found.")
        all_tables.extend(doc_tables.get(doc_id, []))
        all_page_texts[doc_id] = doc_page_texts.get(doc_id, {})
        doc_names[doc_id] = documents[doc_id].filename

    all_metrics: List[FinancialMetric] = []
    for doc_id in request.document_ids:
        all_metrics.extend(doc_metrics.get(doc_id, []))

    return analyzer.analyze(
        query=request.message,
        tables=all_tables,
        metrics=all_metrics,
        page_texts=all_page_texts,
        doc_names=doc_names,
        doc_ids=request.document_ids,
        history=request.history,
    )


@app.get("/documents/{doc_id}/metrics", response_model=List[FinancialMetric])
def get_metrics(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc_metrics.get(doc_id, [])

@app.get("/documents/{doc_id}/tables", response_model=List[FinancialTable])
def get_tables(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc_tables.get(doc_id, [])

@app.get("/documents/{doc_id}/summary")
def get_summary(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    metrics = doc_metrics.get(doc_id, [])
    doc_names = {doc_id: documents[doc_id].filename}
    summary = analyzer.quick_summary(metrics, doc_names)
    return {
        "doc_id": doc_id,
        "summary": summary,
        "inconsistencies": find_inconsistencies(metrics),
        "metric_stats": {m.name: compute_summary_stats(m) for m in metrics if m.values},
    }

@app.get("/documents/{doc_id}/suggested-questions")
def suggested_questions(doc_id: str):
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    doc = documents[doc_id]
    questions = [
        "How did the company's revenue change over the last five years?",
        "What is the trend in net income and profit margins?",
        "How has the company's debt level changed?",
        "What does the cash flow statement show about operational efficiency?",
        "Are there any financial inconsistencies or red flags?",
    ]
    if doc.document_type == DocumentType.ANNUAL_REPORT:
        questions += ["What were the key strategic highlights?", "How did operating expenses compare to revenue?"]
    elif doc.document_type == DocumentType.QUARTERLY_REPORT:
        questions += ["How does this quarter compare to last year?", "What guidance did management provide?"]
    return {"doc_id": doc_id, "questions": questions}


# ─── Comparison ──────────────────────────────────────────────────────────────

@app.post("/compare", response_model=ComparisonResult)
async def compare_documents(request: ComparisonRequest):
    for did in [request.document_id_1, request.document_id_2]:
        if did not in documents:
            raise HTTPException(status_code=404, detail=f"Document {did} not found.")
    return comparator.compare(
        doc_a=documents[request.document_id_1],
        doc_b=documents[request.document_id_2],
        metrics_a=doc_metrics.get(request.document_id_1, []),
        metrics_b=doc_metrics.get(request.document_id_2, []),
        tables_a=doc_tables.get(request.document_id_1, []),
        tables_b=doc_tables.get(request.document_id_2, []),
        page_texts_a=doc_page_texts.get(request.document_id_1, {}),
        page_texts_b=doc_page_texts.get(request.document_id_2, {}),
        focus_areas=request.focus_areas,
    )


# ════════════════════════════════════════════════════════════════════════════
# NEW: CONVERSATION HISTORY
# ════════════════════════════════════════════════════════════════════════════

class SaveConvRequest(BaseModel):
    id: str
    title: str
    document_ids: List[str]
    messages: List[dict]
    language: str = "en"

@app.post("/history/save")
def history_save(req: SaveConvRequest, db: Session = Depends(get_db)):
    save_conversation(db, req.id, req.title, req.document_ids, req.messages, req.language)
    return {"saved": req.id}

@app.get("/history")
def history_list(db: Session = Depends(get_db)):
    convs = get_conversations(db, limit=20)
    return [
        {
            "id": c.id,
            "title": c.title,
            "document_ids": json.loads(c.document_ids or "[]"),
            "messages": json.loads(c.messages or "[]"),
            "created_at": c.created_at.isoformat() if c.created_at else "",
            "language": c.language,
        }
        for c in convs
    ]

@app.delete("/history/{conv_id}")
def history_delete(conv_id: str, db: Session = Depends(get_db)):
    delete_conversation(db, conv_id)
    return {"deleted": conv_id}

@app.delete("/history")
def history_clear(db: Session = Depends(get_db)):
    db.query(DBConversation).delete()
    db.commit()
    return {"cleared": True}


# ════════════════════════════════════════════════════════════════════════════
# NEW: PDF EXPORT
# ════════════════════════════════════════════════════════════════════════════

class ExportRequest(BaseModel):
    query: str
    answer: str
    document_ids: List[str]
    citations: List[dict] = []
    chart_ids: List[str] = []
    language: str = "en"

@app.post("/export/pdf")
async def export_pdf(req: ExportRequest):
    doc_names = [documents[d].filename for d in req.document_ids if d in documents]
    all_metrics = [
        {"name": m.name, "values": m.values, "unit": m.unit}
        for doc_id in req.document_ids
        for m in doc_metrics.get(doc_id, [])
    ]
    chart_files = [f"{cid}.png" for cid in req.chart_ids]

    try:
        pdf_bytes = generate_analysis_pdf(
            query=req.query,
            answer=req.answer,
            document_names=doc_names,
            citations=req.citations,
            metrics=all_metrics[:8],
            charts_dir=CHARTS_DIR,
            chart_files=chart_files,
        )
    except Exception as e:
        logger.error("PDF export failed: %s", e)
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")

    filename = f"financial-analysis-{uuid.uuid4().hex[:8]}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ════════════════════════════════════════════════════════════════════════════
# NEW: MULTILANGUAGE ANALYSIS
# ════════════════════════════════════════════════════════════════════════════

class MultiLangRequest(BaseModel):
    message: str
    document_ids: List[str]
    history: List[dict] = []
    language: str = "en"

@app.post("/analyze/multilang", response_model=AnalysisResponse)
async def analyze_multilang(request: MultiLangRequest):
    if not request.document_ids:
        raise HTTPException(status_code=400, detail="At least one document_id required.")

    lang_prefix = ""
    if request.language == "hi":
        lang_prefix = "[LANGUAGE: Hindi] कृपया हिंदी में उत्तर दें। "

    all_tables: List[FinancialTable] = []
    all_page_texts: Dict[str, Dict[int, str]] = {}
    doc_names: Dict[str, str] = {}

    for doc_id in request.document_ids:
        if doc_id not in documents:
            raise HTTPException(status_code=404, detail=f"Document {doc_id} not found.")
        all_tables.extend(doc_tables.get(doc_id, []))
        all_page_texts[doc_id] = doc_page_texts.get(doc_id, {})
        doc_names[doc_id] = documents[doc_id].filename

    all_metrics: List[FinancialMetric] = []
    for doc_id in request.document_ids:
        all_metrics.extend(doc_metrics.get(doc_id, []))

    history = [
        ChatMessage(role=m.get("role", "user"), content=m.get("content", ""),
                    timestamp=m.get("timestamp", ""))
        for m in request.history[-6:]
    ]

    return analyzer.analyze(
        query=lang_prefix + request.message,
        tables=all_tables,
        metrics=all_metrics,
        page_texts=all_page_texts,
        doc_names=doc_names,
        doc_ids=request.document_ids,
        history=history,
    )


# ════════════════════════════════════════════════════════════════════════════
# DOCUMENT VALIDATION ENDPOINT
# ════════════════════════════════════════════════════════════════════════════

@app.get("/documents/{doc_id}/validate")
def validate_document(doc_id: str):
    """Check if an uploaded document is a valid financial document."""
    if doc_id not in documents:
        raise HTTPException(status_code=404, detail="Document not found")
    page_texts = doc_page_texts.get(doc_id, {})
    validation = get_validation_details(page_texts, file.filename)
    return {
        "doc_id": doc_id,
        "filename": documents[doc_id].filename,
        **validation,
    }
