'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Palette, PaletteId } from './palettes';
import { getPalette, palettes } from './palettes';

interface ClearcutThemeContextValue {
  palette: Palette;
  paletteId: PaletteId;
  setPaletteId: (id: PaletteId) => void;
  chartColors: readonly string[];
}

const ClearcutThemeContext = createContext<ClearcutThemeContextValue | null>(null);

const STORAGE_KEY = 'clearcut-palette';

export function ClearcutThemeProvider({ children }: { children: React.ReactNode }) {
  const [paletteId, setPaletteIdState] = useState<PaletteId>('revenue-run');
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Read saved preference on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && palettes.some((p) => p.id === stored)) {
        setPaletteIdState(stored as PaletteId);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const palette = getPalette(paletteId);

  // Apply CSS custom properties when palette changes
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    for (const [prop, value] of Object.entries(palette.tokens)) {
      wrapper.style.setProperty(prop, value);
    }
    wrapper.setAttribute('data-mode', palette.mode);
  }, [palette]);

  const setPaletteId = useCallback((id: PaletteId) => {
    setPaletteIdState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // localStorage unavailable
    }
  }, []);

  return (
    <ClearcutThemeContext.Provider value={{ palette, paletteId, setPaletteId, chartColors: palette.chartColors }}>
      <div ref={wrapperRef}>{children}</div>
    </ClearcutThemeContext.Provider>
  );
}

export function useClearcutTheme(): ClearcutThemeContextValue {
  const ctx = useContext(ClearcutThemeContext);
  if (!ctx) {
    throw new Error('useClearcutTheme must be used within a ClearcutThemeProvider');
  }
  return ctx;
}
