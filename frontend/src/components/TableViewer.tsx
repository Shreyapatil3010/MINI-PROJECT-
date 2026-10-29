import React, { useState } from "react";
import { FinancialTable } from "../services/api";
import { Table, ChevronDown, ChevronUp } from "lucide-react";

interface Props {
  tables: FinancialTable[];
  docNames?: Record<string, string>;
}

export const TableViewer: React.FC<Props> = ({ tables, docNames = {} }) => {
  const [expanded, setExpanded] = useState<number[]>([0]);

  if (!tables || tables.length === 0) return null;

  const toggle = (i: number) =>
    setExpanded((prev) =>
      prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
    );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
        <Table className="h-4 w-4" />
        Extracted Financial Tables ({tables.length})
      </h3>
      {tables.map((table, i) => {
        const isOpen = expanded.includes(i);
        const docName = docNames[table.document_id] || table.document_id;
        return (
          <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header */}
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
            >
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-700">
                  {table.title || `Table ${i + 1}`}
                </span>
                <span className="badge bg-gray-100 text-gray-500">
                  Page {table.page}
                </span>
                <span className="badge bg-blue-50 text-blue-600 text-xs">
                  {docName.length > 25 ? docName.substring(0, 25) + "..." : docName}
                </span>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {/* Table content */}
            {isOpen && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-blue-50">
                    <tr>
                      {table.headers.map((h, hi) => (
                        <th
                          key={hi}
                          className="px-4 py-2 text-left text-xs font-semibold text-blue-800 uppercase tracking-wider whitespace-nowrap"
                        >
                          {h || "-"}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {table.rows.slice(0, 20).map((row, ri) => (
                      <tr key={ri} className="hover:bg-gray-50">
                        {row.map((cell, ci) => (
                          <td
                            key={ci}
                            className={`px-4 py-2 whitespace-nowrap ${
                              ci === 0
                                ? "font-medium text-gray-800"
                                : "text-gray-600 text-right"
                            }`}
                          >
                            {cell || "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {table.rows.length > 20 && (
                      <tr>
                        <td
                          colSpan={table.headers.length}
                          className="px-4 py-2 text-center text-xs text-gray-400"
                        >
                          ... and {table.rows.length - 20} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
