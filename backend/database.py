"""
SQLite database — persists uploaded documents and conversation history.
"""
import os
import json
from datetime import datetime
from typing import Optional, List

from sqlalchemy import (
    create_engine, Column, String, Integer, Float,
    DateTime, Text, JSON, Boolean
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DB_PATH = os.getenv("DB_PATH", "./financial_agent.db")
engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


# ── Models ─────────────────────────────────────────────────────────────────

class DBDocument(Base):
    __tablename__ = "documents"
    id           = Column(String, primary_key=True)
    filename     = Column(String, nullable=False)
    document_type = Column(String, default="other")
    upload_time  = Column(DateTime, default=datetime.utcnow)
    page_count   = Column(Integer, default=0)
    file_size_bytes = Column(Integer, default=0)
    year         = Column(Integer, nullable=True)
    company_name = Column(String, nullable=True)
    file_path    = Column(String, nullable=False)


class DBConversation(Base):
    __tablename__ = "conversations"
    id           = Column(String, primary_key=True)
    title        = Column(String, default="Conversation")
    document_ids = Column(Text, default="[]")   # JSON list
    messages     = Column(Text, default="[]")   # JSON list
    created_at   = Column(DateTime, default=datetime.utcnow)
    language     = Column(String, default="en")


class DBAnalysisCache(Base):
    __tablename__ = "analysis_cache"
    id           = Column(String, primary_key=True)
    query_hash   = Column(String, index=True)
    document_ids = Column(Text)
    answer       = Column(Text)
    created_at   = Column(DateTime, default=datetime.utcnow)


# ── Init ───────────────────────────────────────────────────────────────────

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Helpers ────────────────────────────────────────────────────────────────

def save_document(db: Session, doc_data: dict, file_path: str):
    existing = db.query(DBDocument).filter(DBDocument.id == doc_data["id"]).first()
    if existing:
        return existing
    db_doc = DBDocument(
        id=doc_data["id"],
        filename=doc_data["filename"],
        document_type=str(doc_data.get("document_type", "other")),
        page_count=doc_data.get("page_count", 0),
        file_size_bytes=doc_data.get("file_size_bytes", 0),
        year=doc_data.get("year"),
        company_name=doc_data.get("company_name"),
        file_path=file_path,
    )
    db.add(db_doc)
    db.commit()
    return db_doc


def get_all_documents(db: Session) -> List[DBDocument]:
    return db.query(DBDocument).order_by(DBDocument.upload_time.desc()).all()


def save_conversation(db: Session, conv_id: str, title: str,
                      document_ids: list, messages: list, language: str = "en"):
    existing = db.query(DBConversation).filter(DBConversation.id == conv_id).first()
    if existing:
        existing.messages = json.dumps(messages)
        existing.title = title
        db.commit()
        return existing
    conv = DBConversation(
        id=conv_id,
        title=title,
        document_ids=json.dumps(document_ids),
        messages=json.dumps(messages),
        language=language,
    )
    db.add(conv)
    db.commit()
    return conv


def get_conversations(db: Session, limit: int = 20) -> List[DBConversation]:
    return db.query(DBConversation).order_by(
        DBConversation.created_at.desc()
    ).limit(limit).all()


def delete_conversation(db: Session, conv_id: str):
    db.query(DBConversation).filter(DBConversation.id == conv_id).delete()
    db.commit()
