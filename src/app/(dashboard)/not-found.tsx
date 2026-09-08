import { RetroDino404 } from "@/components/retro-dino-404";

export const dynamic = "force-dynamic";

export default function DashboardNotFound() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center py-6 animate-in fade-in zoom-in-95 duration-200">
      <RetroDino404 />
    </div>
  );
}
