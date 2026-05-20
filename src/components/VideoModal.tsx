import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X } from "lucide-react";

function getEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    // youtube.com/watch?v=ID
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}?autoplay=1`;
    }
    // youtu.be/ID
    if (u.hostname === "youtu.be") {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    // youtube.com/embed/ID (already embed)
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/embed/")) {
      return url.includes("autoplay") ? url : `${url}?autoplay=1`;
    }
    // youtube.com/shorts/ID
    if (u.hostname.includes("youtube.com") && u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.replace("/shorts/", "");
      return `https://www.youtube.com/embed/${id}?autoplay=1`;
    }
    return null;
  } catch {
    return null;
  }
}

export default function VideoModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  if (!url) return null;
  const embedUrl = getEmbedUrl(url);

  return (
    <Dialog open={!!url} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden bg-black border-0">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-50 p-1.5 rounded-full bg-black/60 hover:bg-black/80 transition-colors"
        >
          <X className="h-4 w-4 text-white" />
        </button>
        {embedUrl ? (
          <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
            <iframe
              src={embedUrl}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title="Video del ejercicio"
            />
          </div>
        ) : (
          // URL no es YouTube → abrir en pestaña nueva como fallback
          <div className="flex flex-col items-center justify-center py-12 px-6 text-white gap-4">
            <p className="text-sm text-center">Este video no se puede mostrar en la app.</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium underline text-primary"
              onClick={onClose}
            >
              Abrir en nueva pestaña →
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
