import { notFound } from "next/navigation";
import { PROPERTIES } from "../../properties";
import { ReviewApp } from "../ReviewApp";

export const metadata = { title: "Review · PropTruth · Neighbour View" };

/** /review/<building>: the builder's review page for one building (development only: it reads and writes local files) */
export default async function ReviewPage({ params }: { params: Promise<{ building: string }> }) {
  const { building } = await params;
  if (!PROPERTIES.some((p) => p.id === building)) notFound();
  return <ReviewApp building={building} />;
}
