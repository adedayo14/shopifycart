import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { AppBridgeProvider } from "@/components/AppBridgeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trifoli - Premium Shopify Theme Blocks",
  description: "Premium Shopify theme blocks for your store. Built to feel native. Works like magic.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <Suspense fallback={
          <div className="min-h-screen flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading Trifoli app...</p>
            </div>
          </div>
        }>
          <AppBridgeProvider>
            {children}
          </AppBridgeProvider>
        </Suspense>
      </body>
    </html>
  );
}
