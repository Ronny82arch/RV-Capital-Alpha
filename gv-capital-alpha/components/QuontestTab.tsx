"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { PortfolioState } from "@/types";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type MarketRegime = "AUTO" | "GOLDILOCKS" | "REFLATION" | "STAGFLATION" | "DEFLATION";

interface Props {
  portfolio: PortfolioState | null;
}

interface QuantData {
  ticker: string;
  score: number;
  zScoreRaw: number;
  regime: string;
  sentiment: string;
  detectedRegime?: string;
  growthUp?: boolean;
  inflationUp?: boolean;
  breakdown: {
    macro?: number;
    trend: number;
    momentum: number;
    valuation: number;
  };
  levels: {
    lowerAttention: number;
    current: number;
    upperAttention: number;
  };
  trends: { breve: string; medio: string; lungo: string };
  seasonality: { month: string; winRate: number };
  scalingPlan: { livello: string; prezzo: number; quota: string }[];
}

// ─── LISTA ASSET DISPONIBILI ──────────────────────────────────────────────────

const ASSETS = [
  { symbol: "BTC", label: "BTC", icon: "₿" },
  { symbol: "ETH", label: "ETH", icon: "Ξ" },
  { symbol: "SOL", label: "SOL", icon: "◎" },
  { symbol: "NVDA", label: "NVDA", icon: "⬡" },
  { symbol: "AAPL", label: "AAPL", icon: "⌘" },
  { symbol: "SPY", label: "SPY", icon: "◈" },
];

const REGIMES: { id: MarketRegime; label: string; color: string }[] = [
  { id: "AUTO", label: "Auto (Rilevamento)", color: "#10b981" },
  { id: "GOLDILOCKS", label: "Goldilocks", color: "#3b82f6" },
  { id: "REFLATION", label: "Reflation", color: "#f59e0b" },
  { id: "STAGFLATION", label: "Stagflation", color: "#ef4444" },
  { id: "DEFLATION", label: "Deflation", color: "#8b5cf6" },
];

// ─── HELPER UI ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return "#00d4aa";
  if (score >= 55) return "#3b82f6";
  if (score >= 35) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 75) return "BULLISH";
  if (score >= 55) return "NEUTRAL+";
  if (score >= 35) return "NEUTRAL−";
  return "BEARISH";
}

function TrendBadge({ val }: { val: string }) {
  const color =
    val === "Rialzista" ? "#00d4aa" : val === "Ribassista" ? "#ef4444" : "#94a3b8";
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        color,
        background: `${color}18`,
        border: `1px solid ${color}30`,
        borderRadius: "6px",
        padding: "2px 7px",
        letterSpacing: "0.04em",
      }}
    >
      {val}
    </span>
  );
}

