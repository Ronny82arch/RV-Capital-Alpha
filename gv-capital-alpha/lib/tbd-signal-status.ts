export type TbdSignalStatus =
  | 'PRE_ALERT'
  | 'PENDING'      // segnali appena generati / in attesa di approvazione
  | 'APPROVED'     // approvati dall'operatore
  | 'ACTIVE'
  | 'TRIGGERED'
  | 'CLOSED_TP'
  | 'CLOSED_SL'
  | 'CANCELLED';
