import { Inter, JetBrains_Mono } from 'next/font/google';
import { ClearcutThemeProvider } from './theme/ClearcutThemeProvider';
import './clearcut.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });

export default function ClearcutLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClearcutThemeProvider className={`${inter.variable} ${jetbrainsMono.variable}`}>
      {children}
    </ClearcutThemeProvider>
  );
}