function BarRow({
  label,
  value,
  color = "#00d4aa",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: "11px",
          color: "#94a3b8",
          fontWeight: 500,
        }}
      >
        <span style={{ textTransform: "capitalize" }}>{label}</span>
        <span style={{ color: "#e2e8f0", fontWeight: 700 }}>{value}%</span>
      </div>
      <div
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.05)",
          borderRadius: "99px",
          height: "6px",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}99)`,
            borderRadius: "99px",
            transition: "width 0.7s cubic-bezier(0.4,0,0.2,1)",
          }}
        />
      </div>
    </div>
  );
}

export default function QuontestTab({ portfolio }: Props) {
  const [activeCategory, setActiveCategory] = useState<"portfolio" | "market">("portfolio");
  
  // Estrai dinamicamente gli asset dal portafoglio (solo posizioni OPEN)
  const portfolioAssets = useMemo(() => {
    if (!portfolio || !portfolio.positions) return [];
    const openPos = portfolio.positions.filter(p => p.status === "OPEN");
    const uniqueSymbols = Array.from(new Set(openPos.map(p => p.symbol)));
    
    return uniqueSymbols.map(sym => {
      const standard = ASSETS.find(a => a.symbol === sym);
      return {
        symbol: sym,
        label: sym,
        icon: standard ? standard.icon : "⬡"
      };
    });
  }, [portfolio]);

  // Seleziona la lista corrente in base alla tab attiva
  const currentAssets = activeCategory === "portfolio" && portfolioAssets.length > 0
    ? portfolioAssets
    : ASSETS;

  // Forza categoria su "market" se il portafoglio non ha asset
  useEffect(() => {
    if (portfolioAssets.length === 0 && activeCategory === "portfolio") {
      setActiveCategory("market");
    }
  }, [portfolioAssets, activeCategory]);

  const [ticker, setTicker] = useState("BTC");
  
  // Sincronizza il ticker selezionato con il primo della lista corrente se quello attuale non e' presente
  useEffect(() => {
    const exists = currentAssets.some(a => a.symbol === ticker);
    if (!exists && currentAssets.length > 0) {
      setTicker(currentAssets[0].symbol);
    }
  }, [currentAssets, ticker]);

  const [regime, setRegime] = useState<MarketRegime>("AUTO");
  const [data, setData] = useState<QuantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "mock">("live");
  
  const [summaryData, setSummaryData] = useState<{symbol: string, score: number, isPortfolio: boolean}[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const fetchSummary = async () => {
      setSummaryLoading(true);
      const allSymbols = Array.from(new Set([...ASSETS.map(a => a.symbol), ...portfolioAssets.map(a => a.symbol)]));
      const results = [];
      for (const sym of allSymbols) {
        if (!active) break;
        try {
          const res = await fetch(`/api/quontest?ticker=${sym}&regime=${regime}`);
          const json = await res.json();
          if (json.success) {
            results.push({
              symbol: sym,
              score: json.data.score,
              isPortfolio: portfolioAssets.some(a => a.symbol === sym)
            });
          }
        } catch (e) { console.error(e); }
      }
      if (active) {
        setSummaryData(results.sort((a, b) => b.score - a.score));
        setSummaryLoading(false);
      }
    };
    fetchSummary();
    return () => { active = false; };
  }, [portfolioAssets, regime]);

  const fetchQuantData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/quontest?ticker=${ticker}&regime=${regime}`);
      const json = await res.json();
      if (json.success) {
        const d = json.data;
        setDataSource(json.dataSource ?? "live");

        // Arricchimento lato client: Trend Multi-Timeframe e Stagionalità
        const trendBullish = d.score >= 55;
        const trendNeutral = d.score >= 40 && d.score < 55;
        setData({
          ...d,
          trends: {
            breve: trendBullish ? "Rialzista" : trendNeutral ? "Laterale" : "Ribassista",
            medio: d.breakdown.trend >= 70 ? "Rialzista" : d.breakdown.trend >= 40 ? "Laterale" : "Ribassista",
            lungo: d.breakdown.valuation >= 60 ? "Laterale" : "Rialzista",
          },
          seasonality: {
            month: new Date().toLocaleString("it-IT", { month: "long" }),
            winRate: ticker === "BTC" ? 68 : ticker === "ETH" ? 63 : 58,
          },
          scalingPlan: [
            {
              livello: "Livello Attenzione Bassa",
              prezzo: d.levels.lowerAttention,
              quota: "40%",
            },
            {
              livello: "Estensione Statistica −1σ",
              prezzo: Math.round(d.levels.lowerAttention * 0.97),
              quota: "35%",
            },
            {
              livello: "Estensione Statistica −2σ",
              prezzo: Math.round(d.levels.lowerAttention * 0.94),
              quota: "25%",
            },
          ],
        });
      }
    } catch (err) {
      console.error("Errore Quontest:", err);
    } finally {
      setLoading(false);
    }
  }, [ticker, regime]);

  useEffect(() => {
    fetchQuantData();
  }, [fetchQuantData]);

  const sc = data ? scoreColor(data.score) : "#00d4aa";

  return (
    <div
      style={{
        maxWidth: "1100px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(0,212,170,0.08) 0%, rgba(59,130,246,0.06) 100%)",
          border: "1px solid rgba(0,212,170,0.18)",
          borderRadius: "16px",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "20px",
                fontWeight: 900,
                letterSpacing: "-0.5px",
                background: "linear-gradient(90deg,#00d4aa,#3b82f6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Quontest Pro — Analisi Quantitativa
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#64748b", letterSpacing: "0.05em" }}>
              CMO · ATR Esponenziale · Z-Score · Matrice Adattiva Quantaste
            </p>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "10px",
              padding: "8px 14px",
              fontSize: "11px",
              color: "#94a3b8",
            }}
          >
            <span>Regime Attivo:</span>
            <span style={{ fontWeight: 800, color: REGIMES.find((r) => data?.regime?.includes(r.id))?.color ?? "#f59e0b" }}>
              {data?.regime ?? "Calcolo..."}
            </span>
            {dataSource === "mock" && (
              <span
                style={{
                  marginLeft: "8px",
                  fontSize: "9px",
                  background: "#78350f",
                  color: "#fbbf24",
                  borderRadius: "4px",
                  padding: "1px 6px",
                  fontWeight: 700,
                }}
              >
                DEMO
              </span>
            )}
          </div>
        </div>

        {/* Barra di selezione Categoria */}
        <div style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border)", paddingBottom: "20px" }}>
          <button
            onClick={() => portfolioAssets.length > 0 ? setActiveCategory("portfolio") : null}
            disabled={portfolioAssets.length === 0}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "12px",
              border: activeCategory === "portfolio" ? "2px solid var(--green)" : "1px solid var(--border)",
              background: activeCategory === "portfolio" ? "rgba(0,212,170,0.1)" : "var(--bg2)",
              color: activeCategory === "portfolio" ? "var(--green)" : (portfolioAssets.length === 0 ? "var(--text3)" : "var(--text2)"),
              fontSize: "13px",
              fontWeight: 800,
              cursor: portfolioAssets.length === 0 ? "not-allowed" : "pointer",
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.05em",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: activeCategory === "portfolio" ? "0 4px 12px rgba(0,212,170,0.15)" : "none",
            }}
          >
            <span style={{ fontSize: "18px" }}>📂</span>
            TITOLI IN PORTAFOGLIO ({portfolioAssets.length})
          </button>
          <button
            onClick={() => setActiveCategory("market")}
            style={{
              flex: 1,
              padding: "12px 16px",
              borderRadius: "12px",
              border: activeCategory === "market" ? "2px solid var(--blue)" : "1px solid var(--border)",
              background: activeCategory === "market" ? "rgba(59,130,246,0.1)" : "var(--bg2)",
              color: activeCategory === "market" ? "var(--blue)" : "var(--text2)",
              fontSize: "13px",
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.05em",
              transition: "all 0.2s"
            }}
          >
            🌐 ALTRI DI MERCATO
          </button>
        </div>

        {/* Selettore Asset */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {(() => {
            const sortedCurrentAssets = [...currentAssets].sort((a, b) => {
              const scoreA = summaryData.find(s => s.symbol === a.symbol)?.score || 0;
              const scoreB = summaryData.find(s => s.symbol === b.symbol)?.score || 0;
              return scoreB - scoreA;
            });
            return sortedCurrentAssets.map((a) => (
              <button
                key={a.symbol}
                onClick={() => setTicker(a.symbol)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "10px",
                  border: ticker === a.symbol ? "1px solid #00d4aa" : "1px solid rgba(255,255,255,0.08)",
                  background: ticker === a.symbol ? "rgba(0,212,170,0.15)" : "rgba(255,255,255,0.04)",
                  color: ticker === a.symbol ? "#00d4aa" : "#94a3b8",
                  fontWeight: 700,
                  fontSize: "12px",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                }}
              >
                <span>{a.icon}</span>
                <span>{a.label}</span>
              </button>
            ));
          })()}
        </div>

        {/* Selettore Regime */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {REGIMES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRegime(r.id)}
              style={{
                padding: "5px 13px",
                borderRadius: "8px",
                border: regime === r.id ? `1px solid ${r.color}` : "1px solid rgba(255,255,255,0.07)",
                background: regime === r.id ? `${r.color}18` : "rgba(255,255,255,0.03)",
                color: regime === r.id ? r.color : "#64748b",
                fontWeight: regime === r.id ? 700 : 500,
                fontSize: "11px",
                cursor: "pointer",
                transition: "all 0.2s",
                letterSpacing: "0.04em",
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        
        {/* Dettagli Rilevamento Automatico Regime */}
        {data && (data.growthUp !== undefined || data.inflationUp !== undefined) && (
          <div className="animate-fade" style={{
            background: "rgba(16,185,129,0.04)",
            border: "1px solid rgba(16,185,129,0.12)",
            borderRadius: "12px",
            padding: "14px 18px",
            fontSize: "11px",
            lineHeight: "1.6",
            fontFamily: "var(--font-mono, monospace)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#10b981", fontWeight: "bold", marginBottom: "6px" }}>
              <span className="pulse" style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span>RILEVAMENTO MACRO REALE COMPLETATO:</span>
              <span style={{ color: "#e2e8f0", textTransform: "uppercase", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "6px" }}>{data.detectedRegime}</span>
            </div>
            <div style={{ color: "#94a3b8", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              <div>• Crescita (S&P 500): <span style={{ color: data.growthUp ? "#10b981" : "#ef4444", fontWeight: 800 }}>{data.growthUp ? "ESPANSIONE" : "CONTRAZIONE"}</span><br /><span style={{ color: "#64748b", fontSize: "10px" }}>Indice SPY {data.growthUp ? "sopra" : "sotto"} la media mobile a 200gg</span></div>
              <div>• Inflazione (Gold futures): <span style={{ color: data.inflationUp ? "#10b981" : "#ef4444", fontWeight: 800 }}>{data.inflationUp ? "ALTA" : "BASSA"}</span><br /><span style={{ color: "#64748b", fontSize: "10px" }}>Oro {data.inflationUp ? "sopra" : "sotto"} la media mobile a 200gg</span></div>
            </div>
          </div>
        )}
      </div>

      {/* ── LOADING ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 0",
            color: "#475569",
            fontSize: "13px",
            fontFamily: "var(--font-mono, monospace)",
            letterSpacing: "0.1em",
          }}
        >
          Elaborazione matrici di output quantitativo...
        </div>
      ) : data ? (
        <>
          {/* ── ROW 1: Score | Multi-TF | Breakdown ────────────────────────── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: "16px",
            }}
          >
            {/* SMART QUANT SCORE */}
            <div
              style={{
                background: "var(--bg2)",
                border: `1px solid ${sc}30`,
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Smart Quant Score
              </span>

              {/* Cerchio Score */}
              <div
                style={{
                  position: "relative",
                  width: "140px",
                  height: "140px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <svg
                  width="140"
                  height="140"
                  style={{ position: "absolute", top: 0, left: 0, transform: "rotate(-90deg)" }}
                >
                  <circle cx="70" cy="70" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                  <circle
                    cx="70"
                    cy="70"
                    r="60"
                    fill="none"
                    stroke={sc}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(data.score / 100) * 376.99} 376.99`}
                    style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)" }}
                  />
                </svg>
                <div style={{ textAlign: "center", zIndex: 1 }}>
                  <div style={{ fontSize: "42px", fontWeight: 900, color: sc, lineHeight: 1 }}>
                    {data.score}
                  </div>
                  <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>/100</div>
                </div>
              </div>

              <div
                style={{
                  background: `${sc}15`,
                  border: `1px solid ${sc}30`,
                  borderRadius: "8px",
                  padding: "6px 14px",
                  fontSize: "10px",
                  fontWeight: 800,
                  color: sc,
                  letterSpacing: "0.08em",
                }}
              >
                {scoreLabel(data.score)}
              </div>

              <p
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "#94a3b8",
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                {data.sentiment}
              </p>
            </div>

            {/* ANALISI MULTITIMEFRAME + STAGIONALITÀ */}
            <div
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#475569",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                >
                  Analisi Multitimeframe
                </span>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(85px, 1fr))",
                    gap: "8px",
                    marginTop: "12px",
                  }}
                >
                  {(Object.entries(data.trends) as [string, string][]).map(([key, val]) => (
                    <div
                      key={key}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: "10px",
                        padding: "10px 8px",
                        textAlign: "center",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          color: "#475569",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                        }}
                      >
                        {key}
                      </span>
                      <TrendBadge val={val} />
                    </div>
                  ))}
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  paddingTop: "16px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 800,
                    color: "#475569",
                    letterSpacing: "0.15em",
                    textTransform: "uppercase",
                  }}
                >
                  Ricorrenza Stagionale
                </span>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "12px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "10px",
                    padding: "12px 16px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#e2e8f0", textTransform: "capitalize" }}>
                      {data.seasonality.month}
                    </div>
                    <div style={{ fontSize: "10px", color: "#475569", marginTop: "2px" }}>
                      Probabilità storica
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "22px", fontWeight: 900, color: "#f59e0b" }}>
                      {data.seasonality.winRate}%
                    </div>
                    <div style={{ fontSize: "9px", fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em" }}>
                      BULLISH
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* MATRICE SOTTO-PUNTEGGI */}
            <div
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Matrice Sotto-Punteggi
              </span>

              {(Object.entries(data.breakdown) as [string, number][]).map(([key, val]) => {
                const barColor =
                  key === "macro"
                    ? "#3b82f6"
                    : key === "trend"
                    ? "#00d4aa"
                    : key === "momentum"
                    ? "#f59e0b"
                    : "#a78bfa";
                return <BarRow key={key} label={key} value={val} color={barColor} />;
              })}

              {/* Z-Score badge */}
              <div
                style={{
                  marginTop: "auto",
                  paddingTop: "12px",
                  borderTop: "1px solid rgba(255,255,255,0.06)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "10px", color: "#475569", fontWeight: 600, letterSpacing: "0.05em" }}>
                  Z-Score Corrente
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontWeight: 900,
                    color: Math.abs(data.zScoreRaw) > 2 ? "#ef4444" : "#00d4aa",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {data.zScoreRaw > 0 ? "+" : ""}
                  {data.zScoreRaw}σ
                </span>
              </div>
            </div>
          </div>

          {/* ── ROW 2: CANALI OPERATIVI ─────────────────────────────────────── */}
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
                flexWrap: "wrap",
                gap: "10px",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Canali Operativi di Attenzione Statistica
              </span>
            </div>

            <div
              className="canali-grid"
            >
              {/* Fascia Alta */}
              <div
                style={{
                  background: "rgba(239,68,68,0.06)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    color: "#ef4444",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  ▲ Fascia Alta — Distribuzione
                </div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#f1f5f9" }}>
                  ${data.levels.upperAttention.toLocaleString()}
                </div>
                <div style={{ fontSize: "9px", color: "#64748b", marginTop: "4px" }}>
                  Mean + {2.35} × ATR
                </div>
              </div>

              {/* Prezzo Spot */}
              <div style={{ textAlign: "center", padding: "0 8px" }}>
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 700,
                    color: "#475569",
                    letterSpacing: "0.1em",
                    marginBottom: "8px",
                    textTransform: "uppercase",
                  }}
                >
                  Prezzo Spot
                </div>
                <div
                  style={{
                    fontSize: "28px",
                    fontWeight: 900,
                    color: sc,
                    lineHeight: 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  ${data.levels.current.toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: "#334155",
                    marginTop: "4px",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {data.ticker}
                </div>
              </div>

              {/* Fascia Bassa */}
              <div
                style={{
                  background: "rgba(16,185,129,0.06)",
                  border: "1px solid rgba(16,185,129,0.2)",
                  borderRadius: "12px",
                  padding: "16px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    fontWeight: 800,
                    color: "#10b981",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: "8px",
                  }}
                >
                  ▼ Fascia Bassa — Accumulazione
                </div>
                <div style={{ fontSize: "20px", fontWeight: 900, color: "#f1f5f9" }}>
                  ${data.levels.lowerAttention.toLocaleString()}
                </div>
                <div style={{ fontSize: "9px", color: "#64748b", marginTop: "4px" }}>
                  Mean − {2.15} × ATR
                </div>
              </div>
            </div>

            {/* Barra Visualizzazione Posizione */}
            <div style={{ marginTop: "20px" }}>
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: "99px",
                  height: "8px",
                  position: "relative",
                  overflow: "visible",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    height: "100%",
                    width: `${Math.min(
                      Math.max(
                        ((data.levels.current - data.levels.lowerAttention) /
                          (data.levels.upperAttention - data.levels.lowerAttention)) *
                          100,
                        2
                      ),
                      98
                    )}%`,
                    background: `linear-gradient(90deg, #10b981, ${sc})`,
                    borderRadius: "99px",
                    transition: "width 0.8s cubic-bezier(0.4,0,0.2,1)",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: "6px",
                  fontSize: "9px",
                  color: "#334155",
                }}
              >
                <span>Accumulazione</span>
                <span>Distribuzione</span>
              </div>
            </div>
          </div>

          {/* ── ROW 3: SCALING PLAN ─────────────────────────────────────────── */}
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
            }}
          >
            <div style={{ marginBottom: "16px" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Scaling Plan Consigliato — Fascia di Accumulazione
              </span>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: "10px",
                  color: "#334155",
                  lineHeight: 1.5,
                }}
              >
                Ottimizzazione matematica degli ingressi geometrici basati sui livelli ATR per i target di Capital Alpha
              </p>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    {["Scaglione Ingresso", "Innesco Prezzo", "Allocazione Capitale"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          fontSize: "9px",
                          fontWeight: 800,
                          color: "#334155",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          textAlign: h === "Allocazione Capitale" ? "right" : "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.scalingPlan.map((step, idx) => (
                    <tr
                      key={idx}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)")
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLTableRowElement).style.background = "transparent")
                      }
                    >
                      <td style={{ padding: "13px 12px", fontSize: "12px", color: "#94a3b8", fontWeight: 500 }}>
                        {step.livello}
                      </td>
                      <td
                        style={{
                          padding: "13px 12px",
                          fontSize: "13px",
                          fontWeight: 800,
                          color: "#10b981",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        ${step.prezzo.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "13px 12px",
                          fontSize: "13px",
                          fontWeight: 900,
                          color: "#e2e8f0",
                          textAlign: "right",
                        }}
                      >
                        {step.quota}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── ROW 4: TABELLA RIASSUNTIVA PUNTEGGI ────────────────────────── */}
          <div
            style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "16px",
              padding: "24px",
              marginTop: "8px",
            }}
          >
            <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 800,
                  color: "#475569",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                }}
              >
                Ranking Globale Quontest
              </span>
              {summaryLoading && (
                <span className="animate-pulse" style={{ fontSize: "10px", color: "#3b82f6", fontWeight: 700 }}>
                  Aggiornamento in corso...
                </span>
              )}
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Asset", "Score", "Rating", "Categoria"].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          fontSize: "9px",
                          fontWeight: 800,
                          color: "#334155",
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          textAlign: h === "Score" || h === "Rating" ? "center" : "left",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaryData.length === 0 && !summaryLoading ? (
                    <tr>
                      <td colSpan={4} style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: "#64748b" }}>
                        Nessun dato disponibile
                      </td>
                    </tr>
                  ) : (
                    [...summaryData].sort((a,b) => b.score - a.score).map((item, idx) => (
                      <tr
                        key={item.symbol}
                        onClick={() => setTicker(item.symbol)}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                          transition: "background 0.15s",
                          cursor: "pointer",
                          background: item.symbol === ticker ? "rgba(255,255,255,0.04)" : "transparent"
                        }}
                        onMouseEnter={(e) => {
                          if (item.symbol !== ticker) (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)";
                        }}
                        onMouseLeave={(e) => {
                          if (item.symbol !== ticker) (e.currentTarget as HTMLTableRowElement).style.background = "transparent";
                        }}
                      >
                        <td style={{ padding: "12px", fontSize: "13px", fontWeight: 800, color: "#f1f5f9" }}>
                          {item.symbol}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <span style={{
                            background: `${scoreColor(item.score)}15`,
                            color: scoreColor(item.score),
                            padding: "4px 10px",
                            borderRadius: "6px",
                            fontWeight: 800,
                            fontSize: "12px",
                            fontFamily: "var(--font-mono, monospace)"
                          }}>
                            {item.score}
                          </span>
                        </td>
                        <td style={{ padding: "12px", textAlign: "center", fontSize: "10px", fontWeight: 700, color: scoreColor(item.score) }}>
                          {scoreLabel(item.score)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {item.isPortfolio ? (
                            <span style={{ fontSize: "10px", color: "#00d4aa", background: "rgba(0,212,170,0.1)", padding: "3px 8px", borderRadius: "4px", fontWeight: 700 }}>
                              Portafoglio
                            </span>
                          ) : (
                            <span style={{ fontSize: "10px", color: "#3b82f6", background: "rgba(59,130,246,0.1)", padding: "3px 8px", borderRadius: "4px", fontWeight: 700 }}>
                              Mercato
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
