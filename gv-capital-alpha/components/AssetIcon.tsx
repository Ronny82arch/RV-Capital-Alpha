import React from 'react';

interface Props {
  symbol: string;
  logoUrl?: string;
}

export default function AssetIcon({ symbol, logoUrl }: Props) {
  const s = symbol.toUpperCase();
  let url = logoUrl;
  
  if (!url) {
    url = `https://api.dicebear.com/7.x/initials/svg?seed=${s}&backgroundColor=1e293b&textColor=ffffff`;
    if (s === 'AAPL') url = 'https://logo.clearbit.com/apple.com';
    else if (s === 'TSLA') url = 'https://logo.clearbit.com/tesla.com';
    else if (s === 'JPM') url = 'https://logo.clearbit.com/jpmorganchase.com';
    else if (s === 'JNJ') url = 'https://logo.clearbit.com/jnj.com';
    else if (s === 'BTC') url = 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=029';
    else if (s === 'ETH') url = 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=029';
    else if (s === 'SPY' || s === 'GLD') url = 'https://logo.clearbit.com/ssga.com';
    else if (s === 'VWCE' || s === 'BND') url = 'https://logo.clearbit.com/vanguard.com';
    else if (s === 'SWDA' || s === 'AGGH') url = 'https://logo.clearbit.com/ishares.com';
  }

  return (
    <img 
      src={url} 
      alt={symbol} 
      referrerPolicy="no-referrer"
      style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'contain', background: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
      onError={(e) => { 
        e.currentTarget.onerror = null;
        e.currentTarget.src = `https://api.dicebear.com/7.x/initials/svg?seed=${s}&backgroundColor=1e293b&textColor=ffffff`;
      }}
    />
  );
}

