'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Captured client-side error:', error);
  }, [error]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '80vh',
      padding: '24px',
      textAlign: 'center',
      color: '#ffffff',
      background: '#090d16'
    }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
      <h2 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
        Sincronizzazione o aggiornamento in corso
      </h2>
      <p style={{ color: '#a1a1aa', fontSize: '14px', maxWidth: '400px', marginBottom: '24px' }}>
        Un componente si sta aggiornando con i nuovi dati di mercato. Fai clic su Riprova per ricaricare la vista.
      </p>
      <button
        onClick={() => reset()}
        style={{
          background: 'linear-gradient(135deg, #bef264 0%, #84cc16 100%)',
          color: '#070b14',
          border: 'none',
          padding: '12px 24px',
          borderRadius: '10px',
          fontWeight: 'bold',
          fontSize: '14px',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(132, 204, 22, 0.3)'
        }}
      >
        🔄 Riprova Ora
      </button>
    </div>
  );
}
