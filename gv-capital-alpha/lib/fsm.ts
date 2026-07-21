export type SignalState = 
  | 'DRAFT' 
  | 'RISK_CHECK_PASSED' 
  | 'CANCELLED' 
  | 'TRIGGERED' 
  | 'EXECUTED' 
  | 'CLOSED';

export interface TradingSignalFSM {
  id: string;
  ticker: string;
  state: SignalState;
  requestedPrice?: number; // Prezzo teorico dal backtester
  executedPrice?: number;  // Prezzo reale dal broker
  kellyAllocation?: number;
}

export class SignalStateMachine {
  /**
   * Avvia la macchina a stati per un nuovo segnale.
   */
  static create(ticker: string, requestedPrice: number): TradingSignalFSM {
    return {
      id: crypto.randomUUID(),
      ticker,
      state: 'DRAFT',
      requestedPrice
    };
  }

  /**
   * DRAFT -> RISK_CHECK_PASSED (o CANCELLED se Kelly <= 0)
   */
  static evaluateRisk(signal: TradingSignalFSM, kellyAllocation: number): TradingSignalFSM {
    if (signal.state !== 'DRAFT') throw new Error(`Invalid state transition from ${signal.state} to RISK_CHECK`);
    
    if (kellyAllocation > 0) {
      return { ...signal, state: 'RISK_CHECK_PASSED', kellyAllocation };
    } else {
      return { ...signal, state: 'CANCELLED', kellyAllocation: 0 };
    }
  }

  /**
   * RISK_CHECK_PASSED -> TRIGGERED
   */
  static triggerExecution(signal: TradingSignalFSM): TradingSignalFSM {
    if (signal.state !== 'RISK_CHECK_PASSED') throw new Error(`Invalid state transition from ${signal.state} to TRIGGERED`);
    return { ...signal, state: 'TRIGGERED' };
  }

  /**
   * TRIGGERED -> EXECUTED
   * Registra il prezzo reale di esecuzione e scatena l'analisi TCA.
   */
  static async confirmExecution(signal: TradingSignalFSM, executedPrice: number): Promise<TradingSignalFSM> {
    if (signal.state !== 'TRIGGERED') throw new Error(`Invalid state transition from ${signal.state} to EXECUTED`);
    
    const executedSignal = { ...signal, state: 'EXECUTED' as SignalState, executedPrice };
    
    // TCA Feedback Loop asincrono
    await this.processTCAFeedbackLoop(executedSignal);
    
    return executedSignal;
  }

  /**
   * EXECUTED -> CLOSED
   */
  static closePosition(signal: TradingSignalFSM): TradingSignalFSM {
    if (signal.state !== 'EXECUTED') throw new Error(`Invalid state transition from ${signal.state} to CLOSED`);
    return { ...signal, state: 'CLOSED' };
  }

  /**
   * Gestisce la Transaction Cost Analysis (TCA).
   * Se lo slippage medio degli ultimi 20 trade è > 0.15%, aggiorna il parametro nel DB.
   */
  private static async processTCAFeedbackLoop(signal: TradingSignalFSM) {
    if (!signal.requestedPrice || !signal.executedPrice) return;
    
    // Lo slippage è la differenza percentuale tra il prezzo richiesto e quello ottenuto.
    // Esempio: se volevo comprare a 100 e ho comprato a 101, slippage = 1%
    const slippage = Math.abs((signal.executedPrice - signal.requestedPrice) / signal.requestedPrice);
    
    console.log(`[TCA] Trade su ${signal.ticker} eseguito. Slippage calcolato: ${(slippage * 100).toFixed(4)}%`);
    
    // TODO: Recuperare gli ultimi 20 slippage per questo ticker dal DB Supabase
    // TODO: Se average(slippage) > 0.0015 (0.15%), aggiornare il transaction_cost della strategia per questo ticker su Supabase.
    // L'implementazione reale dipenderà dal modulo Supabase.
  }
}
