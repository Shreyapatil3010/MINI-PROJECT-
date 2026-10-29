import React, { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, BookOpen, AlertTriangle, PlusCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { analyzeDocuments, AnalysisResponse, ChatMessage } from "../services/api";
import { FinancialChart } from "./FinancialChart";
import { TableViewer } from "./TableViewer";
import { ConversationEntry } from "../hooks/useHistory";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  analysis?: AnalysisResponse;
  isLoading?: boolean;
}

interface Props {
  selectedDocumentIds: string[];
  docNames: Record<string, string>;
  suggestedQuestions: string[];
  darkMode?: boolean;
  loadedHistory?: ConversationEntry | null;
  onSaveHistory?: (messages: any[], docNames: string[]) => void;
  chatKey?: number;           // increment to reset chat
  onNewChat?: () => void;     // callback to trigger new chat
}

export const ChatInterface: React.FC<Props> = ({
  selectedDocumentIds, docNames, suggestedQuestions,
  darkMode = false, loadedHistory, onSaveHistory,
  chatKey = 0, onNewChat,
}) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset chat when chatKey changes (New Chat pressed)
  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [chatKey]);

  // Load history when prop changes
  useEffect(() => {
    if (loadedHistory) {
      const loaded: Message[] = loadedHistory.messages.map((m) => ({
        id: Math.random().toString(),
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.timestamp),
      }));
      setMessages(loaded);
    }
  }, [loadedHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (query?: string) => {
    const q = query || input.trim();
    if (!q || isLoading || selectedDocumentIds.length === 0) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: q, timestamp: new Date() };
    const loadingMsg: Message = { id: (Date.now()+1).toString(), role: "assistant", content: "", timestamp: new Date(), isLoading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setIsLoading(true);

    try {
      const history: ChatMessage[] = messages.map((m) => ({
        role: m.role, content: m.content, timestamp: m.timestamp.toISOString(),
      }));
      const response = await analyzeDocuments(q, selectedDocumentIds, history);
      const assistantMsg: Message = {
        id: (Date.now()+2).toString(), role: "assistant",
        content: response.answer, timestamp: new Date(), analysis: response,
      };
      const updatedMsgs = [...messages, userMsg, assistantMsg];
      setMessages((prev) => [...prev.slice(0, -1), assistantMsg]);

      // Auto-save to history after first answer
      if (onSaveHistory && messages.length === 0) {
        setTimeout(() => onSaveHistory(
          updatedMsgs.map(m => ({ role: m.role, content: m.content, timestamp: m.timestamp.toISOString() })),
          Object.values(docNames)
        ), 500);
      }
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now()+2).toString(), role: "assistant",
        content: `Error: ${err.response?.data?.detail || err.message}`, timestamp: new Date(),
      };
      setMessages((prev) => [...prev.slice(0, -1), errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const isEmpty = messages.length === 0;
  const dm = darkMode;

  return (
    <div className={`flex flex-col h-full ${dm ? "bg-gray-900" : "bg-gray-50"}`}>
      {/* New Chat bar — shows when conversation has started */}
      {messages.length > 0 && onNewChat && (
        <div className={`flex items-center justify-between px-4 py-2 border-b
          ${dm ? "bg-gray-800 border-gray-700" : "bg-blue-50 border-blue-100"}`}>
          <span className={`text-xs ${dm ? "text-gray-400" : "text-blue-600"}`}>
            {messages.filter(m => m.role === "user").length} message{messages.filter(m => m.role === "user").length !== 1 ? "s" : ""} in this conversation
          </span>
          <button
            onClick={onNewChat}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-0.5
              ${dm
                ? "bg-blue-600 text-white hover:bg-blue-500"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md"
              }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            New Chat
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4
              ${dm ? "bg-blue-900" : "bg-blue-100"}`}>
              <Sparkles className="h-8 w-8 text-blue-500 ai-sparkle" />
            </div>
            <h3 className={`text-lg font-semibold mb-2 ${dm ? "text-gray-100" : "text-gray-700"}`}>
              {t("askAnything")}
            </h3>
            <p className={`text-sm mb-6 max-w-md ${dm ? "text-gray-400" : "text-gray-400"}`}>
              {selectedDocumentIds.length === 0 ? t("uploadFirst") : t("docsReady", { count: selectedDocumentIds.length })}
            </p>
            {selectedDocumentIds.length > 0 && suggestedQuestions.length > 0 && (
              <div className="space-y-2 w-full max-w-lg">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("suggestedQuestions")}</p>
                {suggestedQuestions.slice(0, 5).map((q, i) => (
                  <button key={i} onClick={() => handleSend(q)}
                    className={`suggestion-btn w-full text-left text-sm px-4 py-2.5 rounded-lg border
                      ${dm ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-200 text-gray-600"}`}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex gap-3 msg-enter ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
                ${msg.role === "user" ? "bg-blue-600" : dm ? "bg-gray-600" : "bg-gray-700"}`}>
                {msg.role === "user" ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
              </div>
              <div className={`max-w-3xl flex flex-col gap-2 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed
                  ${msg.role === "user"
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : dm
                      ? "bg-gray-800 border border-gray-700 text-gray-100 rounded-tl-sm"
                      : "bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm"
                  }`}>
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="flex gap-1.5 items-center">
                        <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                      </div>
                      <span className="text-xs italic">{t("analyzing")}</span>
                    </div>
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                  )}
                </div>
                {msg.analysis && (
                  <div className="w-full space-y-3">
                    {msg.analysis.citations.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.analysis.citations.map((c, i) => (
                          <span key={i} className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full" title={c.excerpt || ""}>
                            <BookOpen className="h-3 w-3" />
                            {c.filename.length > 20 ? c.filename.substring(0, 20) + "..." : c.filename}, p.{c.page}
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.analysis.charts.length > 0 && <FinancialChart charts={msg.analysis.charts} />}
                    {msg.analysis.tables.length > 0 && <TableViewer tables={msg.analysis.tables} docNames={docNames} />}
                    {msg.analysis.suggestions.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{t("followUp")}</p>
                        <div className="flex flex-wrap gap-2">
                          {msg.analysis.suggestions.map((s, i) => (
                            <button key={i} onClick={() => handleSend(s)}
                              className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-full transition-colors border border-blue-200">
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <span className="text-xs text-gray-400">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {selectedDocumentIds.length === 0 && (
        <div className="mx-4 mb-2 flex items-center gap-2 text-amber-600 bg-amber-50 text-sm p-3 rounded-lg border border-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          {t("selectAtLeastOne")}
        </div>
      )}

      {/* Input */}
      <div className={`p-4 border-t ${dm ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"}`}>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedDocumentIds.length === 0 ? t("uploadPlaceholder") : t("sendPlaceholder")}
            disabled={selectedDocumentIds.length === 0 || isLoading}
            rows={2}
            className={`flex-1 resize-none border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent input-animated
              ${dm
                ? "bg-gray-800 border-gray-700 text-gray-100 placeholder-gray-500 disabled:bg-gray-900"
                : "border-gray-300 disabled:bg-gray-50 disabled:text-gray-400"
              }`}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || selectedDocumentIds.length === 0 || isLoading}
            className="btn-primary flex-shrink-0 px-4 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <p className={`text-xs mt-1.5 ml-1 ${dm ? "text-gray-500" : "text-gray-400"}`}>
          {t("pressEnter")}
        </p>
      </div>
    </div>
  );
};
