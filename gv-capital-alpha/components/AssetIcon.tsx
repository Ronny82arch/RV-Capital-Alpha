import React, { useState } from 'react';

interface Props {
  symbol: string;
  logoUrl?: string;
  size?: number;
}

const STOCK_DOMAINS: Record<string, string> = {
  NVDA: 'nvidia.com',
  MSFT: 'microsoft.com',
  AAPL: 'apple.com',
  META: 'meta.com',
  AMZN: 'amazon.com',
  TSLA: 'tesla.com',
  QQQ: 'invesco.com',
  SPY: 'ssga.com',
  GLD: 'ssga.com',
  VWCE: 'vanguard.com',
  BND: 'vanguard.com',
  SWDA: 'ishares.com',
  AGGH: 'ishares.com',
  GOOGL: 'google.com',
  GOOG: 'google.com',
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
  NKE: 'nike.com',
  KO: 'coca-cola.com',
  PEP: 'pepsico.com',
  COST: 'costco.com',
  WMT: 'walmart.com',
  XOM: 'exxonmobil.com',
  CVX: 'chevron.com',
  CAT: 'caterpillar.com',
  GE: 'ge.com',
  PLTR: 'palantir.com',
  ARM: 'arm.com',
  INTC: 'intel.com',
  ORCL: 'oracle.com',
  CRM: 'salesforce.com',
  UBER: 'uber.com',
  ABNB: 'airbnb.com',
  DIS: 'disney.com',
  PYPL: 'paypal.com',
  SQ: 'block.xyz',
  SPOT: 'spotify.com',
};

const CRYPTO_LOGOS: Record<string, string> = {
  BTC: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=029',
  ETH: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=029',
  SOL: 'https://cryptologos.cc/logos/solana-sol-logo.svg?v=029',
  BNB: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.svg?v=029',
  ADA: 'https://cryptologos.cc/logos/cardano-ada-logo.svg?v=029',
  XRP: 'https://cryptologos.cc/logos/xrp-xrp-logo.svg?v=029',
  DOGE: 'https://cryptologos.cc/logos/dogecoin-doge-logo.svg?v=029',
  DOT: 'https://cryptologos.cc/logos/polkadot-new-dot-logo.svg?v=029',
  AVAX: 'https://cryptologos.cc/logos/avalanche-avax-logo.svg?v=029',
  LINK: 'https://cryptologos.cc/logos/chainlink-link-logo.svg?v=029',
  MATIC: 'https://cryptologos.cc/logos/polygon-matic-logo.svg?v=029',
  SHIB: 'https://cryptologos.cc/logos/shiba-inu-shib-logo.svg?v=029',
  LTC: 'https://cryptologos.cc/logos/litecoin-ltc-logo.svg?v=029',
  UNI: 'https://cryptologos.cc/logos/uniswap-uni-logo.svg?v=029',
  PEPE: 'https://cryptologos.cc/logos/pepe-pepe-logo.svg?v=029',
};

export default function AssetIcon({ symbol, logoUrl, size = 48 }: Props) {
  const s = (symbol || '').toUpperCase().trim();
  const domain = STOCK_DOMAINS[s];

  const sources: string[] = [];

  if (logoUrl && !logoUrl.includes('placeholder')) {
    sources.push(logoUrl);
  }

  if (CRYPTO_LOGOS[s]) {
    sources.push(CRYPTO_LOGOS[s]);
  }

  sources.push(`https://assets.parqet.com/logos/symbol/${s}`);
  sources.push(`https://financialmodelingprep.com/image-stock/${s}.png`);

  if (domain) {
    sources.push(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    sources.push(`https://unavatar.io/${domain}`);
  }

  sources.push(`https://api.dicebear.com/7.x/initials/svg?seed=${s}&backgroundColor=1e293b&textColor=ffffff`);

  const [srcIndex, setSrcIndex] = useState(0);
  const currentSrc = sources[Math.min(srcIndex, sources.length - 1)];

  return (
    <img
      src={currentSrc}
      alt={symbol}
      referrerPolicy="no-referrer"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: size >= 36 ? '10px' : '6px',
        objectFit: 'contain',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '2px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'inline-block',
      }}
      onError={() => {
        if (srcIndex < sources.length - 1) {
          setSrcIndex(prev => prev + 1);
        }
      }}
    />
  );
}
