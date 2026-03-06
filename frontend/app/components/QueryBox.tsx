"use client";

import { useState } from "react";
import { streamQuery, type QuerySource } from "@/lib/api";

interface Props {
  documentId: string;
  disabled?: boolean;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: QuerySource[];
}

export default function QueryBox({ documentId, disabled }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setLoading(true);

    const assistantIdx = messages.length + 1;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      let fullContent = "";
      let sources: QuerySource[] = [];

      for await (const chunk of streamQuery(documentId, question)) {
        if (chunk.type === "token") {
          fullContent += chunk.content;
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIdx] = { role: "assistant", content: fullContent };
            return updated;
          });
        } else if (chunk.type === "done") {
          sources = chunk.sources;
          setMessages((prev) => {
            const updated = [...prev];
            updated[assistantIdx] = { role: "assistant", content: fullContent, sources };
            return updated;
          });
        }
      }
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : "Query failed";
      setMessages((prev) => {
        const updated = [...prev];
        updated[assistantIdx] = { role: "assistant", content: `Error: ${errMsg}` };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-gray-400 text-center mt-8">
            Ask a question about this document.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-white border border-gray-200 text-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content || (loading ? "..." : "")}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-400">Sources</p>
                  {msg.sources.map((s) => (
                    <p key={s.id} className="text-xs text-gray-400 truncate">
                      {s.content}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
          placeholder={disabled ? "Document not ready..." : "Ask a question..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={disabled || loading}
        />
        <button
          type="submit"
          disabled={disabled || loading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
