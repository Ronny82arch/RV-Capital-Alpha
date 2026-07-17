import React from 'react';

interface Props {
  symbol: string;
  logoUrl?: string;
}

export default function AssetIcon({ symbol, logoUrl }: Props) {
  const s = symbol.toUpperCase();
  let url = logoUrl;
  
  if (!url) {
    if (s === 'BTC') url = 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=029';
    else if (s === 'ETH') url = 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=029';
    else if (s === 'SOL') url = 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=029';
    else if (s === 'BNB') url = 'https://cryptologos.cc/logos/binance-coin-bnb-logo.svg?v=029';
    else if (s === 'ADA') url = 'https://cryptologos.cc/logos/cardano-ada-logo.svg?v=029';
    else if (s === 'XRP') url = 'https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=029';
    else if (s === 'SPY' || s === 'GLD') url = 'https://logo.clearbit.com/ssga.com';
    else if (s === 'VWCE' || s === 'BND') url = 'https://logo.clearbit.com/vanguard.com';
    else if (['SWDA', 'AGGH', 'XDWD', 'EIMI', 'IUSN', 'INRG', 'USRT', 'TLT'].includes(s)) {
      url = 'https://logo.clearbit.com/ishares.com';
    } else {
      const domainMap: Record<string, string> = {
        NVDA: 'nvidia.com',
        MSFT: 'microsoft.com',
        AAPL: 'apple.com',
        META: 'meta.com',
        AMZN: 'amazon.com',
        TSLA: 'tesla.com',
        GOOGL: 'google.com',
        AMD: 'amd.com',
        AVGO: 'broadcom.com',
        ASML: 'asml.com',
        NFLX: 'netflix.com',
        SMCI: 'supermicro.com',
        JPM: 'jpmorganchase.com',
        BAC: 'bankofamerica.com',
        V: 'visa.com',
        MA: 'mastercard.com',
        GS: 'goldmansachs.com',
        COIN: 'coinbase.com',
        LLY: 'lilly.com',
        NVO: 'novonordisk.com',
        JNJ: 'jnj.com',
        UNH: 'unitedhealthgroup.com',
        MRK: 'merck.com',
        PFE: 'pfizer.com',
        'MC.PA': 'lvmh.com',
        NKE: 'nike.com',
        KO: 'coca-cola.com',
        PEP: 'pepsico.com',
        COST: 'costco.com',
        WMT: 'walmart.com',
        XOM: 'exxonmobil.com',
        CVX: 'chevron.com',
        CAT: 'caterpillar.com',
        GE: 'ge.com'
      };
      if (domainMap[s]) {
        url = `https://logo.clearbit.com/${domainMap[s]}`;
      } else {
        url = `https://api.dicebear.com/7.x/initials/svg?seed=${s}&backgroundColor=1e293b&textColor=ffffff`;
      }
    }
  }

  return (
    <img 
      src={url} 
      alt={symbol} 
      referrerPolicy="no-referrer"
      style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'cover' }}
      onError={(e) => { 
        e.currentTarget.onerror = null;
        e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${s}&backgroundColor=1e293b&textColor=ffffff`;
      }}
    />
  );
}

