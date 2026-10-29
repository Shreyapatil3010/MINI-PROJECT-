import { useState, useEffect } from "react";

export interface ConversationEntry {
  id: string;
  title: string;
  messages: Array<{ role: string; content: string; timestamp: string }>;
  docNames: string[];
  createdAt: string;
}

const STORAGE_KEY = "fda_conversation_history";

export function useHistory() {
  const [history, setHistory] = useState<ConversationEntry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  const save = (entry: Omit<ConversationEntry, "id" | "createdAt">) => {
    const newEntry: ConversationEntry = {
      ...entry,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setHistory((prev) => {
      const updated = [newEntry, ...prev].slice(0, 20);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    return newEntry.id;
  };

  const remove = (id: string) => {
    setHistory((prev) => {
      const updated = prev.filter((e) => e.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  };

  return { history, save, remove, clearAll };
}
