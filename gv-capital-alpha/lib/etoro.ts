import { v4 as uuidv4 } from 'uuid';

export interface EtoroPosition {
  InstrumentID: number;
  IsBuy: boolean;
  Leverage: number;
  Invested: number;
  CurrentValue: number;
  OpenRate: number;
  CurrentRate: number;
  TakeProfitRate: number;
  StopLossRate: number;
}

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

export async function getEtoroBalance(): Promise<EtoroBalance> {
  const url = 'https://public-api.etoro.com/api/v1/balances';
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    console.error('eToro API Error on balances:', await res.text());
    throw new Error('Failed to fetch eToro balances');
  }

  const data = await res.json();
  // We assume the response format provides AvailableBalance and TotalEquity. 
  // According to eToro API, it might return an array or object.
  // We will map it accordingly based on standard eToro responses.
  const balance = data.Data || data;
  return {
    AvailableBalance: balance.availableCash || balance.AvailableBalance || 0,
    TotalEquity: balance.totalEquity || balance.TotalEquity || 0,
  };
}

export async function getEtoroPositions(): Promise<EtoroPosition[]> {
  const url = 'https://public-api.etoro.com/api/v1/portfolio/positions';
  const res = await fetch(url, { headers: getHeaders() });
  
  if (!res.ok) {
    console.error('eToro API Error on positions:', await res.text());
    throw new Error('Failed to fetch eToro positions');
  }

  const data = await res.json();
  // Standardizing the eToro positions array
  const positions = data.Data || data.positions || data || [];
  return positions.map((p: any) => ({
    InstrumentID: p.InstrumentID || p.instrumentId,
    IsBuy: p.IsBuy !== undefined ? p.IsBuy : p.isBuy,
    Leverage: p.Leverage || p.leverage || 1,
    Invested: p.Invested || p.investedAmount || 0,
    CurrentValue: p.CurrentValue || p.currentValue || 0,
    OpenRate: p.OpenRate || p.openRate || 0,
    CurrentRate: p.CurrentRate || p.currentRate || 0,
    TakeProfitRate: p.TakeProfitRate || p.takeProfitRate || 0,
    StopLossRate: p.StopLossRate || p.stopLossRate || 0,
  }));
}
