import React from "react";
import { Clock, Trash2, MessageSquare, X } from "lucide-react";
import { ConversationEntry } from "../hooks/useHistory";
import { useTranslation } from "react-i18next";

interface Props {
  history: ConversationEntry[];
  onLoad: (entry: ConversationEntry) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
  darkMode: boolean;
}

export const HistoryPanel: React.FC<Props> = ({
  history, onLoad, onRemove, onClear, onClose, darkMode,
}) => {
  const { t } = useTranslation();

  return (
    <div className={`fixed right-0 top-0 h-full w-80 shadow-2xl z-50 flex flex-col
      ${darkMode ? "bg-gray-900 border-l border-gray-700" : "bg-white border-l border-gray-200"}
    `}
    style={{ animation: "slideInRight 0.3s ease" }}>

      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b
        ${darkMode ? "border-gray-700" : "border-gray-200"}`}>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-blue-500" />
          <span className={`font-semibold text-sm ${darkMode ? "text-white" : "text-gray-800"}`}>
            {t("history")}
          </span>
          <span className="badge bg-blue-100 text-blue-700">{history.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs text-red-500 hover:text-red-700 transition-colors"
            >
              {t("clearHistory")}
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="h-10 w-10 text-gray-300 mb-3" />
            <p className={`text-sm ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
              {t("noHistory")}
            </p>
          </div>
        ) : (
          history.map((entry) => (
            <div
              key={entry.id}
              className={`p-3 rounded-xl border transition-all cursor-pointer group
                ${darkMode
                  ? "border-gray-700 hover:border-blue-500 hover:bg-gray-800"
                  : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0" onClick={() => onLoad(entry)}>
                  <p className={`text-sm font-medium truncate ${darkMode ? "text-gray-100" : "text-gray-800"}`}>
                    {entry.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400">
                      {new Date(entry.createdAt).toLocaleDateString()} · {entry.messages.length} msgs
                    </span>
                  </div>
                  {entry.docNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {entry.docNames.slice(0, 2).map((name, i) => (
                        <span key={i} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full truncate max-w-[100px]">
                          {name}
                        </span>
                      ))}
                      {entry.docNames.length > 2 && (
                        <span className="text-xs text-gray-400">+{entry.docNames.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onRemove(entry.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
