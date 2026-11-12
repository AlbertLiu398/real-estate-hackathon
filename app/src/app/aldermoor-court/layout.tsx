import { CourtNav } from "@/components/CourtNav";

export default function CourtLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CourtNav />
      {children}
    </>
  );
}
