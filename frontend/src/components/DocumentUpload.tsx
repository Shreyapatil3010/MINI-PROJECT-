import React, { useCallback, useState, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { FileText, Trash2, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { uploadDocument, deleteDocument, UploadedDocument, validateDocument, ValidationResult } from "../services/api";

interface Props {
  documents: UploadedDocument[];
  selectedIds: string[];
  onDocumentsChange: (docs: UploadedDocument[]) => void;
  onSelectionChange: (ids: string[]) => void;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  annual_report: "Annual Report",
  financial_statement: "Financial Statement",
  quarterly_report: "Quarterly Report",
  investor_presentation: "Investor Presentation",
  other: "Document",
};

const DOC_TYPE_COLORS: Record<string, string> = {
  annual_report: "bg-blue-100 text-blue-800",
  financial_statement: "bg-green-100 text-green-800",
  quarterly_report: "bg-amber-100 text-amber-800",
  investor_presentation: "bg-purple-100 text-purple-800",
  other: "bg-gray-100 text-gray-700",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const DocumentUpload: React.FC<Props> = ({
  documents,
  selectedIds,
  onDocumentsChange,
  onSelectionChange,
}) => {
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const [validations, setValidations] = useState<Record<string, ValidationResult>>({});
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Frontend validators ─────────────────────────────────────────────────
  const ALLOWED_TYPES = ["application/pdf"];
  const MAX_SIZE_MB = 50;

  const validateFileBeforeUpload = (file: File): string | null => {
    // Type check
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return `"${file.name}" is not a PDF. Only PDF files are accepted.`;
    }
    if (file.type && !ALLOWED_TYPES.includes(file.type)) {
      return `"${file.name}" has invalid type "${file.type}". Only PDF files are accepted.`;
    }
    // Size check
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `"${file.name}" is too large (${(file.size/1024/1024).toFixed(1)}MB). Max allowed: ${MAX_SIZE_MB}MB.`;
    }
    // Minimum size (corrupted/empty check)
    if (file.size < 1024) {
      return `"${file.name}" is too small and may be corrupted or empty.`;
    }
    return null;
  };

  const processFiles = useCallback(
    async (files: File[]) => {
      setError(null);
      const newDocs: UploadedDocument[] = [];
      for (const file of files) {
        // Frontend validation first
        const validationError = validateFileBeforeUpload(file);
        if (validationError) {
          setError(validationError);
          continue;
        }
        setUploadProgress((prev) => [...prev, `Uploading ${file.name}...`]);
        try {
          const doc = await uploadDocument(file);
          newDocs.push(doc);
          setUploadProgress((prev) =>
            prev.map((p) => (p.includes(file.name) ? `✓ ${file.name}` : p))
          );
          // Validate financial content
          try {
            const v = await validateDocument(doc.id);
            setValidations((prev) => ({ ...prev, [doc.id]: v }));
            if (!v.is_financial) {
              // Remove non-financial doc and warn user
              await deleteDocument(doc.id);
              newDocs.pop();
              setError(
                `"${file.name}" does not appear to be a financial document (${v.category}). ` +
                `Please upload Annual Reports, Financial Statements, Balance Sheets, or similar documents.`
              );
              setUploadProgress((prev) => prev.filter((p) => !p.includes(file.name)));
              continue;
            }
          } catch {
            // If validation fails, keep doc but no badge
          }
        } catch (err: any) {
          setError(`Failed to upload ${file.name}: ${err.response?.data?.detail || err.message}`);
          setUploadProgress((prev) => prev.filter((p) => !p.includes(file.name)));
        }
      }
      onDocumentsChange([...documents, ...newDocs]);
      onSelectionChange([...selectedIds, ...newDocs.map((d) => d.id)]);
      setTimeout(() => setUploadProgress([]), 2500);
    },
    [documents, selectedIds, onDocumentsChange, onSelectionChange]
  );

  const onDrop = useCallback(
    (acceptedFiles: File[], rejectedFiles: any[]) => {
      if (rejectedFiles.length > 0) {
        const names = rejectedFiles.map((r: any) => r.file.name).join(", ");
        setError(`Rejected: "${names}". Only PDF files are accepted. Images, Word, Excel and ZIP files are not supported.`);
      }
      if (acceptedFiles.length > 0) processFiles(acceptedFiles);
    },
    [processFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: true,
    noClick: true,
  });

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processFiles(files);
    e.target.value = "";
  };

  const toggleSelect = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((sid) => sid !== id)
        : [...selectedIds, id]
    );
  };

  const handleDelete = async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation();
    try {
      await deleteDocument(docId);
      onDocumentsChange(documents.filter((d) => d.id !== docId));
      onSelectionChange(selectedIds.filter((id) => id !== docId));
    } catch {
      setError("Failed to delete document.");
    }
  };

  return (
    <div className="space-y-4">

      {/* ── Animated Folder Upload ── */}
      <div
        {...getRootProps()}
        style={{
          background: isDragActive
            ? "linear-gradient(135deg, #5bc8e8, #1a82a0)"
            : "linear-gradient(135deg, #6dd5ed, #2193b0)",
          boxShadow: "0 15px 30px rgba(0,0,0,0.15)",
          borderRadius: 18,
          padding: "24px 16px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          position: "relative",
          minHeight: 170,
          transition: "all 0.3s ease",
          outline: isDragActive ? "2px solid #3b82f6" : "none",
        }}
      >
        <input {...getInputProps()} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileInputChange}
          style={{ display: "none" }}
        />

        {/* ── Folder (only this part animates on hover) ── */}
        <div
          style={{
            position: "absolute",
            top: -20,
            left: "50%",
            transform: "translateX(-60px)",
            width: 120,
            height: 80,
            cursor: "pointer",
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => fileInputRef.current?.click()}
        >
          {/* Back paper sheets */}
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            width: 120, height: 80, borderRadius: 12,
            background: "rgba(255,255,255,0.35)",
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(-5deg) skewX(5deg)" : "none",
            transition: "transform 350ms ease",
            zIndex: 0,
          }} />
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            width: 120, height: 80, borderRadius: 12,
            background: "rgba(255,255,255,0.2)",
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(-15deg) skewX(12deg)" : "none",
            transition: "transform 350ms ease",
            zIndex: 0,
          }} />

          {/* Folder front */}
          <div style={{
            position: "absolute", bottom: 0, left: 0, zIndex: 1,
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(-40deg) skewX(15deg)" : "none",
            transition: "transform 350ms ease",
          }}>
            {/* Tab */}
            <div style={{
              position: "absolute",
              top: -10, left: 0,
              width: 80, height: 20,
              background: "linear-gradient(135deg, #ff9a56, #ff6f56)",
              borderRadius: "12px 12px 0 0",
              boxShadow: "0 5px 15px rgba(0,0,0,0.2)",
              zIndex: 2,
            }} />
            {/* Cover */}
            <div style={{
              width: 120, height: 80,
              background: "linear-gradient(135deg, #ffe563, #ffc663)",
              borderRadius: 10,
              boxShadow: "0 15px 30px rgba(0,0,0,0.3)",
              transform: isHovered ? "scale(1.05)" : "scale(1)",
              transition: "transform 350ms ease",
            }} />
          </div>
        </div>

        {/* Choose a file button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            marginTop: 8,
            fontSize: "1em",
            color: "#ffffff",
            fontWeight: 600,
            textAlign: "center",
            background: "rgba(255,255,255,0.2)",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            width: "85%",
            padding: "9px 0",
            letterSpacing: 0.3,
            transition: "background 0.3s ease",
            backdropFilter: "blur(4px)",
          }}
          onMouseEnter={(e) =>
            ((e.target as HTMLElement).style.background = "rgba(255,255,255,0.4)")
          }
          onMouseLeave={(e) =>
            ((e.target as HTMLElement).style.background = "rgba(255,255,255,0.2)")
          }
        >
          {isDragActive ? "Drop PDFs here! 📂" : "Choose a file"}
        </button>

        <p style={{
          color: "rgba(255,255,255,0.7)",
          fontSize: 11,
          marginTop: 6,
          textAlign: "center",
        }}>
          or drag & drop PDFs here
        </p>
      </div>

      {/* Upload progress */}
      {uploadProgress.length > 0 && (
        <div className="space-y-1 fade-slide-up">
          {uploadProgress.map((p, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              {p.startsWith("✓") ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Loader className="h-4 w-4 text-blue-500 animate-spin" />
              )}
              {p}
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm fade-slide-up">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Document list */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Uploaded Documents ({documents.length})
            {selectedIds.length > 0 && (
              <span className="ml-2 text-blue-500">
                {selectedIds.length} selected
              </span>
            )}
          </p>
          {documents.map((doc) => {
            const isSelected = selectedIds.includes(doc.id);
            return (
              <div
                key={doc.id}
                onClick={() => toggleSelect(doc.id)}
                className={`doc-card flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                  ${isSelected
                    ? "border-blue-400 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-500 selected"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
              >
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-colors
                  ${isSelected ? "bg-blue-600 border-blue-600" : "border-gray-400"}`}>
                  {isSelected && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                      <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                    </svg>
                  )}
                </div>
                <FileText className="h-8 w-8 text-red-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{doc.filename}</p>
                  {/* Validation badge */}
                  {validations[doc.id] && (
                    <div className={`flex items-center gap-1 mt-0.5 px-2 py-0.5 rounded-full text-xs font-medium w-fit
                      ${validations[doc.id].is_financial
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-700"
                      }`}
                    >
                      {validations[doc.id].is_financial ? "✅" : "⚠️"}
                      {validations[doc.id].is_financial
                        ? validations[doc.id].category
                        : "Not a financial document"
                      }
                      {validations[doc.id].is_financial && (
                        <span className="ml-1 opacity-60">
                          {Math.round(validations[doc.id].confidence * 100)}%
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={`badge ${DOC_TYPE_COLORS[doc.document_type] || "bg-gray-100 text-gray-700"}`}>
                      {DOC_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </span>
                    {doc.year && (
                      <span className="badge bg-gray-100 text-gray-600">{doc.year}</span>
                    )}
                    {doc.company_name && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">{doc.company_name}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {doc.page_count} pages · {formatBytes(doc.file_size_bytes)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(e, doc.id)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                  title="Delete document"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
