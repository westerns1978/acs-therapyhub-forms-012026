
import React, { useRef, useEffect, useState } from 'react';
import { Camera, CameraOff, Circle, Zap, Scan, X, Maximize2 } from 'lucide-react';

interface VisualAuditPanelProps {
  isActive: boolean;
  onClose: () => void;
  onCaptureStill: (base64: string) => void;
  stream: MediaStream | null;
  status: 'IDLE' | 'LINK_ACTIVE' | 'RECORDING' | 'ANALYZING';
}

const VisualAuditPanel: React.FC<VisualAuditPanelProps> = ({ 
  isActive, 
  onClose, 
  onCaptureStill, 
  stream,
  status 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8).split(',')[1];
        onCaptureStill(base64);
      }
    }
  };

  if (!isActive) return null;

  return (
    <div className="absolute inset-x-0 top-20 bottom-24 z-30 flex flex-col bg-slate-950 p-4 animate-fade-in-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-[#B45309]/20 p-1.5 rounded-lg border border-[#B45309]/30">
            <Scan size={14} className="text-[#B45309]" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Visual Audit Node</h4>
            <div className="flex items-center gap-1.5">
               <span className={`w-1.5 h-1.5 rounded-full ${status === 'IDLE' ? 'bg-slate-500' : 'bg-red-500 animate-pulse'}`}></span>
               <span className="text-[9px] font-bold text-slate-400 font-mono tracking-tighter">{status}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 transition-colors">
          <X size={18} />
        </button>
      </div>

      <div className="relative flex-1 rounded-2xl overflow-hidden border border-white/10 bg-black group shadow-2xl">
        <video 
          ref={videoRef} 
          autoPlay 
          muted 
          playsInline 
          className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700"
        />
        
        {/* Overlay HUD */}
        <div className="absolute inset-0 pointer-events-none border-[12px] border-white/5 flex flex-col justify-between p-4">
          <div className="flex justify-between items-start">
             <div className="w-4 h-4 border-t-2 border-l-2 border-white/20"></div>
             <div className="w-4 h-4 border-t-2 border-r-2 border-white/20"></div>
          </div>
          
          <div className="flex justify-center">
             <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                <Zap size={10} className="text-[#FFB800] fill-[#FFB800]" />
                <span className="text-[8px] font-black text-white uppercase tracking-[0.2em]">Live Telemetry Enabled</span>
             </div>
          </div>

          <div className="flex justify-between items-end">
             <div className="w-4 h-4 border-b-2 border-l-2 border-white/20"></div>
             <div className="w-4 h-4 border-b-2 border-r-2 border-white/20"></div>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={captureFrame}
            className="p-4 bg-[#8B1E24] hover:bg-[#70181D] text-white rounded-full shadow-xl hover:scale-110 transition-all border border-white/20 group"
          >
            <Camera size={24} className="group-active:scale-90 transition-transform" />
          </button>
        </div>
      </div>

      <canvas ref={canvasRef} className="hidden" />
      
      <div className="mt-4 flex justify-around px-4">
         <div className="text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase">Latency</p>
            <p className="text-[10px] font-mono font-bold text-[#FFB800]">24ms</p>
         </div>
         <div className="text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase">Resolution</p>
            <p className="text-[10px] font-mono font-bold text-white">1080P_RAW</p>
         </div>
         <div className="text-center">
            <p className="text-[8px] font-black text-slate-500 uppercase">Encryption</p>
            <p className="text-[10px] font-mono font-bold text-green-500">AES_256</p>
         </div>
      </div>
    </div>
  );
};

export default VisualAuditPanel;
