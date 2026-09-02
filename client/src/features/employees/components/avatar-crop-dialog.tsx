import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ZoomIn } from "lucide-react";

const VIEW = 260; // on-screen crop viewport (px)
const OUT = 400;  // exported (square) image size (px)

// Lets the user pan + zoom a picked image inside a square/round frame, then exports a SQUARE crop
// (so the avatar never warps a non-square source).
export function AvatarCropDialog({ open, src, onOpenChange, onCropped }: {
  open: boolean; src: string | null; onOpenChange: (v: boolean) => void; onCropped: (dataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (!src) { setImg(null); return; }
    const i = new Image();
    i.onload = () => { setImg(i); setZoom(1); setOffset({ x: 0, y: 0 }); };
    i.src = src;
  }, [src]);

  const baseScale = img ? Math.max(VIEW / img.naturalWidth, VIEW / img.naturalHeight) : 1; // cover
  const scale = baseScale * zoom;
  const drawnW = img ? img.naturalWidth * scale : 0;
  const drawnH = img ? img.naturalHeight * scale : 0;

  // Keep the image covering the frame — no empty gaps at the edges.
  const clamp = (o: { x: number; y: number }) => {
    const maxX = Math.max(0, (drawnW - VIEW) / 2);
    const maxY = Math.max(0, (drawnH - VIEW) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, o.x)), y: Math.max(-maxY, Math.min(maxY, o.y)) };
  };
  const pos = clamp(offset);

  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY, ox: pos.x, oy: pos.y }; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (!drag.current) return; setOffset(clamp({ x: drag.current.ox + (e.clientX - drag.current.x), y: drag.current.oy + (e.clientY - drag.current.y) })); };
  const onUp = () => { drag.current = null; };

  const save = () => {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const k = OUT / VIEW;
    const dW = drawnW * k, dH = drawnH * k;
    const tlx = OUT / 2 + pos.x * k - dW / 2;
    const tly = OUT / 2 + pos.y * k - dH / 2;
    ctx.drawImage(img, tlx, tly, dW, dH);
    onCropped(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 flex-shrink-0 border-b border-border"><DialogTitle>Adjust Photo</DialogTitle></DialogHeader>
        <div className="px-6 py-5 flex flex-col items-center gap-4">
          <div
            className="relative rounded-full overflow-hidden bg-muted touch-none cursor-grab active:cursor-grabbing"
            style={{ width: VIEW, height: VIEW }}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          >
            {img && (
              <img
                src={src!}
                alt=""
                draggable={false}
                className="absolute left-1/2 top-1/2 max-w-none select-none"
                style={{ width: drawnW, height: drawnH, transform: `translate(calc(-50% + ${pos.x}px), calc(-50% + ${pos.y}px))` }}
              />
            )}
            <div className="absolute inset-0 rounded-full ring-1 ring-inset ring-black/10 pointer-events-none" />
          </div>
          <div className="w-full flex items-center gap-3">
            <ZoomIn className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Slider value={[zoom]} min={1} max={3} step={0.01} onValueChange={([z]) => setZoom(z)} className="flex-1" data-testid="crop-zoom" />
          </div>
          <p className="text-xs text-muted-foreground">Drag to reposition, use the slider to zoom.</p>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} data-testid="button-save-crop">Save Photo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
