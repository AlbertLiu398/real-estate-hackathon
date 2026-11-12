import { MerinoNav } from "@/components/MerinoNav";

export default function MerinoLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MerinoNav />
      {children}
    </>
  );
}
