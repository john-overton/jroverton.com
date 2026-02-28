import type { Metadata } from 'next';
import { DM_Sans, DM_Serif_Display, Inter, JetBrains_Mono, Outfit } from 'next/font/google';
import { ClearcutThemeProvider } from './theme/ClearcutThemeProvider';
import './parallax.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit', weight: ['300', '400', '500', '600', '700'] });
const dmSans = DM_Sans({ subsets: ['latin'], variable: '--font-dm-sans' });
const dmSerif = DM_Serif_Display({ subsets: ['latin'], variable: '--font-dm-serif', weight: '400', style: ['normal', 'italic'] });

export const metadata: Metadata = {
  title: 'Parallax',
  description: 'See your operation from every angle — import route data, analyze demand patterns, and optimize operations.',
  icons: {
    icon: '/parallax-icon.svg',
    shortcut: '/parallax-icon.svg',
    apple: '/parallax-icon.svg',
  },
};

export default function ClearcutLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClearcutThemeProvider className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} ${dmSans.variable} ${dmSerif.variable}`}>
      {children}
    </ClearcutThemeProvider>
  );
}
