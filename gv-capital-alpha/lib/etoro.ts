import { v4 as uuidv4 } from 'uuid';

export interface EtoroBalance {
  AvailableBalance: number;
  TotalEquity: number;
}

function getHeaders() {
  if (!process.env.ETORO_API_KEY || !process.env.ETORO_USER_KEY) {
    throw new Error('Missing eToro API Keys in environment variables');
  }
  return {
    'x-request-id': uuidv4(),
    'x-api-key': process.env.ETORO_API_KEY,
    'x-user-key': process.env.ETORO_USER_KEY,
    'Content-Type': 'application/json',
  };
}

async function fetchEtoroPnL(): Promise<any> {
  const headers = getHeaders();
  
  // Try real account first
  let url = 'https://public-api.etoro.com/api/v1/trading/info/real/pnl';
  try {
    const res = await fetch(url, { headers });
    if (res.ok) {
      return await res.json();
    }
    const errText = await res.clone().text();
    console.warn('Real PnL fetch returned status ' + res.status + ', trying demo:', errText);
  } catch (err: any) {
    console.warn('Real PnL fetch failed, trying demo:', err.message);
  }
  
  // Fallback to demo account
  url = 'https://public-api.etoro.com/api/v1/trading/info/demo/pnl';
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const finalErr = await res.text();
    console.error('Demo PnL fetch also failed:', finalErr);
    throw new Error('eToro API Error: ' + finalErr);
  }
  
  return await res.json();
}

export async function getEtoroBalance(): Promise<EtoroBalance> {
  const data = await fetchEtoroPnL();
  const portfolio = data.clientPortfolio || {};
  
  const positions = (portfolio.positions || []).filter((p: any) => !p.mirrorID);
  const totalInvested = positions.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const totalPnL = positions.reduce((sum: number, p: any) => sum + (p.unrealizedPnL?.pnL || p.unrealizedPnl || 0), 0);
  
  // Add mirrors equity to total equity
  const mirrors = portfolio.mirrors || [];
  let mirrorsEquity = 0;
  for (const m of mirrors) {
    const mirrorPositions = m.positions || [];
    const mirrorInvested = mirrorPositions.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
    const mirrorPnL = mirrorPositions.reduce((sum: number, p: any) => sum + (p.unrealizedPnL?.pnL || p.unrealizedPnl || 0), 0);
    mirrorsEquity += (m.availableAmount || 0) + (m.closedPositionsNetProfit || 0) + mirrorInvested + mirrorPnL;
  }

  // Calculate true available cash
  // In many eToro API responses, 'credit' represents the TOTAL EQUITY, not just free cash.
  const totalInvestmentsValue = totalInvested + totalPnL + mirrorsEquity;
  let available = portfolio.availableCash !== undefined ? portfolio.availableCash : 0;
  
  if (available === 0 && portfolio.credit !== undefined) {
    // If credit is roughly equal to or greater than invested, it's likely the Total Equity.
    if (portfolio.credit >= totalInvestmentsValue) {
      available = portfolio.credit - totalInvestmentsValue;
    } else {
      available = portfolio.credit;
    }
  }

  const equity = available + totalInvestmentsValue;

  const USD_TO_EUR = 0.92;
  const availableEur = available * USD_TO_EUR;
  const equityEur = equity * USD_TO_EUR;

  return {
    AvailableBalance: availableEur,
    TotalEquity: equityEur,
  };
}

