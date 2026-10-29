import React from "react";
import { ComparisonResult } from "../services/api";
import { FinancialChart } from "./FinancialChart";
import { ArrowUpRight, ArrowDownRight, Minus, FileText } from "lucide-react";

interface Props {
  result: ComparisonResult;
}

const SignificanceBadge = ({ sig }: { sig: string }) => {
  const colors = {
    High: "bg-red-100 text-red-700",
    Medium: "bg-amber-100 text-amber-700",
    Low: "bg-green-100 text-green-700",
  };
  return (
    <span className={`badge ${colors[sig as keyof typeof colors] || "bg-gray-100 text-gray-600"}`}>
      {sig}
    </span>
  );
};

const MagnitudeIcon = ({ magnitude }: { magnitude: string }) => {
  const lower = magnitude.toLowerCase();
  if (lower.includes("+") || lower.includes("increase") || lower.includes("grew")) {
    return <ArrowUpRight className="h-4 w-4 text-green-600" />;
  }
  if (lower.includes("-") || lower.includes("decrease") || lower.includes("declined")) {
    return <ArrowDownRight className="h-4 w-4 text-red-600" />;
  }
  return <Minus className="h-4 w-4 text-gray-400" />;
};

const CATEGORY_COLORS: Record<string, string> = {
  Revenue: "border-l-blue-500",
  Profitability: "border-l-green-500",
  "Balance Sheet": "border-l-amber-500",
  "Cash Flow": "border-l-cyan-500",
  Strategy: "border-l-purple-500",
  Other: "border-l-gray-400",
};

export const ComparisonView: React.FC<Props> = ({ result }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card bg-gradient-to-r from-blue-50 to-indigo-50">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Document Comparison</h2>
        <div className="flex flex-wrap gap-3 text-sm text-gray-600 mb-3">
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4 text-blue-500" />
            {result.document_1.filename}
            {result.document_1.year && ` (${result.document_1.year})`}
          </span>
          <span className="text-gray-400">vs</span>
          <span className="flex items-center gap-1">
            <FileText className="h-4 w-4 text-green-500" />
            {result.document_2.filename}
            {result.document_2.year && ` (${result.document_2.year})`}
          </span>
        </div>
        <p className="text-gray-700 leading-relaxed">{result.summary}</p>
      </div>

      {/* Charts */}
      {result.charts.length > 0 && <FinancialChart charts={result.charts} />}

      {/* Key Changes */}
      {result.key_changes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Key Changes ({result.key_changes.length})
          </h3>
          {result.key_changes.map((change, i) => (
            <div
              key={i}
              className={`card border-l-4 ${CATEGORY_COLORS[change.category] || "border-l-gray-400"} py-3`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="badge bg-gray-100 text-gray-600">{change.category}</span>
                    <SignificanceBadge sig={change.significance} />
                    {change.magnitude && (
                      <span className="flex items-center gap-1 text-sm font-semibold text-gray-700">
                        <MagnitudeIcon magnitude={change.magnitude} />
                        {change.magnitude}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{change.description}</p>
                  {(change.doc_a_value || change.doc_b_value) && (
                    <div className="flex gap-4 mt-2 text-xs text-gray-500">
                      {change.doc_a_value && (
                        <span>
                          <span className="font-medium text-blue-600">Before:</span> {change.doc_a_value}
                        </span>
                      )}
                      {change.doc_b_value && (
                        <span>
                          <span className="font-medium text-green-600">After:</span> {change.doc_b_value}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Citations */}
      {result.citations.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sources</h3>
          {result.citations.map((c, i) => (
            <div key={i} className="text-xs text-gray-500 flex items-start gap-1">
              <span className="text-blue-500 font-medium flex-shrink-0">
                [{c.filename}, p.{c.page}]
              </span>
              {c.excerpt && <span className="italic truncate">"{c.excerpt}"</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
