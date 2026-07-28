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

export function formatNumber(value: number, decimals: number = 2): string {
  if (isNaN(value) || value === null || value === undefined) return '0';
  const fixed = value.toFixed(decimals);
  const parts = fixed.split('.');
  let integerPart = parts[0];
  const isNegative = integerPart.startsWith('-');
  if (isNegative) {
    integerPart = integerPart.substring(1);
  }
  let formattedInteger = '';
  let count = 0;
  for (let i = integerPart.length - 1; i >= 0; i--) {
    if (count > 0 && count % 3 === 0) {
      formattedInteger = '.' + formattedInteger;
    }
    formattedInteger = integerPart[i] + formattedInteger;
    count++;
  }
  if (isNegative) {
    formattedInteger = '-' + formattedInteger;
  }
  if (decimals > 0 && parts[1]) {
    return formattedInteger + ',' + parts[1];
  }
  return formattedInteger;
}

export function formatCurrency(value: number, hide: boolean): string {
  if (hide) return '•••• €';
  return formatNumber(value, 2) + ' €';
}

export function formatPercent(value: number, hide: boolean): string {
  if (hide) return '•••• %';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${formatNumber(value, 2)}%`;
}
