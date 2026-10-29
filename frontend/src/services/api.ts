/**
 * API client for the Financial Document Analysis Agent backend.
 */
import axios from "axios";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 120000, // 2 min — LLM calls can be slow
});

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadedDocument {
  id: string;
  filename: string;
  document_type: string;
  upload_time: string;
  page_count: number;
  file_size_bytes: number;
  year?: number;
  company_name?: string;
}

export interface FinancialTable {
  title?: string;
  page: number;
  document_id: string;
  headers: string[];
  rows: string[][];
}

export interface FinancialMetric {
  name: string;
  values: Record<string, number>;
  unit: string;
  change_pct?: Record<string, number>;
}

export interface Citation {
  document_id: string;
  filename: string;
  page: number;
  excerpt?: string;
}

export interface ChartData {
  chart_id: string;
  chart_type: string;
  title: string;
  url: string;
}

export interface AnalysisResponse {
  query: string;
  answer: string;
  citations: Citation[];
  tables: FinancialTable[];
  charts: ChartData[];
  metrics: FinancialMetric[];
  suggestions: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ComparisonResult {
  document_1: UploadedDocument;
  document_2: UploadedDocument;
  summary: string;
  key_changes: Array<{
    category: string;
    description: string;
    magnitude: string;
    significance: "High" | "Medium" | "Low";
    doc_a_value?: string;
    doc_b_value?: string;
  }>;
  metric_diffs: FinancialMetric[];
  charts: ChartData[];
  citations: Citation[];
}

// ─── API functions ────────────────────────────────────────────────────────────

export const uploadDocument = async (file: File): Promise<UploadedDocument> => {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
};

export const listDocuments = async (): Promise<UploadedDocument[]> => {
  const res = await api.get("/documents");
  return res.data;
};

export const deleteDocument = async (docId: string): Promise<void> => {
  await api.delete(`/documents/${docId}`);
};

export const getMetrics = async (docId: string): Promise<FinancialMetric[]> => {
  const res = await api.get(`/documents/${docId}/metrics`);
  return res.data;
};

export const getTables = async (docId: string): Promise<FinancialTable[]> => {
  const res = await api.get(`/documents/${docId}/tables`);
  return res.data;
};

export const getSummary = async (docId: string) => {
  const res = await api.get(`/documents/${docId}/summary`);
  return res.data;
};

export const getSuggestedQuestions = async (docId: string): Promise<string[]> => {
  const res = await api.get(`/documents/${docId}/suggested-questions`);
  return res.data.questions;
};

export const analyzeDocuments = async (
  message: string,
  documentIds: string[],
  history: ChatMessage[] = []
): Promise<AnalysisResponse> => {
  const res = await api.post("/analyze", {
    message,
    document_ids: documentIds,
    history,
  });
  return res.data;
};

export const compareDocuments = async (
  docId1: string,
  docId2: string,
  focusAreas?: string[]
): Promise<ComparisonResult> => {
  const res = await api.post("/compare", {
    document_id_1: docId1,
    document_id_2: docId2,
    focus_areas: focusAreas,
  });
  return res.data;
};

export const getChartUrl = (path: string): string => `${BASE_URL}${path}`;

// ── Validation ──────────────────────────────────────────────────────────────

export interface ValidationResult {
  doc_id: string;
  filename: string;
  is_financial: boolean;
  confidence: number;
  category: string;
  message: string;
  found_keywords: string[];
  warning: boolean;
}

export const validateDocument = async (docId: string): Promise<ValidationResult> => {
  const res = await api.get(`/documents/${docId}/validate`);
  return res.data;
};
