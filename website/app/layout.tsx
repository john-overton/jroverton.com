import type { Metadata } from "next";
import { EB_Garamond } from "next/font/google";
import "./globals.css";
import 'bootstrap/dist/css/bootstrap.min.css';
import Script from 'next/script';

const garamond = EB_Garamond({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
  variable: '--font-typewriter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "John Overton - Personal Website",
  description: "Personal website of John Overton",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${garamond.variable}`}>
        {children}
        <Script 
          src="https://unpkg.com/@phosphor-icons/web"
          strategy="lazyOnload"
        />
        <Script 
          src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
