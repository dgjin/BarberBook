import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { Appointment, AppointmentStatus } from '../types';
import { StorageService } from '../services/storageService';

interface QRScannerProps {
  onScanSuccess: (appointment: Appointment) => void;
  onScanBooking?: (barberId: string) => void; // New callback for booking
  onClose: () => void;
}

export const QRScanner: React.FC<QRScannerProps> = ({ onScanSuccess, onScanBooking, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Anti-debounce mechanism to prevent multiple rapid firings
  const isProcessingRef = useRef(false);

  useEffect(() => {
    // Start camera
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // Required for iOS
          videoRef.current.setAttribute('playsinline', 'true'); 
          videoRef.current.play();
          requestAnimationFrame(tick);
        }
      } catch (err) {
        console.error("Camera error", err);
        setError("无法访问相机。请确保您使用的是 HTTPS 或 localhost。");
      }
    };

    if (isScanning) {
      startCamera();
    }

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning]);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };

  const tick = () => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.height = video.videoHeight;
      canvas.width = video.videoWidth;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan for QR
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "dontInvert",
        });

        if (code && code.data && !isProcessingRef.current) {
          handleScan(code.data);
          return; 
        }
      }
    }
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const handleScan = async (data: string) => {
    isProcessingRef.current = true;
    
    // Check for Barber Booking QR (Format: "BARBER_BOOK:<id>")
    if (data.startsWith('BARBER_BOOK:') && onScanBooking) {
        const barberId = data.split('BARBER_BOOK:')[1];
        stopCamera();
        setIsScanning(false);
        onScanBooking(barberId);
        return;
    }

    // Default: Check for Appointment Check-in ID
    try {
      const appointments = await StorageService.getAppointments();
      const appointment = appointments.find(a => a.id === data);

      if (appointment) {
        stopCamera();
        setIsScanning(false);
        onScanSuccess(appointment);
      } else {
        // Unknown code, just continue scanning after a short delay
        setTimeout(() => { isProcessingRef.current = false; }, 1000);
      }
    } catch (e) {
      console.error(e);
      isProcessingRef.current = false;
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
             handleScan(code.data);
          } else {
             alert("未能识别图片中的二维码，请重试或确保图片清晰。");
          }
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
    event.target.value = ''; // Reset input
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
      <div className="absolute top-4 right-4 z-10">
        <button onClick={onClose} className="p-2 bg-white/20 rounded-full text-white hover:bg-white/40">
          <X size={24} />
        </button>
      </div>

      <div className="relative w-full max-w-md aspect-[3/4] bg-black rounded-lg overflow-hidden border border-gray-700">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full text-white p-6 text-center">
            <Camera className="mb-4 text-red-500" size={48} />
            <p>{error}</p>
            <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-800 rounded">关闭</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted />
            <canvas ref={canvasRef} className="hidden" />
            
            {/* Overlay UI */}
            <div className="absolute inset-0 border-[50px] border-black/50 flex items-center justify-center">
              <div className="w-64 h-64 border-2 border-brand-500 rounded-lg relative">
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-brand-500 -mt-1 -ml-1"></div>
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-brand-500 -mt-1 -mr-1"></div>
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-brand-500 -mb-1 -ml-1"></div>
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-brand-500 -mb-1 -mr-1"></div>
              </div>
            </div>
            
            <p className="absolute bottom-10 w-full text-center text-white text-sm font-medium drop-shadow-md">
              扫描 <span className="text-brand-400">预约签到</span> 或 <span className="text-brand-400">理发师</span> 二维码
            </p>
          </>
        )}
      </div>

      <div className="mt-6 text-white text-center w-full max-w-md px-6">
        <h3 className="text-lg font-bold">扫描器已启动</h3>
        <p className="text-gray-400 text-sm mb-4">正在扫描二维码...</p>
        
        <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept="image/*" 
            onChange={handleFileUpload} 
        />
        <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-white font-medium transition-colors backdrop-blur-sm"
        >
            <ImageIcon size={20} />
            从相册选择图片
        </button>
      </div>
    </div>
  );
};