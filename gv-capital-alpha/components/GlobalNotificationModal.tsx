"use client";

import React, { useEffect, useState } from "react";

export default function GlobalNotificationModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState<{ title: string; body: string } | null>(null);

  useEffect(() => {
    // 1. Controllo se ci sono parametri URL (se l'app è stata aperta da zero)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const title = params.get("notify_title");
      const body = params.get("notify_body");
      if (title || body) {
        setContent({ title: title || "Notifica", body: body || "" });
        setIsOpen(true);
        // Pulizia URL per evitare che si riapra al refresh
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }

    // 2. Ascolto messaggi dal Service Worker (se l'app era già in background)
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === "SHOW_NOTIFICATION_MODAL") {
        setContent({
          title: event.data.payload.title,
          body: event.data.payload.body,
        });
        setIsOpen(true);
      }
    };

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", handleMessage);
    }

    return () => {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", handleMessage);
      }
    };
  }, []);

  if (!isOpen || !content) return null;

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      backdropFilter: "blur(5px)",
      zIndex: 99999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <div style={{
        background: "var(--bg2, #1e293b)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "20px",
        padding: "24px",
        width: "100%",
        maxWidth: "400px",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        animation: "slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
      }}>
        {/* Pulsante X (Chiudi) */}
        <button 
          onClick={() => setIsOpen(false)}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "rgba(255,255,255,0.1)",
            border: "none",
            color: "#fff",
            width: "32px", height: "32px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: "16px",
            fontWeight: "bold",
            transition: "all 0.2s"
          }}
        >
          ✕
        </button>

        <h3 style={{
          margin: 0, paddingRight: "30px", fontSize: "20px", fontWeight: 800, color: "#fff",
          lineHeight: 1.2
        }}>
          {content.title}
        </h3>
        
        <div style={{
          fontSize: "15px", color: "#cbd5e1", lineHeight: 1.5,
          whiteSpace: "pre-wrap"
        }}>
          {content.body}
        </div>
        
        <button 
          onClick={() => setIsOpen(false)}
          style={{
            marginTop: "8px",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            background: "linear-gradient(135deg, #3b82f6, #8b5cf6)",
            color: "#fff",
            fontWeight: 800,
            fontSize: "15px",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(59, 130, 246, 0.3)"
          }}
        >
          Ricevuto
        </button>
      </div>

      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
