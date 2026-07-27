'use client';
import React, { useState, useRef, useEffect } from 'react';
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
  const [isListening, setIsListening] = useState(false);
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

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Il tuo browser non supporta la dettatura vocale.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.interimResults = false;
    
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(prev => prev ? prev + ' ' + transcript : transcript);
    };
    recognition.onerror = (e: any) => {
      console.error("Speech recognition error", e);
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    
    recognition.start();
  };

  const readMessage = (text: string) => {
    if (!window.speechSynthesis) {
      alert("Il tuo browser non supporta la lettura vocale.");
      return;
    }
    window.speechSynthesis.cancel(); // Ferma eventuali letture in corso
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'it-IT';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <>
      <div className="rv-chat-overlay" onClick={onClose} />
      <div className="rv-chat-widget">
        <style dangerouslySetInnerHTML={{__html: `
          .rv-chat-overlay {
            display: none;
          }
          .rv-chat-widget {
            position: fixed; 
            top: 0; 
            right: 0; 
            bottom: 0;
            width: 380px;
            background: var(--bg2);
            border-left: 1px solid var(--border);
            box-shadow: -10px 0 30px rgba(0,0,0,0.5);
            z-index: 1000;
            display: flex;
            flex-direction: column;
            animation: slideInDesktop 0.3s ease-out forwards;
          }
          @keyframes slideInDesktop {
            from { right: -400px; opacity: 0; }
            to { right: 0; opacity: 1; }
          }
          @media (max-width: 768px) {
            .rv-chat-overlay {
              display: block;
              position: fixed; top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0,0,0,0.6);
              z-index: 999;
              animation: fadeInMobile 0.3s forwards;
            }
            .rv-chat-widget {
              width: 100vw !important;
              height: 100dvh !important;
              left: 0 !important;
              right: auto !important;
              top: 0 !important;
              bottom: auto !important;
              border-left: none !important;
              max-width: 100vw !important;
              max-height: 100dvh !important;
              animation: fadeInMobile 0.3s ease-out forwards;
            }
          }
          @keyframes fadeInMobile {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .mic-btn {
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 0 12px;
            color: var(--text1);
            cursor: pointer;
            transition: all 0.2s;
          }
          .mic-btn.listening {
            background: rgba(239, 68, 68, 0.2);
            border-color: #ef4444;
            color: #ef4444;
            animation: pulse-red 1.5s infinite;
          }
          @keyframes pulse-red {
            0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
            100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
          }
        `}} />
        
        {/* Header Chat */}
        <div style={{ padding: '16px', paddingTop: 'calc(16px + env(safe-area-inset-top))', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>🤖</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '14px', letterSpacing: '0.05em' }}>RV ALPHA CHAT</span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: '24px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: '32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                <div style={{
                  background: m.role === 'user' ? 'linear-gradient(135deg, #00d4aa33, #3b82f633)' : 'var(--bg3)',
                  border: m.role === 'user' ? '1px solid rgba(0, 212, 170, 0.4)' : '1px solid var(--border)',
                  padding: '12px 16px', borderRadius: '12px',
                  color: 'var(--text1)', fontSize: '13px', lineHeight: '1.5', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                }}>
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <button 
                    onClick={() => readMessage(m.content)}
                    title="Ascolta la risposta"
                    style={{
                      background: 'transparent', border: 'none', color: 'var(--text3)',
                      fontSize: '12px', marginTop: '4px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    🔊 Ascolta
                  </button>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div className="animate-pulse" style={{ background: 'var(--bg3)', border: '1px solid var(--border)', padding: '12px 16px', borderRadius: '12px', fontSize: '13px', color: 'var(--text3)' }}>
                Sto analizzando i dati...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div style={{ padding: '16px', paddingBottom: 'calc(16px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className={`mic-btn ${isListening ? 'listening' : ''}`}
              onClick={startListening}
              title="Dettatura vocale"
            >
              🎙️
            </button>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Scrivi o detta..."
              style={{
                flex: 1, background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px',
                padding: '10px 12px', color: 'var(--text1)', fontSize: '16px', outline: 'none',
                minWidth: 0,
                appearance: 'none'
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
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
