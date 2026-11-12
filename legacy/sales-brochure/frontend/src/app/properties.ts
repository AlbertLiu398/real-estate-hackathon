/** Every building the tool has a book for: the landing page (/) lists them in this order.
 *
 *  To add a building: build its outputs (`make build BUILDING=<id>`), give it its pages under src/app/<id>/, and add
 *  an entry here. Numbers on the card (homes, storeys, energy ratings) are read from the building's own register, so
 *  they stay what the books say. */

import merinoRegister from "./merino-court/register.json";

export type PropertyLink = {
  label: string;
  href: string;
  /** primary: the button; book: a printable book; view: an interactive view; dev: development only (local files) */
  kind: "primary" | "book" | "view" | "dev";
  note?: string;
};

export type Property = {
  id: string;
  name: string;
  address: string;
  area: string;
  /** lng, lat: the card's pin on the map */
  at: [number, number];
  image: { src: string; alt: string; fit: "cover" | "contain" };
  homes: number;
  storeys: string;
  epc: string | null;
  completed: string;
  /** what the model was rebuilt from */
  sources: string;
  blurb: string;
  links: PropertyLink[];
  pdfs: { label: string; href: string }[];
};

const M = (merinoRegister as unknown as { building: { units: number; epc_range: string | null } }).building;

export const PROPERTIES: Property[] = [
  {
    id: "merino-court",
    name: "Merino Court",
    address: "152–154 Lever Street, London EC1V 8BG",
    area: "Old Street",
    at: [-0.0919, 51.5278],
    image: { src: "/merino-court/brochure/render-street.jpg", alt: "Merino Court from the corner of Lever Street and Bath Street (a render of its model)", fit: "cover" },
    homes: M.units,
    storeys: "LG + G + 5",
    epc: M.epc_range,
    completed: "2007",
    sources: "developer's brochure · OpenStreetMap · EA LiDAR · EPCs",
    blurb: "A warehouse conversion on the corner of Bath Street: apartments, duplex penthouses, mews houses, a town house and live/work studios.",
    links: [
      { label: "Sales brochure", href: "/merino-court/brochure/sales", kind: "primary" },
      { label: "中文", href: "/merino-court/brochure/zh/sales", kind: "primary" },
      { label: "3D model", href: "/merino-court/brochure/sales#model", kind: "view" },
      { label: "Review", href: "/review/merino-court", kind: "dev", note: "review the model and file issues (local only)" },
    ],
    pdfs: [
      { label: "Sales brochure PDF", href: "/merino-court/brochure/Merino-Court-sales-brochure.pdf" },
      { label: "中文 PDF", href: "/merino-court/brochure/Merino-Court-sales-brochure-zh.pdf" },
    ],
  },
];
