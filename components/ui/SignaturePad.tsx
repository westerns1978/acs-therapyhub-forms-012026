import React, { useRef, useEffect } from 'react';

interface SignaturePadProps {
  onSave: (signatureDataUrl: string) => void;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size for high-DPI screens
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    ctx.strokeStyle = '#1F2937'; // on-surface color
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    const getCoords = (event: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (event instanceof MouseEvent) {
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
      }
      if (event.touches && event.touches.length > 0) {
        return { x: event.touches[0].clientX - rect.left, y: event.touches[0].clientY - rect.top };
      }
      return { x: 0, y: 0 };
    };

    const startDrawing = (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      const { x, y } = getCoords(event);
      ctx.beginPath();
      ctx.moveTo(x, y);
      isDrawing.current = true;
    };

    const draw = (event: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) return;
      event.preventDefault();
      const { x, y } = getCoords(event);
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const stopDrawing = () => {
      isDrawing.current = false;
    };

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchend', stopDrawing);

    return () => {
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseup', stopDrawing);
      canvas.removeEventListener('mouseleave', stopDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchend', stopDrawing);
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full h-48 border border-border rounded-lg bg-gray-50 cursor-crosshair"
      />
      <div className="flex justify-end gap-2 mt-2">
        <button onClick={clearCanvas} className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300">
          Clear
        </button>
        <button onClick={handleSave} className="px-4 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary-focus">
          Save Signature
        </button>
      </div>
    </div>
  );
};

export default SignaturePad;