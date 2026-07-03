import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, RefreshCw, Check, X, RotateCcw } from "lucide-react";
import { toast } from "sonner";

export type CapturedPhoto = {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
  idType?: string;
};

type Facing = "user" | "environment";

/**
 * Compresses a canvas to a JPEG Blob. Downscales longest edge to `maxEdge`
 * so photos remain crisp on screens without bloating storage.
 */
async function canvasToCompressedBlob(
  canvas: HTMLCanvasElement,
  maxEdge = 1280,
  quality = 0.85,
): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(canvas.width, canvas.height));
  let target: HTMLCanvasElement = canvas;
  if (scale < 1) {
    const c = document.createElement("canvas");
    c.width = Math.round(canvas.width * scale);
    c.height = Math.round(canvas.height * scale);
    const ctx = c.getContext("2d");
    if (ctx) ctx.drawImage(canvas, 0, 0, c.width, c.height);
    target = c;
  }
  return await new Promise<Blob>((resolve, reject) => {
    target.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Failed to encode image"))),
      "image/jpeg",
      quality,
    );
  });
}

export function PhotoCaptureDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "face" | "id";
  title?: string;
  onConfirm: (photo: CapturedPhoto) => void | Promise<void>;
}) {
  const { open, onOpenChange, mode, onConfirm } = props;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>(mode === "id" ? "environment" : "user");
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [idType, setIdType] = useState<string>("national_id");
  const [starting, setStarting] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startStream = useCallback(async (mode: Facing) => {
    setStarting(true);
    try {
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Camera error: ${e.message}. Grant camera access and try again.`
          : "Unable to access camera.",
      );
      onOpenChange(false);
    } finally {
      setStarting(false);
    }
  }, [onOpenChange, stopStream]);

  useEffect(() => {
    if (!open) {
      stopStream();
      setCaptured(null);
      return;
    }
    void startStream(facing);
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    const next: Facing = facing === "user" ? "environment" : "user";
    setFacing(next);
    await startStream(next);
  };

  const capture = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await canvasToCompressedBlob(canvas, mode === "id" ? 1600 : 1024, 0.85);
    const dataUrl = URL.createObjectURL(blob);
    setCaptured({
      blob,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      capturedAt: new Date().toISOString(),
      idType: mode === "id" ? idType : undefined,
    });
  };

  const retake = () => {
    if (captured?.dataUrl) URL.revokeObjectURL(captured.dataUrl);
    setCaptured(null);
  };

  const confirm = async () => {
    if (!captured) return;
    await onConfirm(mode === "id" ? { ...captured, idType } : captured);
    onOpenChange(false);
  };

  const title = props.title ?? (mode === "face" ? "Capture visitor photo" : "Capture visitor ID");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> {title}
          </DialogTitle>
          <DialogDescription>
            {mode === "face"
              ? "Position the visitor's face inside the frame, then capture."
              : "Place the ID document flat with good lighting inside the frame."}
          </DialogDescription>
        </DialogHeader>

        {mode === "id" && (
          <div className="grid gap-2">
            <Label>ID type</Label>
            <Select value={idType} onValueChange={setIdType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="national_id">National ID</SelectItem>
                <SelectItem value="passport">Passport</SelectItem>
                <SelectItem value="driving_permit">Driving Permit</SelectItem>
                <SelectItem value="company_id">Company ID</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="relative aspect-video w-full overflow-hidden rounded-md border bg-black">
          {!captured ? (
            <video
              ref={videoRef}
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
            />
          ) : (
            <img src={captured.dataUrl} alt="Captured" className="h-full w-full object-contain" />
          )}
          {starting && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-xs text-white">
              Starting camera…
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={switchCamera} disabled={starting || !!captured}>
              <RotateCcw className="mr-2 h-4 w-4" />
              {facing === "user" ? "Use back camera" : "Use front camera"}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            {!captured ? (
              <Button type="button" onClick={capture} disabled={starting}>
                <Camera className="mr-2 h-4 w-4" /> Capture
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={retake}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Retake
                </Button>
                <Button type="button" onClick={confirm}>
                  <Check className="mr-2 h-4 w-4" /> Confirm
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
