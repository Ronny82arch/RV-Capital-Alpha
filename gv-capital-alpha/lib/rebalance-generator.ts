// lib/rebalance-generator.ts
export interface RebalanceAction {
  id: string;
  type: 'BUY' | 'SELL';
  symbol: string;
  name: string;
  category: 'CORE' | 'SATELLITE' | 'TBD';
  reason: string;
  amount: number;        // euro da muovere
  quantity: number;      // azioni/quote
  price: number;         // prezzo riferimento
  urgency: 'IMMEDIATE' | 'WITHIN_24H' | 'WITHIN_WEEK';
  source: 'ANTIGRAVITY_REBALANCE';
  quontestScore: number;
  regimeAlignment: string;
  expectedReturn: number;
  stopLoss?: number;
  takeProfit?: number;
}

export interface RebalancePlan {
  actions: RebalanceAction[];
  summary: {
    totalBuy: number;
    totalSell: number;
    netCashFlow: number;
    coreDelta: number;
    satelliteDelta: number;
    tbdDelta: number;
  };
  regime: string;
  status: string;
}

// ─── UNIVERSO INVESTIBILE CON SCORE QUONTEST ─────────────────────────────────
export const ASSET_UNIVERSE = [
  // CORE — difensivo, diversificato
  { symbol: 'VWCE',  name: 'Vanguard FTSE All-World',       category: 'CORE' as const, price: 105.20, quontestScore: 82, regimeAlignment: 'DEFENSIVE_GROWTH' },
  { symbol: 'VUAA',  name: 'Vanguard S&P 500',              category: 'CORE' as const, price: 85.40,  quontestScore: 88, regimeAlignment: 'GROWTH' },
  { symbol: 'AGGH',  name: 'iShares Global Aggregate Bond', category: 'CORE' as const, price: 4.95,   quontestScore: 75, regimeAlignment: 'DEFENSIVE' },
  { symbol: 'EUNH',  name: 'iShares Core MSCI Europe',      category: 'CORE' as const, price: 62.30,  quontestScore: 78, regimeAlignment: 'DEFENSIVE_GROWTH' },
  { symbol: 'SGLD',  name: 'iShares Physical Gold',         category: 'CORE' as const, price: 18.50,  quontestScore: 70, regimeAlignment: 'SAFE_HAVEN' },
  // SATELLITE — settoriale, tematico
  { symbol: 'QQQ',   name: 'Invesco QQQ Trust',             category: 'SATELLITE' as const, price: 495.00, quontestScore: 85, regimeAlignment: 'GROWTH_CYCLICAL' },
  { symbol: 'SMH',   name: 'VanEck Semiconductor ETF',      category: 'SATELLITE' as const, price: 245.80, quontestScore: 72, regimeAlignment: 'CYCLICAL' },
  { symbol: 'XLK',   name: 'Technology Select Sector',      category: 'SATELLITE' as const, price: 220.50, quontestScore: 80, regimeAlignment: 'GROWTH' },
  { symbol: 'XLV',   name: 'Health Care Select Sector',     category: 'SATELLITE' as const, price: 145.20, quontestScore: 76, regimeAlignment: 'DEFENSIVE_GROWTH' },
  { symbol: 'XLU',   name: 'Utilities Select Sector',       category: 'SATELLITE' as const, price: 72.40,  quontestScore: 68, regimeAlignment: 'DEFENSIVE' },
  // TBD — singole azioni, crypto, speculativo
  { symbol: 'AAPL',  name: 'Apple Inc.',                    category: 'TBD' as const, price: 225.50, quontestScore: 70, regimeAlignment: 'GROWTH' },
  { symbol: 'NVDA',  name: 'NVIDIA Corp.',                  category: 'TBD' as const, price: 120.80, quontestScore: 68, regimeAlignment: 'CYCLICAL' },
  { symbol: 'TSLA',  name: 'Tesla Inc.',                    category: 'TBD' as const, price: 250.00, quontestScore: 55, regimeAlignment: 'CYCLICAL' },
  { symbol: 'COIN',  name: 'Coinbase Global',               category: 'TBD' as const, price: 195.40, quontestScore: 45, regimeAlignment: 'SPECULATIVE' },
  { symbol: 'MSTR',  name: 'MicroStrategy',                 category: 'TBD' as const, price: 180.20, quontestScore: 42, regimeAlignment: 'SPECULATIVE' },
];

// ─── REGIME FILTER ───────────────────────────────────────────────────────────
function filterByRegime(
  assets: typeof ASSET_UNIVERSE,
  status: string
): typeof ASSET_UNIVERSE {
  if (status === 'PROTECTION') {
    // In protezione: solo asset difensivi e safe haven
    return assets.filter(a =>
      a.regimeAlignment.includes('DEFENSIVE') ||
      a.regimeAlignment.includes('SAFE')
    );
  }
  if (status === 'EXPANDED') {
    // In espansione: preferisci growth e cyclical
    return assets.filter(a =>
      a.regimeAlignment.includes('GROWTH') ||
      a.regimeAlignment.includes('CYCLICAL')
    ).sort((a, b) => b.quontestScore - a.quontestScore);
  }
  if (status === 'COOLDOWN') {
    // In cooldown: riduci cyclical, aumenta difensivo
    return assets.filter(a => !a.regimeAlignment.includes('SPECULATIVE'));
  }
  return assets;
}

