'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface AppContextType {
  theme: Theme;
  toggleTheme: () => void;
  hideValues: boolean;
  toggleHideValues: () => void;
}

const AppContext = createContext<AppContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  hideValues: false,
  toggleHideValues: () => {},
});

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [hideValues, setHideValues] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('ca-theme') as Theme | null;
    const savedHide = localStorage.getItem('ca-hide-values');
    if (savedTheme) setTheme(savedTheme);
    if (savedHide) setHideValues(savedHide === 'true');
  }, []);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
    localStorage.setItem('ca-theme', theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem('ca-hide-values', String(hideValues));
  }, [hideValues, mounted]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleHideValues = () => setHideValues(prev => !prev);

  if (!mounted) return <div className="min-h-screen bg-slate-950" />;

  return (
    <AppContext.Provider value={{ theme, toggleTheme, hideValues, toggleHideValues }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

export function formatCurrency(value: number, hide: boolean): string {
  if (hide) return '•••• €';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
}

export function formatPercent(value: number, hide: boolean): string {
  if (hide) return '•••• %';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) return '0';
  return new Intl.NumberFormat('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);
}
