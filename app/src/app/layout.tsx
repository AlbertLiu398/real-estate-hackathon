import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18n";
import { Header } from "@/components/Header";

// display face from the legacy SalesBrochure app (legacy/sales-brochure)
const fraunces = Cormorant_Garamond({ variable: "--font-fraunces", subsets: ["latin"], weight: ["500", "600", "700"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serifSc = Noto_Serif_SC({ variable: "--font-noto-serif-sc", weight: ["500", "700"], preload: false });
const sansSc = Noto_Sans_SC({ variable: "--font-noto-sans-sc", weight: ["400", "500"], preload: false });

export const metadata: Metadata = {
  title: "FloorQi · London new homes",
  description: "London new homes: plans, 3D and an explainable Feng Shui score for every home.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${fraunces.variable} ${inter.variable} ${serifSc.variable} ${sansSc.variable}`}>
        <I18nProvider>
          <Header />
          <main className="mx-auto max-w-[1280px] px-4 pb-24 sm:px-8">{children}</main>
        </I18nProvider>
      </body>
    </html>
  );
}