// ─── GENERATORE PRINCIPALE ───────────────────────────────────────────────────
export function generateRebalanceActions(
  portfolio: any,
  agState: any,
  marketRegime: string = 'Goldilocks'
): RebalancePlan {
  const positions = portfolio.positions || [];
  const totalValue = portfolio.totalValue || 0;
  const capitalAvailable = portfolio.capitalAvailable || 0;

  // 1. Valore attuale per categoria
  const current = { CORE: 0, SATELLITE: 0, TBD: 0 };
  positions.forEach((pos: any) => {
    const cat = (pos.portfolio || 'CORE').toUpperCase();
    if (cat in current) current[cat as keyof typeof current] += (pos.capitalAllocated || 0);
  });

  // 2. Target value
  const corePct = agState.coreTargetPct ?? 70;
  const satPct = agState.satelliteTargetPct ?? 30;
  const tbdPct = agState.tbdTargetPct ?? 0;

  const target = {
    CORE: totalValue * (corePct / 100),
    SATELLITE: totalValue * (satPct / 100),
    TBD: totalValue * (tbdPct / 100),
  };

  // 3. Delta (quanto manca o avanza)
  const delta = {
    CORE: target.CORE - current.CORE,
    SATELLITE: target.SATELLITE - current.SATELLITE,
    TBD: target.TBD - current.TBD,
  };

  const actions: RebalanceAction[] = [];
  const regime = marketRegime || agState.status || 'NORMAL';

  // 4. SELL — surplus (vendi i peggiori per Quontest score)
  (['CORE', 'SATELLITE', 'TBD'] as const).forEach(cat => {
    if (delta[cat] < -100) { // surplus > 100€
      const surplus = Math.abs(delta[cat]);
      const catPositions = positions
        .filter((p: any) => (p.portfolio || 'CORE').toUpperCase() === cat)
        .sort((a: any, b: any) => (a.quontestScore || 50) - (b.quontestScore || 50)); // vendi i peggiori

      let remaining = surplus;
      for (const pos of catPositions) {
        if (remaining <= 50) break;
        const posValue = (pos.quantity || 0) * (pos.currentPrice || pos.entryPrice || 1);
        const sellAmount = Math.min(remaining, posValue * 0.9); // max 90% della posizione
        const qty = Math.floor(sellAmount / (pos.currentPrice || pos.entryPrice || 1));
        
        if (qty > 0 && sellAmount >= 50) {
          actions.push({
            id: `reb_sell_${Date.now()}_${pos.symbol}`,
            type: 'SELL',
            symbol: pos.symbol,
            name: pos.name,
            category: cat,
            reason: `${cat} in SURPLUS di €${surplus.toFixed(0)}. Vendo ${pos.symbol} (score Quontest: ${pos.quontestScore || 'N/A'}) per allinearmi al target ${(agState as any)[`${cat.toLowerCase()}TargetPct`] || 0}%.`,
            amount: sellAmount,
            quantity: qty,
            price: pos.currentPrice || pos.entryPrice || 0,
            urgency: agState.status === 'PROTECTION' ? 'IMMEDIATE' : 'WITHIN_24H',
            source: 'ANTIGRAVITY_REBALANCE',
            quontestScore: pos.quontestScore || 50,
            regimeAlignment: regime,
            expectedReturn: 0,
          });
          remaining -= sellAmount;
        }
      }
    }
  });

  // 5. BUY — deficit (compra i migliori per Quontest score, filtrati per regime)
  (['CORE', 'SATELLITE', 'TBD'] as const).forEach(cat => {
    if (delta[cat] > 100) { // deficit > 100€
      const deficit = delta[cat];
      const candidates = filterByRegime(
        ASSET_UNIVERSE.filter(a => a.category === cat),
        agState.status
      ).sort((a, b) => b.quontestScore - a.quontestScore);

      let remaining = deficit;
      for (const asset of candidates) {
        if (remaining <= 50) break;
        const buyAmount = Math.min(remaining, Math.max(300, deficit / Math.min(candidates.length, 3)));
        const qty = Math.floor(buyAmount / asset.price);
        
        if (qty > 0 && buyAmount >= 50) {
          actions.push({
            id: `reb_buy_${Date.now()}_${asset.symbol}`,
            type: 'BUY',
            symbol: asset.symbol,
            name: asset.name,
            category: cat,
            reason: `${cat} in DEFICIT di €${deficit.toFixed(0)}. Compro ${asset.symbol} (score Quontest: ${asset.quontestScore}/100, allineamento: ${asset.regimeAlignment}) per raggiungere target ${(agState as any)[`${cat.toLowerCase()}TargetPct`] || 0}% — Regime: ${regime}.`,
            amount: buyAmount,
            quantity: qty,
            price: asset.price,
            urgency: agState.status === 'PROTECTION' ? 'IMMEDIATE' : 'WITHIN_24H',
            source: 'ANTIGRAVITY_REBALANCE',
            quontestScore: asset.quontestScore,
            regimeAlignment: asset.regimeAlignment,
            expectedReturn: (asset.quontestScore / 100) * (agState.status === 'EXPANDED' ? 20 : 12),
            stopLoss: asset.price * (agState.status === 'PROTECTION' ? 0.97 : 0.95),
            takeProfit: asset.price * (agState.status === 'EXPANDED' ? 1.20 : 1.12),
          });
          remaining -= buyAmount;
        }
      }
    }
  });

  return {
    actions,
    summary: {
      totalBuy: actions.filter(a => a.type === 'BUY').reduce((s, a) => s + a.amount, 0),
      totalSell: actions.filter(a => a.type === 'SELL').reduce((s, a) => s + a.amount, 0),
      netCashFlow: actions.filter(a => a.type === 'SELL').reduce((s, a) => s + a.amount, 0) -
                   actions.filter(a => a.type === 'BUY').reduce((s, a) => s + a.amount, 0),
      coreDelta: delta.CORE,
      satelliteDelta: delta.SATELLITE,
      tbdDelta: delta.TBD,
    },
    regime,
    status: agState.status,
  };
}
