import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SidebarNav } from "@/components/sidebar-nav";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FairScreen — Intelligent CV Screening",
  description: "Production-ready UK CV screening with transparent, deterministic scoring",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-[#fafafa] font-sans">
        <div className="flex min-h-screen">
          <SidebarNav />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1440px] px-8 py-8">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
