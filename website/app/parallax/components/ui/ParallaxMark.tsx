'use client';

import { CSSProperties } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MarkSize = 'hero' | 'md' | 'sm' | 'xs' | 'tiny';
type MarkVariant = 'color' | 'mono-white' | 'mono-dark';

interface ParallaxMarkProps {
  size?: MarkSize;
  variant?: MarkVariant;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Size presets (from parallax-vanishing-point-v2.html)               */
/* ------------------------------------------------------------------ */

interface SizePreset {
  lineHeight: number;
  gap: number;
  widths: [number, number, number, number];
  margins: [number, number, number, number];
  hoverWidths: [number, number, number, number];
  hoverMargins: [number, number, number, number];
  borderRadius: number;
}

const SIZE_PRESETS: Record<MarkSize, SizePreset> = {
  hero: {
    lineHeight: 5,
    gap: 14,
    widths: [120, 88, 56, 24],
    margins: [0, 10, 20, 30],
    hoverWidths: [130, 94, 62, 34],
    hoverMargins: [0, 18, 34, 48],
    borderRadius: 2,
  },
  md: {
    lineHeight: 3.5,
    gap: 10,
    widths: [80, 60, 40, 20],
    margins: [0, 6, 12, 18],
    hoverWidths: [86, 66, 46, 28],
    hoverMargins: [0, 12, 22, 32],
    borderRadius: 2,
  },
  sm: {
    lineHeight: 2.5,
    gap: 6,
    widths: [48, 36, 24, 12],
    margins: [0, 4, 8, 12],
    hoverWidths: [52, 40, 28, 18],
    hoverMargins: [0, 8, 14, 20],
    borderRadius: 1.5,
  },
  xs: {
    lineHeight: 2.5,
    gap: 5,
    widths: [32, 24, 16, 8],
    margins: [0, 2, 4, 6],
    hoverWidths: [34, 26, 18, 12],
    hoverMargins: [0, 4, 8, 11],
    borderRadius: 1.5,
  },
  tiny: {
    lineHeight: 2,
    gap: 3.5,
    widths: [28, 21, 14, 7],
    margins: [0, 2, 4, 6],
    hoverWidths: [30, 23, 16, 10],
    hoverMargins: [0, 4, 7, 10],
    borderRadius: 1,
  },
};

/* ------------------------------------------------------------------ */
/*  Color variants                                                     */
/* ------------------------------------------------------------------ */

type ColorSet = [string, string, string, string];

const VARIANT_COLORS: Record<MarkVariant, ColorSet> = {
  color: ['#2D6A4F', '#E07A2F', '#2A9D8F', '#40916C'],
  'mono-white': [
    'rgba(255,255,255,1)',
    'rgba(255,255,255,0.7)',
    'rgba(255,255,255,0.45)',
    'rgba(255,255,255,0.25)',
  ],
  'mono-dark': [
    'rgba(27,40,56,1)',
    'rgba(27,40,56,0.65)',
    'rgba(27,40,56,0.4)',
    'rgba(27,40,56,0.2)',
  ],
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ParallaxMark({
  size = 'md',
  variant = 'color',
  className,
}: ParallaxMarkProps) {
  const preset = SIZE_PRESETS[size];
  const colors = VARIANT_COLORS[variant];

  return (
    <div className={`group/mark ${className ?? ''}`} style={{ display: 'flex', flexDirection: 'column' }}>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="parallax-mark-line"
          style={{
            '--line-w': `${preset.widths[i]}px`,
            '--line-ml': `${preset.margins[i]}px`,
            '--line-hw': `${preset.hoverWidths[i]}px`,
            '--line-hml': `${preset.hoverMargins[i]}px`,
            height: preset.lineHeight,
            width: `var(--line-w)`,
            marginLeft: `var(--line-ml)`,
            marginBottom: i < 3 ? preset.gap : 0,
            borderRadius: preset.borderRadius,
            background: colors[i],
            transition: 'all 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
