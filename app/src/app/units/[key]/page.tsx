import { notFound } from "next/navigation";
import { units, unitByKey } from "@/lib/data";
import UnitView from "./UnitView";

export function generateStaticParams() {
  return units.map((u) => ({ key: u.key }));
}

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const u = unitByKey(key);
  if (!u) notFound();
  return <UnitView unitKey={u.key} />;
}
