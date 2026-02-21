/** Helper to build cc-tokens + shadcn variable mappings from a flat color set. */
function buildTokens(colors: {
  bg: string;
  surface1: string;
  surface2: string;
  surface3: string;
  border: string;
  borderHover: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentFg: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
}) {
  return {
    // ClearCut design-system tokens
    '--color-cc-bg': colors.bg,
    '--color-cc-surface-1': colors.surface1,
    '--color-cc-surface-2': colors.surface2,
    '--color-cc-surface-3': colors.surface3,
    '--color-cc-border': colors.border,
    '--color-cc-border-hover': colors.borderHover,
    '--color-cc-text': colors.text,
    '--color-cc-text-secondary': colors.textSecondary,
    '--color-cc-text-muted': colors.textMuted,
    '--color-cc-accent': colors.accent,
    '--color-cc-accent-hover': colors.accentHover,
    '--color-cc-accent-fg': colors.accentFg,
    '--color-cc-success': colors.success,
    '--color-cc-warning': colors.warning,
    '--color-cc-danger': colors.danger,
    '--color-cc-info': colors.info,
    // shadcn semantic variable overrides — keeps buttons, dropdowns,
    // dialogs, inputs, etc. in sync with the active palette.
    '--background': colors.bg,
    '--foreground': colors.text,
    '--card': colors.surface1,
    '--card-foreground': colors.text,
    '--popover': colors.surface1,
    '--popover-foreground': colors.text,
    '--primary': colors.accent,
    '--primary-foreground': colors.accentFg,
    '--secondary': colors.surface2,
    '--secondary-foreground': colors.text,
    '--muted': colors.surface2,
    '--muted-foreground': colors.textMuted,
    '--accent': colors.surface2,
    '--accent-foreground': colors.text,
    '--destructive': colors.danger,
    '--border': colors.border,
    '--input': colors.border,
    '--ring': colors.accent,
  } as const;
}

export const palettes = [
  {
    id: 'revenue-run' as const,
    name: 'Revenue Run',
    mode: 'light' as const,
    tokens: buildTokens({
      bg: '#F4F6FA',
      surface1: '#FFFFFF',
      surface2: '#EDF0F7',
      surface3: '#E0E4EF',
      border: '#CDD3E0',
      borderHover: '#A8B1C4',
      text: '#141B2D',
      textSecondary: '#4A5468',
      textMuted: '#7C8598',
      accent: '#059669',
      accentHover: '#047857',
      accentFg: '#FFFFFF',
      success: '#059669',
      warning: '#D97706',
      danger: '#DC2626',
      info: '#0284C7',
    }),
    chartColors: ['#059669', '#0284C7', '#DC2626', '#D97706', '#7C3AED', '#4F46E5'],
  },
  {
    id: 'peak-hour' as const,
    name: 'Peak Hour',
    mode: 'light' as const,
    tokens: buildTokens({
      bg: '#F0F7FF',
      surface1: '#FFFFFF',
      surface2: '#E8F0FE',
      surface3: '#D4E4FA',
      border: '#B8CDE8',
      borderHover: '#8BADD4',
      text: '#0F1A2E',
      textSecondary: '#3B4F6B',
      textMuted: '#6B7FA0',
      accent: '#2563EB',
      accentHover: '#1D4ED8',
      accentFg: '#FFFFFF',
      success: '#059669',
      warning: '#EA580C',
      danger: '#DC2626',
      info: '#0891B2',
    }),
    chartColors: ['#2563EB', '#059669', '#DC2626', '#EA580C', '#0891B2', '#9333EA'],
  },
  {
    id: 'evening-rush' as const,
    name: 'Evening Rush',
    mode: 'dark' as const,
    tokens: buildTokens({
      bg: '#0B1120',
      surface1: '#111827',
      surface2: '#1E293B',
      surface3: '#293548',
      border: '#334155',
      borderHover: '#475569',
      text: '#F1F5F9',
      textSecondary: '#CBD5E1',
      textMuted: '#94A3B8',
      accent: '#22D3EE',
      accentHover: '#06B6D4',
      accentFg: '#0B1120',
      success: '#34D399',
      warning: '#FBBF24',
      danger: '#F87171',
      info: '#38BDF8',
    }),
    chartColors: ['#22D3EE', '#34D399', '#F87171', '#FBBF24', '#38BDF8', '#A78BFA'],
  },
  {
    id: 'night-owl' as const,
    name: 'Night Owl',
    mode: 'dark' as const,
    tokens: buildTokens({
      bg: '#1A1423',
      surface1: '#211A2E',
      surface2: '#2D2440',
      surface3: '#3A3050',
      border: '#4A3F60',
      borderHover: '#6B5F88',
      text: '#F5F0FF',
      textSecondary: '#D4C8EF',
      textMuted: '#A99BC8',
      accent: '#F59E0B',
      accentHover: '#D97706',
      accentFg: '#1A1423',
      success: '#34D399',
      warning: '#FB923C',
      danger: '#FB7185',
      info: '#67E8F9',
    }),
    chartColors: ['#F59E0B', '#34D399', '#FB7185', '#FB923C', '#67E8F9', '#C084FC'],
  },
] as const;

export type PaletteId = (typeof palettes)[number]['id'];
export type Palette = (typeof palettes)[number];

export function getPalette(id: PaletteId): Palette {
  return palettes.find((p) => p.id === id) ?? palettes[0];
}
