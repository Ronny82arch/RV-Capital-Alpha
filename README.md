# RV Capital Alpha
### Autonomous Portfolio Engine — Target +25% annuo

Sistema AI di gestione portafoglio che monitora i mercati, genera segnali algoritmici e ti notifica su Telegram per l'esecuzione su eToro.

---

## Stack Tecnico
- **Next.js 14** (App Router)
- **Vercel** (hosting + cron jobs ogni 2h)
- **Vercel KV / Upstash Redis** (storage persistente)
- **Claude API** (analisi e reasoning dei segnali)
- **Telegram Bot API** (notifiche push)
- **Yahoo Finance + CoinGecko** (dati di mercato gratuiti)

---

## Setup in 10 minuti

### 1. Crea il bot Telegram
1. Apri Telegram, cerca `@BotFather`
2. Invia `/newbot` e segui le istruzioni
3. Copia il **token** che ti dà
4. Invia `/start` al tuo nuovo bot
5. Vai su `https://api.telegram.org/bot<TOKEN>/getUpdates` e copia il tuo `chat_id`

### 2. Configura Upstash Redis (gratuito)
1. Vai su [upstash.com](https://upstash.com) → crea account → crea database Redis
2. Copia `REST_URL` e `REST_TOKEN`

### 3. Deploy su Vercel
1. Carica questa cartella su GitHub
2. Vai su [vercel.com](https://vercel.com) → New Project → importa il repo
3. Nella sezione **Environment Variables** aggiungi:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=https://tuo-progetto.vercel.app
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
CRON_SECRET=una_stringa_random_lunga
```

4. Deploy → in 2 minuti è online

---

## Come funziona

```
Ogni 2 ore:
ALPHA scansiona 14 asset → analisi tecnica RSI/SMA/Momentum
→ Kelly Criterion determina sizing ottimale
→ Claude AI genera reasoning in italiano
→ Notifica Telegram con segnale completo

Tu:
→ Apri eToro demo → esegui l'ordine
→ Torna sull'app → premi "Eseguito" → inserisci prezzo
→ App traccia performance in tempo reale
```

---

## Asset monitorati
- **ETF**: VWCE, SPY, QQQ, GLD, XDWD
- **Azioni**: NVDA, MSFT, AAPL, META, AMZN, TSLA
- **Crypto**: BTC, ETH, SOL

---

## Matematica del sistema
- **Kelly Criterion** — sizing ottimale per ogni trade
- **Half-Kelly** — versione sicura (max 20% per trade)
- **RSI 14** — identificazione zone oversold/overbought
- **SMA 20/50** — trend following
- **Momentum 20gg** — forza del trend
- **R/R minimo 2.5:1** — take profit sempre > 2.5x stop loss
- **Modalità adattiva** — aggressiva se sotto target, conservativa se avanti
