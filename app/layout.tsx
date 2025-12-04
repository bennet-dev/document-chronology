import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chronos",
  description: "Document processing and chronological analysis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Link
                  href="/"
                  className="text-xl font-bold text-zinc-900 dark:text-zinc-50"
                >
                  Chronos
                </Link>
                <div className="flex gap-4">
                  <Link
                    href="/upload"
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Upload
                  </Link>
                  <Link
                    href="/timeline"
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                  >
                    Timeline
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
