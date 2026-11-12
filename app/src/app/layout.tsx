import type { Metadata } from "next";
import { Fraunces, Inter, Noto_Serif_SC, Noto_Sans_SC } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18n";
import { Header } from "@/components/Header";

const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const serifSc = Noto_Serif_SC({ variable: "--font-noto-serif-sc", weight: ["500", "700"], preload: false });
const sansSc = Noto_Sans_SC({ variable: "--font-noto-sans-sc", weight: ["400", "500"], preload: false });

export const metadata: Metadata = {
  title: "FloorQi · Merino Court",
  description: "Every home at Merino Court, from the sales brochure: plans, 3D and an explainable Feng Shui score.",
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
