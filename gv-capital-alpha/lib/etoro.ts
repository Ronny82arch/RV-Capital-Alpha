import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';
import { getUsdToEurRate } from './market';

const ETORO_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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

function getProp(obj: any, ...keys: string[]): any {
  if (!obj) return undefined;
  for (const k of keys) {
    if (obj[k] !== undefined) return obj[k];
    const lower = k.toLowerCase();
    for (const actualKey of Object.keys(obj)) {
      if (actualKey.toLowerCase() === lower && obj[actualKey] !== undefined) {
        return obj[actualKey];
      }
    }
  }
  return undefined;
}

function isMirrorPosition(p: any, mirrorPosIds?: Set<number>): boolean {
  if (!p) return false;
  const posId = getProp(p, 'positionID', 'PositionID', 'id', 'Id');
  if (posId && mirrorPosIds && mirrorPosIds.has(Number(posId))) return true;
  const mId = getProp(p, 'mirrorID', 'MirrorID', 'parentPositionID', 'ParentPositionID');
  if (mId && mId !== 0 && mId !== '0') return true;
  const isM = getProp(p, 'isMirror', 'IsMirror');
  if (isM === true || isM === 'true') return true;
  return false;
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

// getUsdToEurRate importata da market.ts

function getPnLValue(p: any): number {
  if (!p) return 0;
  const pnlObj = getProp(p, 'unrealizedPnL', 'UnrealizedPnL', 'pnl', 'PnL');
  if (typeof pnlObj === 'number') return pnlObj;
  if (pnlObj && typeof pnlObj === 'object') {
    const val = getProp(pnlObj, 'pnL', 'PnL', 'pnl', 'value', 'Value', 'netProfit', 'NetProfit', 'unrealizedPnL', 'UnrealizedPnL');
    if (typeof val === 'number') return val;
  }
  const directPnL = getProp(p, 'unrealizedPnl', 'unrealizedPnL', 'pnL', 'PnL', 'netProfit', 'NetProfit');
  if (typeof directPnL === 'number') return directPnL;
  return 0;
}

export async function getEtoroBalance(): Promise<EtoroBalance> {
  const data = await fetchEtoroPnL();
  const portfolio = data.clientPortfolio || {};
  
  const mirrors = getProp(portfolio, 'mirrors', 'Mirrors') || [];
  const mirrorPositionIds = new Set<number>();
  let mirrorsEquity = 0;

  for (const m of mirrors) {
    const mPositions = getProp(m, 'positions', 'Positions') || [];
    for (const p of mPositions) {
      const pId = getProp(p, 'positionID', 'PositionID', 'id', 'Id');
      if (pId) mirrorPositionIds.add(Number(pId));
    }
    const mirrorVal = getProp(m, 'value', 'Value', 'equity', 'Equity', 'amount', 'Amount');
    if (mirrorVal !== undefined && mirrorVal !== null && Number(mirrorVal) > 0) {
      mirrorsEquity += Number(mirrorVal);
    } else {
      const mirrorInvested = mPositions.reduce((sum: number, p: any) => sum + (getProp(p, 'amount', 'Amount') || 0), 0);
      const mirrorPnL = mPositions.reduce((sum: number, p: any) => sum + getPnLValue(p), 0);
      const avail = getProp(m, 'availableAmount', 'AvailableAmount') || 0;
      const closedProf = getProp(m, 'closedPositionsNetProfit', 'ClosedPositionsNetProfit') || 0;
      mirrorsEquity += avail + closedProf + mirrorInvested + mirrorPnL;
    }
  }

  const rawPositions = getProp(portfolio, 'positions', 'Positions') || [];
  const manualPositions = rawPositions.filter((p: any) => !isMirrorPosition(p, mirrorPositionIds));

  const totalManualInvested = manualPositions.reduce((sum: number, p: any) => sum + (getProp(p, 'amount', 'Amount') || 0), 0);
  const totalManualPnL = manualPositions.reduce((sum: number, p: any) => sum + getPnLValue(p), 0);

  const totalInvestmentsValue = totalManualInvested + totalManualPnL;

  const officialTotalEquity = getProp(portfolio, 'totalEquity', 'TotalEquity', 'equity', 'Equity', 'accountValue', 'AccountValue') ?? getProp(data, 'totalEquity', 'TotalEquity', 'equity', 'Equity', 'accountValue', 'AccountValue');
  const officialCredit = getProp(portfolio, 'credit', 'Credit', 'availableCash', 'AvailableCash', 'cash', 'Cash') ?? getProp(data, 'credit', 'Credit', 'availableCash', 'AvailableCash');
  
  let available = getProp(portfolio, 'availableCash', 'AvailableCash', 'cash', 'Cash', 'availableAmount', 'AvailableAmount') ?? getProp(data, 'availableCash', 'AvailableCash', 'cash', 'Cash');

  if (available === undefined || available === null) {
    if (officialCredit !== undefined && officialCredit !== null) {
      available = Number(officialCredit);
    }
  }

  let equity = 0;
  if (officialTotalEquity !== undefined && officialTotalEquity !== null && Number(officialTotalEquity) > 0) {
    equity = Number(officialTotalEquity);
  } else {
    available = Number(available) || 0;
    equity = available + totalInvestmentsValue + mirrorsEquity;
  }

  const USD_TO_EUR = await getUsdToEurRate();
  const availableEur = (Number(available) || 0) * USD_TO_EUR;
  const equityEur = (Number(equity) || 0) * USD_TO_EUR;

  return {
    AvailableBalance: availableEur,
    TotalEquity: equityEur,
  };
}

export async function getEtoroPositions(): Promise<any[]> {
  const data = await fetchEtoroPnL();
  const portfolio = data.clientPortfolio || {};
  const USD_TO_EUR = await getUsdToEurRate();

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

  const mirrors = getProp(portfolio, 'mirrors', 'Mirrors') || [];
  const mirrorPositionIds = new Set<number>();
  for (const m of mirrors) {
    const mPositions = getProp(m, 'positions', 'Positions') || [];
    for (const p of mPositions) {
      const pId = getProp(p, 'positionID', 'PositionID', 'id', 'Id');
      if (pId) mirrorPositionIds.add(Number(pId));
    }
  }

  const rawPositions = getProp(portfolio, 'positions', 'Positions') || [];
  const manualPositions = rawPositions.filter((p: any) => !isMirrorPosition(p, mirrorPositionIds));

  // Concurrently fetch live prices for all unique symbols in manual positions
  let marketPriceMap = new Map<string, number>();
  try {
    const uniqueSymbols = Array.from(new Set(manualPositions.map((p: any) => {
      const instId = getProp(p, 'instrumentID', 'InstrumentID');
      const info = instrumentMap.get(instId);
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
    const instId = getProp(p, 'instrumentID', 'InstrumentID');
    const info = instrumentMap.get(instId) || {
      symbol: String(instId),
      name: `Instrument ${instId}`,
      logoUrl: `https://etoro-cdn.etorostatic.com/market-avatars/${instId}/150x150.png`,
    };
    const symbol = info.symbol;
    const isBuy = getProp(p, 'isBuy', 'IsBuy');
    const direction = isBuy ? 'BUY' : 'SELL';
    const compositeKey = `${symbol}_${direction}`;

    const capitalAllocated = (getProp(p, 'amount', 'Amount') || 0) * USD_TO_EUR;
    const units = getProp(p, 'units', 'Units') || 0;
    const openRate = getProp(p, 'openRate', 'OpenRate') || 0;
    const pnlObj = getProp(p, 'unrealizedPnL', 'UnrealizedPnL');
    const closeRate = getProp(pnlObj, 'closeRate', 'CloseRate') || openRate || 0;
    const entryDate = getProp(p, 'openDateTime', 'OpenDateTime') || new Date().toISOString();

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
      unrealizedPnl = (getProp(pnlObj, 'pnL', 'PnL') || getProp(p, 'unrealizedPnl', 'unrealizedPnL', 'PnL') || 0) * USD_TO_EUR;
      currentPriceEur = closeRate * USD_TO_EUR;
    }

    const currentValue = capitalAllocated + unrealizedPnl;

    if (!symbolMap.has(compositeKey)) {
      symbolMap.set(compositeKey, {
        id: uuidv5(`etoro_${compositeKey}`, ETORO_NAMESPACE),
        symbol,
        name: info.name,
        type: 'STOCK',
        action: direction,
        quantity: units > 0 ? units : 1,
        entryPrice: entryPriceEur,
        currentPrice: currentPriceEur,
        capitalAllocated,
        stopLoss: getProp(p, 'stopLossRate', 'StopLossRate') || 0,
        takeProfit: getProp(p, 'takeProfitRate', 'TakeProfitRate') || 0,
        entryDate,
        status: 'OPEN',
        unrealizedPnl,
        unrealizedPnlPercent: capitalAllocated > 0 ? (unrealizedPnl / capitalAllocated) * 100 : 0,
        logoUrl: info.logoUrl || `https://etoro-cdn.etorostatic.com/market-avatars/${instId}/150x150.png`,
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

  // 2. Mappa i CopyPortfolios (Mirrors)
  const mappedMirrors = mirrors.map((m: any) => {
    const mirrorPositions = getProp(m, 'positions', 'Positions') || [];
    
    const investedInCopy = mirrorPositions.reduce((sum: number, p: any) => sum + (getProp(p, 'amount', 'Amount') || 0), 0) * USD_TO_EUR;
    const pnlInCopy = mirrorPositions.reduce((sum: number, p: any) => {
      const pnlObj = getProp(p, 'unrealizedPnL', 'UnrealizedPnL');
      return sum + (getProp(pnlObj, 'pnL', 'PnL') || getProp(p, 'unrealizedPnl', 'unrealizedPnL', 'PnL') || 0);
    }, 0) * USD_TO_EUR;
    
    const avail = getProp(m, 'availableAmount', 'AvailableAmount') || 0;
    const currentValue = (avail * USD_TO_EUR) + investedInCopy + pnlInCopy;
    const initialInvestment = (getProp(m, 'initialInvestment', 'InitialInvestment') || 1) * USD_TO_EUR;
    const mId = getProp(m, 'mirrorID', 'MirrorID', 'id', 'Id') || Math.floor(Math.random() * 100000);
    const username = getProp(m, 'mirrorParentUsername', 'MirrorParentUsername', 'username') || `Mirror ${mId}`;
    const firstname = getProp(m, 'mirrorParentDisplayFirstname', 'MirrorParentDisplayFirstname', 'firstname') || username;

    return {
      id: uuidv5(`etoro_mirror_${mId}`, ETORO_NAMESPACE),
      symbol: firstname || username,
      name: `Copy: ${username}`,
      type: 'CRYPTO',
      action: 'BUY',
      quantity: 1,
      entryPrice: initialInvestment,
      currentPrice: currentValue,
      capitalAllocated: initialInvestment,
      unrealizedPnl: currentValue - initialInvestment,
      unrealizedPnlPercent: initialInvestment > 0 ? ((currentValue - initialInvestment) / initialInvestment) * 100 : 0,
      status: 'OPEN',
      entryDate: getProp(m, 'openDateTime', 'OpenDateTime') || new Date().toISOString(),
      logoUrl: getProp(m, 'mirrorParentAvatarUrl', 'MirrorParentAvatarUrl') || '/placeholder-user.jpg',
      avgOpenRate: 1,
    };
  });

  return [...mappedManual, ...mappedMirrors];
}