export async function getEtoroPositions(): Promise<any[]> {
  const data = await fetchEtoroPnL();
  const portfolio = data.clientPortfolio || {};
  const USD_TO_EUR = 0.92;
  // Fetch instruments catalog to resolve symbols and names
  let instrumentMap = new Map<number, { symbol: string; name: string; logoUrl: string }>();
  try {
    const instrumentsRes = await fetch('https://public-api.etoro.com/api/v1/market-data/instruments', { headers: getHeaders() });
    if (instrumentsRes.ok) {
      const instData = await instrumentsRes.json();
      const list = instData.instrumentDisplayDatas || [];
      for (const inst of list) {
        let logoUrl = '';
        if (inst.images && inst.images.length > 0) {
          logoUrl = inst.images[0].uri || '';
        } else {
          logoUrl = `https://etoro-cdn.etorostatic.com/market-avatars/${inst.instrumentID}/150x150.png`;
        }
        instrumentMap.set(inst.instrumentID, {
          symbol: inst.symbolFull || String(inst.instrumentID),
          name: inst.instrumentDisplayName || `Instrument ${inst.instrumentID}`,
          logoUrl,
        });
      }
    }
  } catch (err: any) {
    console.error('Failed to load instrument catalog:', err.message);
  }

  // 1. Map manual positions and group them by symbol+direction
  const manualPositions = (portfolio.positions || []).filter((p: any) => !p.mirrorID);

  // Concurrently fetch live prices for all unique symbols in manual positions
  let marketPriceMap = new Map<string, number>();
  try {
    const uniqueSymbols = Array.from(new Set(manualPositions.map((p: any) => {
      const info = instrumentMap.get(p.instrumentID);
      return info ? info.symbol : null;
    }).filter(Boolean))) as string[];

    const { fetchLivePrice } = await import('./market');
    await Promise.all(uniqueSymbols.map(async (symbol) => {
      try {
        const price = await fetchLivePrice(symbol);
        if (price !== null) {
          marketPriceMap.set(symbol, price);
        }
      } catch (err: any) {
        console.error(`Failed to fetch live price for ${symbol}:`, err.message);
      }
    }));
  } catch (err: any) {
    console.error('Failed to resolve live prices:', err.message);
  }

  const symbolMap = new Map<string, any>();

  manualPositions.forEach((p: any) => {
    const info = instrumentMap.get(p.instrumentID) || {
      symbol: String(p.instrumentID),
      name: `Instrument ${p.instrumentID}`,
      logoUrl: `https://etoro-cdn.etorostatic.com/market-avatars/${p.instrumentID}/150x150.png`,
    };
    const symbol = info.symbol;
    const direction = p.isBuy ? 'BUY' : 'SELL';
    const compositeKey = `${symbol}_${direction}`;

    const capitalAllocated = (p.amount || 0) * USD_TO_EUR;
    const units = p.units || 0;
    const openRate = p.openRate || 0;
    const closeRate = p.unrealizedPnL?.closeRate || openRate || 0;
    const entryDate = p.openDateTime || new Date().toISOString();

    const livePriceEur = marketPriceMap.get(symbol);
    const entryPriceEur = openRate * USD_TO_EUR;
    let currentPriceEur = 0;
    let unrealizedPnl = 0;

    if (livePriceEur !== undefined) {
      currentPriceEur = livePriceEur;
      unrealizedPnl = direction === 'BUY'
        ? (currentPriceEur - entryPriceEur) * units
        : (entryPriceEur - currentPriceEur) * units;
    } else {
      unrealizedPnl = (p.unrealizedPnL?.pnL || 0) * USD_TO_EUR;
      currentPriceEur = closeRate * USD_TO_EUR;
    }

    const currentValue = capitalAllocated + unrealizedPnl;

    if (!symbolMap.has(compositeKey)) {
      symbolMap.set(compositeKey, {
        id: `etoro_${compositeKey}`,
        signalId: 'etoro_sync',
        symbol,
        name: info.name,
        type: 'STOCK',
        action: direction,
        quantity: units > 0 ? units : 1,
        entryPrice: entryPriceEur,
        currentPrice: currentPriceEur,
        capitalAllocated,
        stopLoss: p.stopLossRate || 0,
        takeProfit: p.takeProfitRate || 0,
        entryDate,
        status: 'OPEN',
        unrealizedPnl,
        unrealizedPnlPercent: capitalAllocated > 0 ? (unrealizedPnl / capitalAllocated) * 100 : 0,
        logoUrl: info.logoUrl || `https://etoro-cdn.etorostatic.com/market-avatars/${p.instrumentID}/150x150.png`,
        // accumulation helpers
        _totalCapital: capitalAllocated,
        _totalPnl: unrealizedPnl,
        _totalCurrentValue: currentValue,
        _totalUnits: units,
        _weightedOpenRate: openRate * units,
        _weightedCloseRate: (livePriceEur !== undefined ? (livePriceEur / USD_TO_EUR) : closeRate) * units,
      });
    } else {
      const existing = symbolMap.get(compositeKey)!;
      existing._totalCapital      += capitalAllocated;
      existing._totalPnl          += unrealizedPnl;
      existing._totalCurrentValue += currentValue;
      existing._totalUnits        += units;
      existing._weightedOpenRate  += openRate * units;
      existing._weightedCloseRate += (livePriceEur !== undefined ? (livePriceEur / USD_TO_EUR) : closeRate) * units;
      if (new Date(entryDate) < new Date(existing.entryDate)) {
        existing.entryDate = entryDate;
      }
    }
  });

  const mappedManual = Array.from(symbolMap.values()).map(pos => {
    const finalUnits = pos._totalUnits;
    pos.capitalAllocated = pos._totalCapital;
    pos.unrealizedPnl    = pos._totalPnl;
    pos.quantity         = finalUnits > 0 ? finalUnits : 1;
    pos.entryPrice       = finalUnits > 0 ? (pos._weightedOpenRate / finalUnits) * USD_TO_EUR : pos._totalCapital;
    pos.currentPrice     = finalUnits > 0 ? (pos._weightedCloseRate / finalUnits) * USD_TO_EUR : pos._totalCurrentValue;
    pos.unrealizedPnlPercent = pos._totalCapital > 0
      ? (pos._totalPnl / pos._totalCapital) * 100
      : 0;
    pos.avgOpenRate = pos._totalUnits > 0
      ? pos._weightedOpenRate / pos._totalUnits
      : 0;
    // Cleanup helpers
    delete pos._totalCapital;
    delete pos._totalPnl;
    delete pos._totalCurrentValue;
    delete pos._totalUnits;
    delete pos._weightedOpenRate;
    delete pos._weightedCloseRate;
    return pos;
  });

  // 2. Map copy trading mirrors
  const mirrors = portfolio.mirrors || [];
  const mappedMirrors = mirrors.map((m: any) => {
    const mirrorPositions = m.positions || [];
    const investedInCopy = mirrorPositions.reduce((sum: number, p: any) => sum + (p.amount || 0), 0) * USD_TO_EUR;
    const pnlInCopy = mirrorPositions.reduce((sum: number, p: any) => sum + (p.unrealizedPnL?.pnL || p.unrealizedPnl || 0), 0) * USD_TO_EUR;
    
    // (availableAmount + closedPositionsNetProfit) is in USD, needs conversion!
    const currentValue = ((m.availableAmount || 0) + (m.closedPositionsNetProfit || 0)) * USD_TO_EUR + investedInCopy + pnlInCopy;
    const initialInvestment = (m.initialInvestment || 1) * USD_TO_EUR;
    const unrealizedPnl = currentValue - initialInvestment;
    const unrealizedPnlPercent = (unrealizedPnl / initialInvestment) * 100;
    
    return {
      id: `etoro_mirror_${m.mirrorID}`,
      signalId: 'etoro_sync',
      symbol: m.parentUsername || `COPY:${m.mirrorID}`,
      name: `Copia ${m.parentUsername || m.mirrorID}`,
      type: 'STOCK',
      action: 'BUY',
      // quantity=1, currentPrice=currentValue → recalcPortfolio gives correct total
      quantity: 1,
      entryPrice: initialInvestment,
      currentPrice: currentValue,
      capitalAllocated: initialInvestment,
      stopLoss: 0,
      takeProfit: 0,
      entryDate: m.startedCopyDate || new Date().toISOString(),
      status: 'OPEN',
      unrealizedPnl,
      unrealizedPnlPercent,
    };
  });

  return [...mappedManual, ...mappedMirrors];
}
