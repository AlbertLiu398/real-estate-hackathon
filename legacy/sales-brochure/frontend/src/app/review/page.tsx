import { redirect } from "next/navigation";
import { PROPERTIES } from "../properties";

/** /review: the first building's review page; the page's switcher goes to the others */
export default function ReviewIndex() {
  redirect(`/review/${PROPERTIES[0].id}`);
}
