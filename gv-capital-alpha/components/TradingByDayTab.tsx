"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TbdSignal, TradingDayLog, calculateLiquidityMetrics, getLiquidityColor, getLiquidityWarningText, DEFAULT_CONFIG } from "@/lib/trading-by-day";
import type { TbdSignalStatus } from "@/types";
import { PortfolioState } from "@/types";
import { formatNumber } from "./providers";

// ─── TIPI LOCALI ──────────────────────────────────────────────────────────

interface TbdPageData {
  today: TradingDayLog | null;
  history: TradingDayLog[];
  activeSignals: TbdSignal[];
  circuitBreaker: {
    stopTrading: boolean;
    reason: "TARGET" | "MAX_LOSS" | "NONE";
    message: string;
  };
  config?: {
    totalCapital: number;
    dailyTarget: number;
    maxTotalRiskPercent: number;
    activeSlots: number;
    preTriggerBufferPercent: number;
  };
}

interface Props {
  tbdData?: TbdPageData | null;
  onRefresh?: () => Promise<void>;
  portfolio?: PortfolioState | null;
  onTbdScan?: () => Promise<void>;
  scanning?: boolean;
  tbdPlan?: any;
  tbdLoading?: boolean;
  onGenerateTBD?: () => Promise<void>;
}

// ─── HELPERS ──────────────────────────────────────────────────────────

function pnlColor(pnl: number) {
  if (pnl > 0) return "#10b981";
  if (pnl < 0) return "#ef4444";
  return "#64748b";
}

function statusColor(status: TbdSignalStatus) {
  const map: Record<TbdSignalStatus, string> = {
    PRE_ALERT:  "#f59e0b",
    ACTIVE:     "#3b82f6",
    TRIGGERED:  "#a78bfa",
    CLOSED_TP:  "#10b981",
    CLOSED_SL:  "#ef4444",
    CANCELLED:  "#475569",
  };
  return map[status] ?? "#64748b";
}

function formatPrice(n: number) {
  return n >= 1000
    ? n.toLocaleString("it-IT", { maximumFractionDigits: 2 })
    : n.toFixed(4);
}

function buildEtoroClipboard(s: TbdSignal): string {
  return [
    `⚡ TRADING BY DAY — ${s.asset} ${s.direction}`,
    `📊 Timeframe: ${s.timeframe}`,
    `🔔 Pre-Trigger: ${formatPrice(s.preTriggerPx)}`,
    `🎯 Entry:       ${formatPrice(s.entryPrice)}`,
    `🛑 Stop Loss:   ${formatPrice(s.stopLoss)}`,
    `✅ Take Profit: ${formatPrice(s.takeProfit)}`,
    `💰 Size:        ${s.allocatedSize}€`,
    `📈 R/R:         1:${s.riskReward}`,
    `💵 Profit att.: +${s.expectedPnL}€ | Max Loss: -${s.maxLoss}€`,
  ].join("\n");
}

// ─── SIGNAL CARD ─────────────────────────────────────────────────────────

