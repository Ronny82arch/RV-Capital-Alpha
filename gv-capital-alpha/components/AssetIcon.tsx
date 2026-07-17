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
    else if (s === 'SPY' || s === 'GLD') url = 'https://logo.clearbit.com/ssga.com';
    else if (s === 'VWCE' || s === 'BND') url = 'https://logo.clearbit.com/vanguard.com';
    else if (s === 'SWDA' || s === 'AGGH' || s === 'XDWD') url = 'https://logo.clearbit.com/ishares.com';
    else {
      const domainMap: Record<string, string> = {
        NVDA: 'nvidia.com',
        MSFT: 'microsoft.com',
        AAPL: 'apple.com',
        META: 'meta.com',
        AMZN: 'amazon.com',
        TSLA: 'tesla.com',
        JPM: 'jpmorganchase.com',
        JNJ: 'jnj.com'
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

