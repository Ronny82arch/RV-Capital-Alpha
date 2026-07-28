"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { TbdSignal, TradingDayLog, TbdSignalStatus, calculateLiquidityMetrics, getLiquidityColor, getLiquidityWarningText, DEFAULT_CONFIG } from "@/lib/trading-by-day";
import { PortfolioState } from "@/types";

// ─── TIPI LOCALI ──────────────────────────────────────────────────────────────

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
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────

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

// ─── SIGNAL CARD ─────────────────────────────────────────────────────────────

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

// ─── GRAFICO DI ANDAMENTO TBD ──────────────────────────────────────────────────

function TbdPerformanceChart({ history }: { history: TradingDayLog[] }) {
  const chartPoints = useMemo(() => {
    if (history.length === 0) return [];
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    
    let currentCash = sorted[0]?.startingCash ?? 5000;
    const points = [{ date: 'Inizio', cash: currentCash }];
    
    sorted.forEach(log => {
      currentCash += log.realizedPnL;
      points.push({
        date: log.date.split('-').slice(1).reverse().join('/'), // DD/MM
        cash: currentCash
      });
    });
    return points;
  }, [history]);

  if (chartPoints.length < 2) {
    return (
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "16px", padding: "24px 18px", textAlign: "center", color: "#64748b", fontSize: "11px",
        fontFamily: "var(--font-mono)"
      }}>
        📈 Grafico performance disponibile dopo il primo trade.
      </div>
    );
  }

  const cashes = chartPoints.map(p => p.cash);
  const minCash = Math.min(...cashes);
  const maxCash = Math.max(...cashes);
  const cashDiff = maxCash - minCash;
  const range = cashDiff === 0 ? 100 : cashDiff;
  
  const padding = range * 0.1;
  const yMin = minCash - padding;
  const yMax = maxCash + padding;
  const yRange = yMax - yMin;

  const width = 500;
  const height = 150;
  const paddingX = 15;
  const paddingY = 15;

  const pointsSvg = chartPoints.map((p, idx) => {
    const x = paddingX + (idx / (chartPoints.length - 1)) * (width - 2 * paddingX);
    const y = height - paddingY - ((p.cash - yMin) / yRange) * (height - 2 * paddingY);
    return { x, y, ...p };
  });

  const linePath = pointsSvg.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, "");

  const areaPath = pointsSvg.length > 0 
    ? `${linePath} L ${pointsSvg[pointsSvg.length - 1].x} ${height - paddingY} L ${pointsSvg[0].x} ${height - paddingY} Z`
    : "";

  const totalReturn = chartPoints[chartPoints.length - 1].cash - chartPoints[0].cash;
  const totalReturnPct = (totalReturn / chartPoints[0].cash) * 100;
  const isUp = totalReturn >= 0;

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "16px", padding: "18px",
      display: "flex", flexDirection: "column", gap: "12px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: "10px", fontWeight: 800, color: "#475569", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Andamento Portfolio TBD
        </span>
        <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "var(--font-mono)", color: isUp ? "var(--green)" : "var(--red)" }}>
          {isUp ? "+" : ""}{totalReturn.toFixed(2)}€ ({isUp ? "+" : ""}{totalReturnPct.toFixed(1)}%)
        </span>
      </div>

      <div style={{ position: "relative", width: "100%", height: `${height}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            <linearGradient id="tbdChartGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity="0.2" />
              <stop offset="100%" stopColor={isUp ? "#10b981" : "#ef4444"} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line x1={paddingX} y1={paddingY} x2={width - paddingX} y2={paddingY} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
          <line x1={paddingX} y1={height / 2} x2={width - paddingX} y2={height / 2} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />
          <line x1={paddingX} y1={height - paddingY} x2={width - paddingX} y2={height - paddingY} stroke="rgba(255,255,255,0.04)" strokeDasharray="3,3" />

          {/* Fill Area */}
          {areaPath && <path d={areaPath} fill="url(#tbdChartGrad)" />}

          {/* Line */}
          {linePath && (
            <path
              d={linePath}
              fill="none"
              stroke={isUp ? "#10b981" : "#ef4444"}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* End Dot */}
          {pointsSvg.length > 0 && (
            <circle
              cx={pointsSvg[pointsSvg.length - 1].x}
              cy={pointsSvg[pointsSvg.length - 1].y}
              r="4"
              fill={isUp ? "#10b981" : "#ef4444"}
              stroke="var(--bg2)"
              strokeWidth="1.5"
            />
          )}
        </svg>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: "#64748b", fontFamily: "var(--font-mono)" }}>
        <span>{chartPoints[0].date}</span>
        <span>Cash: {chartPoints[chartPoints.length - 1].cash.toFixed(0)}€</span>
        <span>{chartPoints[chartPoints.length - 1].date}</span>
      </div>
    </div>
  );
}

// ─── CALENDARIO P&L ───────────────────────────────────────────────────────────

function PnlCalendar({ history }: { history: TradingDayLog[] }) {
  const logMap = new Map(history.map(l => [l.date, l]));
  const today  = new Date();
  const year   = today.getFullYear();
  const month  = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const cells: (null | string)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = new Date(year, month, i + 1);
      return d.toISOString().split("T")[0];
    }),
  ];

  const monthName = today.toLocaleString("it-IT", { month: "long", year: "numeric" });

  return (
    <div style={{
      background: "var(--bg2)",
      border: "1px solid var(--border)",
      borderRadius: "16px", padding: "20px",
    }}>
      <div style={{ marginBottom: "12px" }}>
        <span style={{ fontSize: "10px", fontWeight: 800, color: "#475569", letterSpacing: "0.15em", textTransform: "uppercase" }}>
          Calendario P&L — {monthName}
        </span>
      </div>

      {/* Header giorni */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "4px" }}>
        {["D","L","M","M","G","V","S"].map((d, i) => (
          <div key={i} style={{ textAlign: "center", fontSize: "9px", color: "#334155", fontWeight: 700 }}>{d}</div>
        ))}
      </div>

      {/* Celle giorni */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
        {cells.map((date, i) => {
          if (!date) return <div key={i} />;
          const log = logMap.get(date);
          const isToday = date === today.toISOString().split("T")[0];
          const dayNum = parseInt(date.split("-")[2]);

          let bg = "rgba(255,255,255,0.03)";
          let border = "1px solid rgba(255,255,255,0.05)";
          let textColor = "#334155";

          if (log) {
            if (log.realizedPnL > 0) {
              bg = "rgba(16,185,129,0.15)"; border = "1px solid rgba(16,185,129,0.25)"; textColor = "#10b981";
            } else if (log.realizedPnL < 0) {
              bg = "rgba(239,68,68,0.12)"; border = "1px solid rgba(239,68,68,0.2)"; textColor = "#ef4444";
            } else {
              bg = "rgba(255,255,255,0.05)"; textColor = "#64748b";
            }
          }

          if (isToday) border = "1px solid #3b82f6";

          return (
            <div
              key={i}
              title={log ? `${date}: ${log.realizedPnL >= 0 ? "+" : ""}${log.realizedPnL.toFixed(2)}€` : date}
              style={{
                background: bg, border, borderRadius: "6px",
                padding: "5px 2px", textAlign: "center",
                cursor: log ? "pointer" : "default",
              }}
            >
              <div style={{ fontSize: "9px", fontWeight: isToday ? 900 : 600, color: textColor }}>{dayNum}</div>
              {log && (
                <div style={{ fontSize: "7px", fontWeight: 800, color: textColor, marginTop: "1px" }}>
                  {log.realizedPnL >= 0 ? "+" : ""}{log.realizedPnL.toFixed(0)}€
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TAB PRINCIPALE ───────────────────────────────────────────────────────────

export default function TradingByDayTab({ tbdData, onRefresh, portfolio }: Props) {
  const [toast, setToast]     = useState<{ msg: string; ok: boolean } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [editingCapital, setEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState("");
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const editingCapitalRef = React.useRef(editingCapital);
  const editingTargetRef = React.useRef(editingTarget);

  useEffect(() => { editingCapitalRef.current = editingCapital; }, [editingCapital]);
  useEffect(() => { editingTargetRef.current = editingTarget; }, [editingTarget]);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (tbdData) {
      if (!editingCapitalRef.current) setCapitalInput(String(tbdData.config?.totalCapital ?? 5000));
      if (!editingTargetRef.current) setTargetInput(String(tbdData.config?.dailyTarget ?? 50));
    }
  }, [tbdData]);

  const handleSaveCapital = async () => {
    const val = parseFloat(capitalInput);
    if (isNaN(val) || val <= 0) {
      showToast("Valore capitale non valido", false);
      return;
    }
    if (portfolio && val > portfolio.capitalAvailable) {
      showToast(`Liquidità insufficiente (Max ${portfolio.capitalAvailable.toLocaleString()}€)`, false);
      setCapitalInput(String(portfolio.capitalAvailable));
      return;
    }
    try {
      const res = await fetch("/api/tbd/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalCapital: val }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Capitale aggiornato correttamente");
        setEditingCapital(false);
        if (onRefresh) await onRefresh();
      }
    } catch {
      showToast("Errore durante il salvataggio del capitale", false);
    }
  };

  const handleSaveTarget = async () => {
    const val = parseFloat(targetInput);
    if (isNaN(val) || val <= 0) {
      showToast("Valore target non valido", false);
      return;
    }
    try {
      const res = await fetch("/api/tbd/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTarget: val }),
      });
      const json = await res.json();
      if (json.success) {
        showToast("Target giornaliero aggiornato correttamente");
        setEditingTarget(false);
        if (onRefresh) await onRefresh();
      }
    } catch {
      showToast("Errore durante il salvataggio del target", false);
    }
  };

  const handleScan = async () => {
    setScanning(true);
    try {
      const res  = await fetch("/api/tbd/scan", { method: "POST" });
      const json = await res.json();
      if (json.circuitBreaker) {
        showToast(json.message, json.reason === "TARGET");
      } else {
        showToast(
          json.newSignals > 0
            ? `🎯 ${json.newSignals} nuovi segnali generati su ${json.scannedAssets} asset`
            : `✅ Scanner completato — nessun setup valido rilevato`,
          true,
        );
      }
      if (onRefresh) await onRefresh();
    } catch {
      showToast("Errore scanner", false);
    } finally {
      setScanning(false);
    }
  };

  const handleCloseSignal = async (
    id: string,
    status: "CLOSED_TP" | "CLOSED_SL" | "CANCELLED",
    pnl: number,
  ) => {
    try {
      const res  = await fetch(`/api/tbd/signal/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, realizedPnL: pnl }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(json.message ?? `Segnale aggiornato: ${status}`);
        if (onRefresh) await onRefresh();
      }
    } catch {
      showToast("Errore aggiornamento segnale", false);
    }
  };

  const pnl       = tbdData?.today?.realizedPnL ?? 0;
  const totalCapital = tbdData?.config?.totalCapital ?? 5000;
  const dailyTarget  = tbdData?.config?.dailyTarget ?? 50;
  const progress  = Math.max(0, Math.min(100, (pnl / dailyTarget) * 100));
  const breaker   = tbdData?.circuitBreaker;
  const signals   = tbdData?.activeSignals ?? [];
  const history   = tbdData?.history ?? [];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px", position: "relative" }}>

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{
        background: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(251,191,36,0.06) 50%, rgba(16,185,129,0.06) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "16px", padding: "20px 24px",
        display: "flex", flexDirection: "column", gap: "16px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{
              margin: 0, fontSize: "20px", fontWeight: 900, letterSpacing: "-0.5px",
              background: "linear-gradient(90deg, #f59e0b, #ef4444)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>
              ⚡ Trading by Day
            </h2>
            <div style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b", letterSpacing: "0.05em", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>Capitale:</span>
              {editingCapital ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number"
                    value={capitalInput}
                    onChange={(e) => setCapitalInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveCapital()}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "6px",
                      color: "#e2e8f0",
                      fontSize: "11px",
                      fontWeight: 800,
                      width: "80px",
                      padding: "1px 4px",
                      textAlign: "center",
                      fontFamily: "var(--font-mono, monospace)"
                    }}
                    autoFocus
                  />
                  <button onClick={handleSaveCapital} style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>Salva</button>
                  <button onClick={() => { setEditingCapital(false); setCapitalInput(String(totalCapital)); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px" }}>Annulla</button>
                </div>
              ) : (
                <b
                  onClick={() => setEditingCapital(true)}
                  title="Clicca per modificare la liquidità allocata"
                  style={{ color: "#e2e8f0", cursor: "pointer", borderBottom: "1px dashed #64748b" }}
                >
                  {totalCapital.toLocaleString()}€ ✏️
                </b>
              )}
              <span>· Target:</span>
              {editingTarget ? (
                <div style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="number"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveTarget()}
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: "6px",
                      color: "#10b981",
                      fontSize: "11px",
                      fontWeight: 800,
                      width: "60px",
                      padding: "1px 4px",
                      textAlign: "center",
                      fontFamily: "var(--font-mono, monospace)"
                    }}
                    autoFocus
                  />
                  <button onClick={handleSaveTarget} style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontSize: "11px", fontWeight: "bold" }}>Salva</button>
                  <button onClick={() => { setEditingTarget(false); setTargetInput(String(dailyTarget)); }} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "11px" }}>Annulla</button>
                </div>
              ) : (
                <b
                  onClick={() => setEditingTarget(true)}
                  title="Clicca per modificare il target giornaliero"
                  style={{ color: "#10b981", cursor: "pointer", borderBottom: "1px dashed #10b981" }}
                >
                  +{dailyTarget}€ ✏️
                </b>
              )}
              <span>• 4 Cluster Attivi</span>
            </div>
            {portfolio?.capitalAvailable !== undefined && Number(capitalInput || totalCapital) > portfolio.capitalAvailable && (
              <div style={{ fontSize: '10px', color: '#ef4444', marginTop: '6px', fontWeight: 'bold', background: 'rgba(239, 68, 68, 0.1)', padding: '6px', borderRadius: '4px' }}>
                ⚠️ Nota: Stai riservando al Trading By Day (€{Number(capitalInput || totalCapital).toLocaleString('it-IT')}) più liquidità di quanta ne hai disponibile globalmente (€{portfolio.capitalAvailable.toLocaleString('it-IT')}).
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={handleScan}
              disabled={scanning}
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '20px',
                padding: '6px 16px',
                color: '#f59e0b',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: scanning ? 'not-allowed' : 'pointer',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              {scanning ? (
                <>
                  <span className="animate-spin" style={{ display: 'inline-block', width: '10px', height: '10px', border: '2px solid #f59e0b', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  SCANSIONE...
                </>
              ) : (
                '🔍 SCANSIONA ORA'
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(245, 158, 11, 0.1)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
              <span style={{ 
                display: 'inline-block', 
                width: '8px', 
                height: '8px', 
                borderRadius: '50%', 
                background: '#f59e0b',
                boxShadow: '0 0 8px #f59e0b',
                animation: 'pulse-tbd 1.8s infinite ease-in-out'
              }} />
              <style>{`
                @keyframes pulse-tbd {
                  0% { opacity: 0.4; transform: scale(0.9); }
                  50% { opacity: 1; transform: scale(1.1); }
                  100% { opacity: 0.4; transform: scale(0.9); }
                }
              `}</style>
              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#f59e0b', letterSpacing: '0.15em', fontFamily: 'var(--font-mono)' }}>TBD SWARM LIVE</span>
            </div>
          </div>
        </div>

        {/* Progress bar target */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b", marginBottom: "6px" }}>
            <span>P&L Oggi: <b style={{ color: pnlColor(pnl), fontFamily: "var(--font-mono, monospace)" }}>
              {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}€
            </b></span>
            <span>Target: <b style={{ color: "#10b981" }}>+{dailyTarget}€</b></span>
          </div>
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: "99px", height: "8px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{
              width: `${progress}%`, height: "100%", borderRadius: "99px",
              background: pnl < 0 ? "#ef4444" : "linear-gradient(90deg, #10b981, #3b82f6)",
              transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
            }} />
          </div>
        </div>
      </div>

      {/* ── CIRCUIT BREAKER BANNER ─────────────────────────────────────── */}
      {breaker?.stopTrading && (
        <div style={{
          background: breaker.reason === "TARGET" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${breaker.reason === "TARGET" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
          borderRadius: "14px", padding: "16px 20px",
          display: "flex", alignItems: "center", gap: "12px",
        }}>
          <span style={{ fontSize: "24px" }}>{breaker.reason === "TARGET" ? "🎯" : "🛑"}</span>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 800, color: breaker.reason === "TARGET" ? "#10b981" : "#ef4444" }}>
              {breaker.reason === "TARGET" ? "TARGET GIORNALIERO RAGGIUNTO" : "MAX LOSS GIORNALIERA RAGGIUNTA"}
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "3px" }}>{breaker.message}</div>
          </div>
        </div>
      )}

      {/* ── LAYOUT PRINCIPALE ──────────────────────────────────────────── */}
      <div className="responsive-grid" style={{ alignItems: "start" }}>

        {/* Colonna sinistra: Segnali */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          
          {/* Liquidità Bar */}
          {(() => {
            const liquidity = calculateLiquidityMetrics(tbdData?.config || DEFAULT_CONFIG, tbdData?.activeSignals || []);
            return (
              <div style={{background:'var(--bg2)',border:'1px solid var(--border)',
              borderRadius:'12px',padding:'16px',marginBottom:'16px',}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'8px',fontSize:'12px'}}>
                  <span>Capitale esposto: <b>{liquidity.allocatedTotal.toFixed(2)}€</b></span>
                  <span style={{color:getLiquidityColor(liquidity.warningLevel)}}>
                    {liquidity.utilizationPct.toFixed(1)}% / 100%
                  </span>
                </div>
                <div style={{background:'rgba(255,255,255,0.05)',borderRadius:'8px',height:'6px',overflow:'hidden'}}>
                  <div style={{width:`${Math.min(100,liquidity.utilizationPct)}%`,height:'100%',
                  background:getLiquidityColor(liquidity.warningLevel),transition:'width 0.3s ease',}} />
                </div>
                {liquidity.warningLevel !== 'NORMAL' && (
                  <div style={{color:getLiquidityColor(liquidity.warningLevel),fontSize:'11px',marginTop:'8px',fontWeight:'bold'}}>
                    {getLiquidityWarningText(liquidity)}
                  </div>
                )}
              </div>
            );
          })()}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#475569", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Segnali Attivi
            </span>
            <span style={{
              fontSize: "9px", background: "rgba(245,158,11,0.1)",
              border: "1px solid rgba(245,158,11,0.2)", borderRadius: "5px",
              padding: "2px 8px", color: "#f59e0b", fontWeight: 700,
            }}>
              {signals.filter(s => ["PRE_ALERT","ACTIVE","TRIGGERED"].includes(s.status)).length} attivi
            </span>
          </div>

          {!tbdData ? (
            <div style={{ textAlign: "center", padding: "40px", color: "#334155", fontSize: "12px" }}>
              Caricamento motore speculativo...
            </div>
          ) : signals.length === 0 ? (
            <div style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "14px", padding: "40px", textAlign: "center",
            }}>
              <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔍</div>
              <div style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 600 }}>Nessun setup valido rilevato</div>
              <div style={{ fontSize: "11px", color: "#475569", marginTop: "6px" }}>
                L'algoritmo analizza i mercati H1 in background ad ogni tick
              </div>
            </div>
          ) : (
            signals.map((s) => {
              const liquidity = calculateLiquidityMetrics(tbdData?.config || DEFAULT_CONFIG, signals);
              const isBlocked = liquidity.utilizationPct >= 100;
              return (
                <div key={s.id} style={{position:'relative',opacity:isBlocked?0.5:1,
                pointerEvents:isBlocked?'none':'auto'}}>
                  {isBlocked && (
                    <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.4)',
                    borderRadius:'14px',zIndex:10,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <span style={{fontSize:'10px',fontWeight:'bold',color:'#f59e0b'}}>
                        PENDING • Liquidità insufficiente
                      </span>
                    </div>
                  )}
                  <SignalCard signal={s} onClose={handleCloseSignal} />
                </div>
              );
            })
          )}
        </div>

        {/* Colonna destra: Stats + Calendario */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Grafico Andamento TBD */}
          <TbdPerformanceChart history={history} />

          {/* Stats giornaliere */}
          <div style={{
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "16px", padding: "18px", display: "flex", flexDirection: "column", gap: "12px",
          }}>
            <span style={{ fontSize: "10px", fontWeight: 800, color: "#475569", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Statistiche Oggi
            </span>
            {[
              { label: "Trade Totali",   val: String(tbdData?.today?.totalTrades ?? 0), color: "#e2e8f0" },
              { label: "Trade Vincenti", val: String(tbdData?.today?.winningTrades ?? 0), color: "#e2e8f0" },
              {
                label: "Win Rate",
                val: tbdData?.today?.totalTrades
                  ? `${Math.round((tbdData.today.winningTrades / tbdData.today.totalTrades) * 100)}%`
                  : "—",
                color: "#e2e8f0"
              },
              { label: "Capitale",       val: `${totalCapital.toLocaleString()}€`, color: "#e2e8f0" },
              {
                label: "Guadagno/Perdita",
                val: `${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}€`,
                color: pnlColor(pnl)
              },
            ].map(item => (
              <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                <span style={{ color: "#64748b" }}>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700, fontFamily: "var(--font-mono, monospace)" }}>{item.val}</span>
              </div>
            ))}
          </div>

          {/* Calendario P&L */}
          <PnlCalendar history={history} />
        </div>
      </div>

      {/* ── TOAST ─────────────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)",
          background: toast.ok ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
          border: `1px solid ${toast.ok ? "#10b981" : "#ef4444"}`,
          color: toast.ok ? "#10b981" : "#ef4444",
          borderRadius: "12px", padding: "12px 24px",
          fontSize: "13px", fontFamily: "var(--font-mono, monospace)",
          maxWidth: "90vw", textAlign: "center", zIndex: 9999,
          animation: "fadeIn 0.2s ease",
          whiteSpace: "nowrap",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
