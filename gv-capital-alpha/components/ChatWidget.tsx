'use client';
import { useState, useRef, useEffect } from 'react';
import { PortfolioState, MarketData } from '@/types';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    portfolio: PortfolioState | null;
    market: MarketData[];
}

export default function ChatWidget({ isOpen, onClose, portfolio, market }: Props) {
    const [messages, setMessages] = useState<Message[]>([
      { role: 'assistant', content: 'Ciao! Sono RV Alpha, la tua intelligenza artificiale. Posso leggere i tuoi dati in tempo reale. Come posso aiutarti oggi?' }
        ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: input };
        const newMessages = [...messages, userMsg];
        setMessages(newMessages);
        setInput('');
        setLoading(true);

        try {
                const res = await fetch('/api/chat', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                                      messages: newMessages,
                                      portfolio,
                                      market
                          })
                });
                const data = await res.json();
                if (data.success) {
                          setMessages([...newMessages, { role: 'assistant', content: data.reply }]);
                } else {
                          setMessages([...newMessages, { role: 'assistant', content: '❌ Errore di connessione con il motore AI: ' + data.message }]);
                }
        } catch (e) {
                setMessages([...newMessages, { role: 'assistant', content: '❌ Errore di rete durante la comunicazione.' }]);
        } finally {
                setLoading(false);
        }
  };

  return (
        <div style={{
                position: 'fixed', top: 0, right: 0, bottom: 0, width: '380px',
                background: 'var(--bg2)', borderLeft: '1px solid var(--border)',
                boxShadow: '-10px 0 30px rgba(0,0,0,0.5)', zIndex: 1000,
                display: 'flex', flexDirection: 'column',
                animation: 'slideInRight 0.3s ease-out forwards'
        }}>
                <style dangerouslySetInnerHTML={{__html: `
                        @keyframes slideInRight {
                                  from { transform: translateX(100%); }
                                            to { transform: translateX(0); }
                                                    }
                                                          `}} />

          {/* Header Chat */}
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span style={{ fontSize: '20px' }}>🤖</span>span>
                                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '14px', letterSpacing: '0.05em' }}>RV ALPHA CHAT</span>span>
                          </div>div>
                          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>button>
                </div>div>

          {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {messages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                  <div style={{
                                    background: m.role === 'user' ? 'linear-gradient(135deg, #00d4aa33, #3b82f633)' : 'var(--bg3)',
                                    border: m.role === 'user' ? '1px solid rgba(0, 212, 170, 0.4)' : '1px solid var(--border)',
                                    padding: '12px 16px', borderRadius: '12px', maxWidth: '85%',
                                    color: 'var(--text1)', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap'
                    }}>
                                    {m.content}
                                  </div>div>
                    </div>div>
                  ))}
                  {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                  <div className="animate-pulse" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', color: 'var(--text3)' }}>
                                                  Sto analizzando i dati...
                                  </div>div>
                    </div>div>
                  )}
                          <div ref={messagesEndRef} />
                </div>div>

          {/* Input */}
                <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                                      <input 
                                                    type="text" 
                                        value={input} 
                                        onChange={(e) => setInput(e.target.value)}
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                                    placeholder="Chiedimi qualcosa sul portfolio..."
                                                    style={{
                                                                    flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
                                                                    padding: '10px 14px', color: 'var(--text1)', fontSize: '13px', outline: 'none'
                                                    }}
                                                  />
                                      <button 
                                                    onClick={handleSend} 
                                        disabled={loading || !input.trim()}
                                                    style={{
                                                                    background: 'linear-gradient(135deg, #00d4aa, #3b82f6)', border: 'none', borderRadius: '8px',
                                                                    padding: '0 16px', color: '#070b14', fontWeight: 'bold', cursor: loading ? 'default' : 'pointer',
                                                                    opacity: (loading || !input.trim()) ? 0.5 : 1
                                                    }}
                                                  >
                                                  ➤
                                      </button>button>
                          </div>div>
                </div>div>
        </div>div>
      );
}</button>
