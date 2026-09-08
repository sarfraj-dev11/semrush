import { RetroDino404 } from "@/components/retro-dino-404";

export default function NotFound() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background text-foreground p-4 overflow-y-auto overscroll-none">
      <RetroDino404 />
    </div>
  );
}
