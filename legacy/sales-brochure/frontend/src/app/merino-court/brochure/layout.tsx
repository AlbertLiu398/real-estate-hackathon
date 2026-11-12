import { Cormorant_Garamond } from "next/font/google";
import "./brochure.css";

const display = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });

export const metadata = {
  title: "Merino Court, 152–154 Lever Street · Sales brochure",
  description: "22 homes in a converted warehouse by Old Street, EC1V: 3D model, floor plans and sales history.",
};

export default function MerinoBrochureLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${display.variable} brochure h-full overflow-y-auto`}>{children}</div>;
}
