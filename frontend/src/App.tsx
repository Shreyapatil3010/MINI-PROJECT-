import React, { useState, useEffect, useRef } from "react";
import { BarChart2, GitCompare, TrendingUp, FileText, Sun, Moon, Clock, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import "./i18n";
import { DocumentUpload } from "./components/DocumentUpload";
import { ChatInterface } from "./components/ChatInterface";
import { ComparisonView } from "./components/ComparisonView";
import { MetricsPanel } from "./components/MetricsPanel";
import { HistoryPanel } from "./components/HistoryPanel";
import { ExportButton } from "./components/ExportButton";
import { useHistory, ConversationEntry } from "./hooks/useHistory";
import {
  UploadedDocument, FinancialMetric, ComparisonResult,
  getMetrics, compareDocuments, getSuggestedQuestions,
} from "./services/api";

type Tab = "analyze" | "compare" | "metrics";

function App() {
  const { t, i18n } = useTranslation();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("analyze");
  const [metrics, setMetrics] = useState<FinancialMetric[]>([]);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [compareDocId1, setCompareDocId1] = useState("");
  const [compareDocId2, setCompareDocId2] = useState("");
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatKey, setChatKey] = useState(0);
  const [loadedHistory, setLoadedHistory] = useState<ConversationEntry | null>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const { history, save: saveHistory, remove: removeHistory, clearAll: clearHistory } = useHistory();

  const docNames: Record<string, string> = {};
  documents.forEach((d) => (docNames[d.id] = d.filename));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  useEffect(() => {
    const fetchMetrics = async () => {
      const all: FinancialMetric[] = [];
      for (const id of selectedIds) {
        try { const m = await getMetrics(id); all.push(...m); } catch {}
      }
      setMetrics(all);
    };
    if (selectedIds.length > 0) fetchMetrics(); else setMetrics([]);
  }, [selectedIds]);

  useEffect(() => {
    const fetch = async () => {
      if (selectedIds.length > 0) {
        try { const qs = await getSuggestedQuestions(selectedIds[0]); setSuggestedQuestions(qs); }
        catch {}
      } else setSuggestedQuestions([]);
    };
    fetch();
  }, [selectedIds]);

  const handleCompare = async () => {
    if (!compareDocId1 || !compareDocId2 || compareDocId1 === compareDocId2) {
      setCompareError(t("compareDocs")); return;
    }
    setCompareError(null); setIsComparing(true);
    try {
      const result = await compareDocuments(compareDocId1, compareDocId2);
      setComparisonResult(result);
    } catch (err: any) {
      setCompareError(err.response?.data?.detail || err.message);
    } finally { setIsComparing(false); }
  };

  const handleNewChat = () => {
    setChatKey((k) => k + 1);   // triggers reset in ChatInterface
  };

  const handleSaveHistory = (messages: any[], docNamesList: string[]) => {
    if (messages.length === 0) return;
    const firstMsg = messages[0]?.content || "Conversation";
    saveHistory({
      title: firstMsg.substring(0, 60) + (firstMsg.length > 60 ? "..." : ""),
      messages,
      docNames: docNamesList,
    });
  };

  const handleLoadHistory = (entry: ConversationEntry) => {
    setLoadedHistory(entry);
    setShowHistory(false);
    setActiveTab("analyze");
  };

  const toggleLanguage = () => {
    i18n.changeLanguage(i18n.language === "en" ? "hi" : "en");
  };

  const tabs = [
    { id: "analyze" as Tab, label: t("analyze"), icon: <TrendingUp className="h-4 w-4" /> },
    { id: "compare" as Tab, label: t("compare"), icon: <GitCompare className="h-4 w-4" /> },
    { id: "metrics" as Tab, label: t("metrics"), icon: <BarChart2 className="h-4 w-4" /> },
  ];

  return (
    <div className={`min-h-screen flex flex-col ${darkMode ? "bg-gray-900 text-gray-100" : "bg-gray-50 text-gray-900"}`}>

      {/* ── Header ── */}
      <header className={`border-b px-6 py-3 flex items-center justify-between sticky top-0 z-10
        ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>

        <div className="flex items-center gap-3 header-brand">
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
            <BarChart2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className={`font-bold text-lg leading-tight ${darkMode ? "text-white" : "text-gray-900"}`}>
              {t("appName")}
            </h1>
            <p className="text-xs text-gray-400">{t("appSubtitle")}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <span className="badge bg-blue-100 text-blue-700">
              {selectedIds.length} {selectedIds.length > 1 ? "docs" : "doc"} selected
            </span>
          )}

          {/* Language toggle */}
          <button
            onClick={toggleLanguage}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
              ${darkMode ? "bg-gray-700 text-blue-300 hover:bg-gray-600" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}
            title="Toggle Hindi/English"
          >
            <Languages className="h-3.5 w-3.5" />
            {i18n.language === "en" ? "हिंदी" : "English"}
          </button>

          {/* History button */}
          <button
            onClick={() => setShowHistory((v) => !v)}
            className={`relative p-2 rounded-lg transition-all duration-200
              ${darkMode ? "bg-gray-700 text-gray-300 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            title={t("history")}
          >
            <Clock className="h-4 w-4" />
            {history.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {history.length > 9 ? "9+" : history.length}
              </span>
            )}
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode((v) => !v)}
            className={`p-2 rounded-lg transition-all duration-200
              ${darkMode ? "bg-gray-700 text-yellow-400 hover:bg-gray-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
            title={darkMode ? "Light Mode" : "Dark Mode"}
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="btn-secondary text-sm flex items-center gap-1"
          >
            <FileText className="h-4 w-4" />
            {sidebarOpen ? t("hideDocuments") : t("showDocuments")}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>

        {/* ── Sidebar ── */}
        {sidebarOpen && (
          <aside className={`w-80 flex flex-col overflow-y-auto flex-shrink-0 border-r
            ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
            <div className={`p-4 border-b ${darkMode ? "border-gray-700" : "border-gray-100"}`}>
              <h2 className={`font-semibold text-sm ${darkMode ? "text-gray-200" : "text-gray-700"}`}>
                {t("documents")}
              </h2>
            </div>
            <div className="p-4 flex-1">
              <DocumentUpload
                documents={documents}
                selectedIds={selectedIds}
                onDocumentsChange={setDocuments}
                onSelectionChange={setSelectedIds}
              />
            </div>
          </aside>
        )}

        {/* ── Main ── */}
        <main className="flex-1 flex flex-col overflow-hidden">

          {/* Tabs + Export */}
          <div className={`border-b px-6 flex items-center justify-between
            ${darkMode ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`tab-btn flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? "border-blue-600 text-blue-600 active"
                      : `border-transparent hover:border-gray-300
                         ${darkMode ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"}`
                    }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </nav>
            {/* Export button */}
            <ExportButton contentRef={exportRef} filename="financial-analysis" />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden" ref={exportRef}>

            {activeTab === "analyze" && (
              <div className="tab-content h-full">
                <ChatInterface
                  selectedDocumentIds={selectedIds}
                  docNames={docNames}
                  suggestedQuestions={suggestedQuestions}
                  darkMode={darkMode}
                  loadedHistory={loadedHistory}
                  onSaveHistory={handleSaveHistory}
                  chatKey={chatKey}
                  onNewChat={handleNewChat}
                />
              </div>
            )}

            {activeTab === "compare" && (
              <div className={`tab-content h-full overflow-y-auto p-6 ${darkMode ? "bg-gray-900" : ""}`}>
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className={`card ${darkMode ? "bg-gray-800 border-gray-700" : ""}`}>
                    <h2 className={`font-semibold mb-4 flex items-center gap-2 ${darkMode ? "text-white" : "text-gray-800"}`}>
                      <GitCompare className="h-5 w-5 text-blue-600" />
                      {t("compareDocs")}
                    </h2>
                    {documents.length < 2 ? (
                      <div className="text-center py-8 text-gray-400">
                        <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>{t("uploadTwoDocs")}</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            { label: t("documentA"), val: compareDocId1, set: setCompareDocId1 },
                            { label: t("documentB"), val: compareDocId2, set: setCompareDocId2 },
                          ].map(({ label, val, set }) => (
                            <div key={label}>
                              <label className={`block text-sm font-medium mb-1 ${darkMode ? "text-gray-300" : "text-gray-600"}`}>
                                {label}
                              </label>
                              <select
                                value={val}
                                onChange={(e) => set(e.target.value)}
                                className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none
                                  ${darkMode ? "bg-gray-700 border-gray-600 text-white" : "border-gray-300"}`}
                              >
                                <option value="">{t("selectDoc")}</option>
                                {documents.map((d) => (
                                  <option key={d.id} value={d.id}>
                                    {d.filename} {d.year ? `(${d.year})` : ""}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                        {compareError && (
                          <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{compareError}</p>
                        )}
                        <button
                          onClick={handleCompare}
                          disabled={isComparing || !compareDocId1 || !compareDocId2}
                          className="btn-primary flex items-center gap-2"
                        >
                          {isComparing ? (
                            <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />{t("comparing")}</>
                          ) : (
                            <><GitCompare className="h-4 w-4" />{t("compareButton")}</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                  {comparisonResult && (
                    <div className="comparison-enter">
                      <ComparisonView result={comparisonResult} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "metrics" && (
              <div className={`tab-content h-full overflow-y-auto p-6 ${darkMode ? "bg-gray-900" : ""}`}>
                <div className="max-w-3xl mx-auto">
                  {selectedIds.length === 0 ? (
                    <div className={`card text-center py-12 ${darkMode ? "bg-gray-800 border-gray-700" : ""}`}>
                      <BarChart2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-400">{t("selectDocsMetrics")}</p>
                    </div>
                  ) : metrics.length === 0 ? (
                    <div className={`card text-center py-12 ${darkMode ? "bg-gray-800 border-gray-700" : ""}`}>
                      <p className="text-gray-400">{t("noTables")}</p>
                    </div>
                  ) : (
                    <MetricsPanel metrics={metrics} />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* History panel overlay */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onLoad={handleLoadHistory}
          onRemove={removeHistory}
          onClear={clearHistory}
          onClose={() => setShowHistory(false)}
          darkMode={darkMode}
        />
      )}
    </div>
  );
}

export default App;
