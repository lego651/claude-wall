"use client";

import { useRef, useState, useEffect } from "react";
import TradeCard from "./TradeCard";

const NON_TRADE_REPLY =
  "This assistant is only for logging trades. For other questions, please use the main chat.";

export default function TradeLogModal({ onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSend() {
    if (!input.trim() && !imageFile) return;
    if (isLoading) return;

    const userText = input.trim();
    const userImage = imagePreview;

    // Add user message to chat
    setMessages((prev) => [
      ...prev,
      { type: "user", text: userText, image: userImage },
    ]);
    setInput("");
    clearImage();
    setIsLoading(true);

    try {
      const formData = new FormData();
      if (userText) formData.append("message", userText);
      if (imageFile) formData.append("image", imageFile);

      const res = await fetch("/api/trade-log/parse", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (data.error === "non_trade") {
        setMessages((prev) => [
          ...prev,
          { type: "system", text: NON_TRADE_REPLY },
        ]);
      } else if (data.error) {
        setMessages((prev) => [
          ...prev,
          { type: "system", text: `Error: ${data.error}` },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { type: "trade_card", trade: data },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { type: "system", text: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">📊</span>
            <h2 className="font-black text-gray-900">Log a Trade</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl font-bold leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              <p className="font-medium">Describe your trade or upload a screenshot.</p>
              <p className="text-xs mt-1">e.g. "Bought EURUSD at 1.0850, SL 1.0820, TP 1.0920"</p>
            </div>
          )}

          {messages.map((msg, i) => {
            if (msg.type === "user") {
              return (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[80%] space-y-2">
                    {msg.image && (
                      <img
                        src={msg.image}
                        alt="Uploaded"
                        className="rounded-xl max-h-40 object-contain ml-auto"
                      />
                    )}
                    {msg.text && (
                      <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5">
                        {msg.text}
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            if (msg.type === "system") {
              return (
                <div key={i} className="flex justify-start">
                  <div className="bg-gray-100 text-gray-600 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[80%]">
                    {msg.text}
                  </div>
                </div>
              );
            }

            if (msg.type === "trade_card") {
              return (
                <div key={i} className="flex justify-start">
                  <TradeCard trade={msg.trade} />
                </div>
              );
            }

            return null;
          })}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-400 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5">
                <span className="animate-pulse">Analyzing…</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Image preview strip */}
        {imagePreview && (
          <div className="px-4 pb-2 flex items-center gap-2">
            <div className="relative">
              <img
                src={imagePreview}
                alt="Preview"
                className="h-14 w-14 object-cover rounded-lg border border-gray-200"
              />
              <button
                onClick={clearImage}
                className="absolute -top-1.5 -right-1.5 bg-gray-800 text-white rounded-full w-4 h-4 text-xs flex items-center justify-center leading-none"
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* Input row */}
        <div className="px-4 pb-4 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-200">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your trade…"
              className="flex-1 bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
              disabled={isLoading}
            />

            {/* Camera / file button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              aria-label="Attach image"
              disabled={isLoading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageChange}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={isLoading || (!input.trim() && !imageFile)}
              className="bg-indigo-600 text-white rounded-xl px-3 py-1.5 text-sm font-bold hover:bg-indigo-700 transition-colors disabled:opacity-40"
              aria-label="Send"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