function SignalCard({ signal, onClose }: {
  signal: TbdSignal;
  onClose: (id: string, status: "CLOSED_TP" | "CLOSED_SL" | "CANCELLED", pnl: number) => void;
}) {
  const [copied, setCopied] = useState(false);
  const isActive = ["PRE_ALERT", "ACTIVE", "TRIGGERED"].includes(signal.status);
  const sc = statusColor(signal.status);
  const isBuy = signal.direction === "BUY";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildEtoroClipboard(signal));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = buildEtoroClipboard(signal);
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{
      background: "var(--bg2)",
      border: `1px solid ${sc}40`,
      borderLeft: `3px solid ${sc}`,
      borderRadius: "14px",
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      transition: "border-color 0.2s",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{
            fontSize: "11px", fontWeight: 900, letterSpacing: "0.1em",
            background: isBuy ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${isBuy ? "#10b981" : "#ef4444"}40`,
            color: isBuy ? "#10b981" : "#ef4444",
            padding: "3px 10px", borderRadius: "6px",
          }}>
            {isBuy ? "▲ LONG" : "▼ SHORT"}
          </span>
          <span style={{ fontSize: "15px", fontWeight: 800, color: "#e2e8f0" }}>
            {signal.asset}
          </span>
          <span style={{ fontSize: "10px", color: "#475569", fontFamily: "var(--font-mono, monospace)" }}>
            {signal.timeframe}
          </span>
        </div>
        <span style={{
          fontSize: "9px", fontWeight: 800, color: sc,
          background: `${sc}15`, border: `1px solid ${sc}30`,
          borderRadius: "5px", padding: "2px 8px", letterSpacing: "0.08em",
        }}>
          {signal.status}
        </span>
      </div>

      {/* Prezzi */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "8px" }}>
        {[
          { label: "🔔 Pre-Trigger", val: formatPrice(signal.preTriggerPx), color: "#f59e0b" },
          { label: "🎯 Entry",       val: formatPrice(signal.entryPrice),    color: "#e2e8f0" },
          { label: "🛑 Stop Loss",   val: formatPrice(signal.stopLoss),      color: "#ef4444" },
          { label: "✅ Take Profit", val: formatPrice(signal.takeProfit),    color: "#10b981" },
        ].map((item) => (
          <div key={item.label} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "8px", padding: "8px 10px",
          }}>
            <div style={{ fontSize: "9px", color: "#475569", marginBottom: "4px", whiteSpace: "nowrap" }}>
              {item.label}
            </div>
            <div style={{ fontSize: "12px", fontWeight: 800, color: item.color, fontFamily: "var(--font-mono, monospace)" }}>
              {item.val}
            </div>
          </div>
        ))}
      </div>

      {/* Metriche */}
      <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: "#64748b" }}>
        <span>💰 <b style={{ color: "#e2e8f0" }}>{signal.allocatedSize}€</b> esposti</span>
        <span>📈 R/R <b style={{ color: "#a78bfa" }}>1:{signal.riskReward}</b></span>
        <span>🎁 <b style={{ color: "#10b981" }}>+{signal.expectedPnL}€</b> att.</span>
        <span>⚡ <b style={{ color: "#ef4444" }}>-{signal.maxLoss}€</b> max</span>
      </div>

      {/* Azioni */}
      {isActive && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {/* ONE-TAP COPY per eToro */}
          <button
            onClick={handleCopy}
            style={{
              flex: 2, padding: "10px 16px", borderRadius: "10px",
              border: "1px solid rgba(59,130,246,0.4)",
              background: copied ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.12)",
              color: copied ? "#10b981" : "#3b82f6",
              fontWeight: 800, fontSize: "12px", cursor: "pointer",
              transition: "all 0.2s", letterSpacing: "0.04em",
            }}
          >
            {copied ? "✅ Copiato!" : "📋 Copia per eToro"}
          </button>

          <button
            onClick={() => onClose(signal.id, "CLOSED_TP", signal.expectedPnL)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: "10px",
              border: "1px solid rgba(16,185,129,0.3)",
              background: "rgba(16,185,129,0.1)",
              color: "#10b981", fontWeight: 700, fontSize: "11px",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            TP ✅
          </button>
          <button
            onClick={() => onClose(signal.id, "CLOSED_SL", -signal.maxLoss)}
            style={{
              flex: 1, padding: "10px 8px", borderRadius: "10px",
              border: "1px solid rgba(239,68,68,0.3)",
              background: "rgba(239,68,68,0.1)",
              color: "#ef4444", fontWeight: 700, fontSize: "11px",
              cursor: "pointer", transition: "all 0.2s",
            }}
          >
            SL ❌
          </button>
          <button
            onClick={() => onClose(signal.id, "CANCELLED", 0)}
            style={{
              padding: "10px 12px", borderRadius: "10px",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "transparent",
              color: "#475569", fontWeight: 600, fontSize: "11px",
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}

// rest of file unchanged (omitted for brevity in this API call)
