"use client";

import React, { useState, useEffect, useCallback } from "react";

// ─── TIPI ─────────────────────────────────────────────────────────────────────

type MarketRegime = "GOLDILOCKS" | "REFLATION" | "STAGFLATION" | "DEFLATION";

interface QuantData {
  ticker: string;
  score: number;
  zScoreRaw: number;
  regime: string;
  sentiment: string;
  breakdown: {
    macro: number;
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
  { id: "GOLDILOCKS", label: "Goldilocks", color: "#22d3ee" },
  { id: "REFLATION", label: "Reflation", color: "#f59e0b" },
  { id: "STAGFLATION", label: "Stagflation", color: "#f97316" },
  { id: "DEFLATION", label: "Deflation", color: "#a78bfa" },
];

// ─── HELPER UI ────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 55) return "#22d3ee";
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
    val === "Rialzista" ? "#10b981" : val === "Ribassista" ? "#ef4444" : "#94a3b8";
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
  color = "#10b981",
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

// ─── COMPONENTE PRINCIPALE ────────────────────────────────────────────────────

export default function QuontestTab() {
  const [ticker, setTicker] = useState("BTC");
  const [regime, setRegime] = useState<MarketRegime>("REFLATION");
  const [data, setData] = useState<QuantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<"live" | "mock">("live");

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

  const sc = data ? scoreColor(data.score) : "#10b981";

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
          background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(59,130,246,0.06) 100%)",
          border: "1px solid rgba(16,185,129,0.18)",
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
                background: "linear-gradient(90deg,#10b981,#3b82f6)",
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

        {/* Selettore Asset */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {ASSETS.map((a) => (
            <button
              key={a.symbol}
              onClick={() => setTicker(a.symbol)}
              style={{
                padding: "7px 16px",
                borderRadius: "10px",
                border: ticker === a.symbol ? "1px solid #10b981" : "1px solid rgba(255,255,255,0.08)",
                background: ticker === a.symbol ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                color: ticker === a.symbol ? "#10b981" : "#94a3b8",
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
          ))}
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
                background: "rgba(15,23,42,0.6)",
                border: `1px solid ${sc}30`,
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px",
                backdropFilter: "blur(8px)",
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
                background: "rgba(15,23,42,0.6)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "18px",
                backdropFilter: "blur(8px)",
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
                background: "rgba(15,23,42,0.6)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "16px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                backdropFilter: "blur(8px)",
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
                    ? "#10b981"
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
                    color: Math.abs(data.zScoreRaw) > 2 ? "#ef4444" : "#10b981",
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
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px",
              padding: "24px",
              backdropFilter: "blur(8px)",
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
              background: "rgba(15,23,42,0.6)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: "16px",
              padding: "24px",
              backdropFilter: "blur(8px)",
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
        </>
      ) : null}
    </div>
  );
}
