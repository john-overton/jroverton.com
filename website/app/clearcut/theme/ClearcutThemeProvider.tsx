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

export function ClearcutThemeProvider({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
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

  // Apply CSS custom properties to both the wrapper and document root.
  // The wrapper is the `.clearcut` scoping element. Document root is needed
  // because Radix portals (dropdowns, dialogs) render at body level and
  // need to inherit the same variables.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const root = document.documentElement;
    const tokenEntries = Object.entries(palette.tokens);

    for (const [prop, value] of tokenEntries) {
      wrapper.style.setProperty(prop, value);
      root.style.setProperty(prop, value);
    }
    wrapper.setAttribute('data-mode', palette.mode);

    return () => {
      // Clean up root-level vars when ClearCut unmounts so they don't leak
      // to non-ClearCut pages during client-side navigation.
      for (const [prop] of tokenEntries) {
        root.style.removeProperty(prop);
      }
    };
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
      <div ref={wrapperRef} className={`clearcut ${className ?? ''}`}>
        {children}
      </div>
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
