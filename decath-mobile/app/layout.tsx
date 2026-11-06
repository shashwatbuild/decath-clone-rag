import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Toast } from "@/components/ui";
import PhoneFrame from "@/components/PhoneFrame";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Decath Clone",
  description: "Mobile sports store demo with a RAG shopping assistant",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <StoreProvider>
          <PhoneFrame>
            <div className="app-shell">{children}</div>
            <Toast />
          </PhoneFrame>
        </StoreProvider>
      </body>
    </html>
  );
}
