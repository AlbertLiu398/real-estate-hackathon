import { redirect } from "next/navigation";

/** Merino Court has a sales brochure (English and Chinese); /merino-court/brochure opens the English one */
export default function MerinoBrochureIndex() {
  redirect("/merino-court/brochure/sales");
}
