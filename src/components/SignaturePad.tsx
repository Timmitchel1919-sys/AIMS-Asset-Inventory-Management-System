import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Button } from "./ui";

type Props = {
  label: string;
  clearLabel: string;
  onChange: (file: File | null) => void;
};

export function SignaturePad({ label, clearLabel, onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1,
      width = canvas.clientWidth || 520;
    canvas.width = width * ratio;
    canvas.height = 180 * ratio;
    const context = canvas.getContext("2d");
    if (context) {
      context.scale(ratio, ratio);
      context.lineWidth = 2;
      context.lineCap = "round";
      context.strokeStyle = "#172033";
    }
  }, []);
  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const context = event.currentTarget.getContext("2d"),
      p = point(event);
    context?.beginPath();
    context?.moveTo(p.x, p.y);
    setDrawing(true);
  };
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const p = point(event),
      context = event.currentTarget.getContext("2d");
    context?.lineTo(p.x, p.y);
    context?.stroke();
  };
  const finish = () => {
    if (!drawing) return;
    setDrawing(false);
    canvasRef.current?.toBlob(
      (blob) =>
        onChange(
          blob
            ? new File([blob], `signature-${Date.now()}.png`, {
                type: "image/png",
              })
            : null,
        ),
      "image/png",
    );
  };
  const clear = () => {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };
  return (
    <label className="field wide">
      <span>{label}</span>
      <canvas
        ref={canvasRef}
        className="signature-pad"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={finish}
        onPointerCancel={finish}
        aria-label={label}
      />
      <Button type="button" variant="secondary" onClick={clear}>
        {clearLabel}
      </Button>
    </label>
  );
}
