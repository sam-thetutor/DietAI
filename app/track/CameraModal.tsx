"use client"; // Required because this component uses hooks

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/DemoComponents'; // Adjust path as needed
import Image from 'next/image';

// --- Camera Modal Component ---
export interface CameraModalProps { // Export the interface
    isOpen: boolean;
    onClose: () => void;
    onCaptureSuccess: (imageDataUrl: string, mealType: 'breakfast' | 'lunch' | 'supper' | null) => void;
    mealType: 'breakfast' | 'lunch' | 'supper' | null;
}

export default function CameraModal({ isOpen, onClose, onCaptureSuccess, mealType }: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [stream, setStream] = useState<MediaStream | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [currentFacingMode, setCurrentFacingMode] = useState<'user' | 'environment'>('user');
    const [isSwitching, setIsSwitching] = useState(false);

    const startCamera = async (mode: 'user' | 'environment') => {
        setError(null);
        setCapturedImage(null);
        setIsSwitching(true);

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
            if (videoRef.current) videoRef.current.srcObject = null;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    console.log(`Attempting to start camera with mode: ${mode}`);
                    const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode } });
                    setStream(mediaStream);
                    if (videoRef.current) {
                        videoRef.current.srcObject = mediaStream;
                        try {
                             await videoRef.current.play();
                        } catch (playError) {
                            console.warn("Video play interrupted or failed:", playError);
                        }
                    }
                    setCurrentFacingMode(mode);
                    setError(null);
                } catch (err) {
                    console.error(`Error accessing ${mode} camera:`, err);
                     if (err instanceof Error) {
                         if (err.name === "NotAllowedError") {
                            setError("Camera permission denied. Please allow camera access in your browser settings.");
                        } else if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
                             const fallbackMode = mode === 'user' ? 'environment' : 'user';
                             console.log(`Falling back to ${fallbackMode} camera`);
                             try {
                                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fallbackMode } });
                                setStream(mediaStream);
                                if (videoRef.current) {
                                    videoRef.current.srcObject = mediaStream;
                                    try { await videoRef.current.play(); } catch (e) {
                                        console.warn("Video play interrupted or failed:", e);
                                    }
                                }
                                setCurrentFacingMode(fallbackMode);
                                setError(null);
                             } catch (fallbackErr) {
                                 console.error("Fallback camera access error:", fallbackErr);
                                 setError(`Could not access ${mode} or ${fallbackMode} camera. Ensure permissions are granted and camera is available.`);
                             }
                        } else {
                            setError(`Error accessing camera: ${err.message}`);
                        }
                     } else {
                         setError("An unknown error occurred while accessing the camera.");
                     }
                }
            } else {
                 setError("Camera access is not supported by this browser.");
            }
        } catch (outerError) {
             console.error("Error during camera setup:", outerError);
             if (!error) {
                 setError("Failed to initialize camera.");
             }
        } finally {
            setIsSwitching(false);
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            setStream(null);
        }
         if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const handleToggleCamera = () => {
        if (isSwitching) return;
        const nextMode = currentFacingMode === 'user' ? 'environment' : 'user';
        startCamera(nextMode);
    };

    const handleCapture = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (context) {
                if (currentFacingMode === 'user') {
                    context.translate(canvas.width, 0);
                    context.scale(-1, 1);
                }
                context.drawImage(video, 0, 0, canvas.width, canvas.height);
                if (currentFacingMode === 'user') {
                    context.setTransform(1, 0, 0, 1, 0, 0);
                }
                //convert canvas to base64
                
                const imageDataUrl = canvas.toDataURL('image/png');
                console.log(imageDataUrl);
                setCapturedImage(imageDataUrl);
                console.log(`Simulating AI analysis for ${mealType}... Setting calories to 400.`);
                setTimeout(() => {
                    
                    onCaptureSuccess(imageDataUrl, mealType);
                    handleClose(); // Close after success
                }, 1000);
            }
        }
    };

    const handleClose = () => {
        stopCamera();
        setCapturedImage(null);
        setError(null);
        onClose();
    };

    useEffect(() => {
        if (isOpen) {
            startCamera(currentFacingMode);
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    if (!isOpen) return null;

    // --- JSX remains the same ---
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 backdrop-blur-sm p-4">
            <div className="bg-[var(--app-background)] rounded-xl shadow-xl w-full max-w-md border border-[var(--app-card-border)] overflow-hidden">
                <div className="flex justify-between items-center p-3 border-b border-[var(--app-card-border)]">
                    <h3 className="text-base font-semibold text-[var(--app-foreground)] capitalize">Scan {mealType}</h3>
                    {stream && !capturedImage && (
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={handleToggleCamera}
                            disabled={isSwitching}
                            className="px-2 py-1 text-xs"
                            aria-label="Switch camera"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m-15.357-2a8.001 8.001 0 0115.357-2m0 0H15" />
                            </svg>
                        </Button>
                    )}
                    <button onClick={handleClose} className="text-[var(--app-foreground-muted)] hover:text-[var(--app-foreground)] text-2xl leading-none ml-2">&times;</button>
                </div>
                <div className="p-4 space-y-3">
                    {error && <p className="text-red-500 text-sm text-center bg-red-100 p-2 rounded">{error}</p>}
                    <div className="relative aspect-video bg-black rounded overflow-hidden border border-[var(--app-card-border)]">
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className={`w-full h-full object-cover ${capturedImage ? 'hidden' : ''} ${currentFacingMode === 'user' ? 'transform scale-x-[-1]' : ''}`}
                        ></video>
                        <canvas ref={canvasRef} className="hidden"></canvas>
                        {capturedImage && (
                            <Image src={capturedImage} alt="Captured meal" className="absolute inset-0 w-full h-full object-contain" width={640} height={480} />
                        )}
                         {!stream && !error && !capturedImage && (
                            <div className="absolute inset-0 flex items-center justify-center text-white/80">Starting Camera...</div>
                         )}
                    </div>
                    {!capturedImage && stream && (
                        <Button onClick={handleCapture} variant="primary" className="w-full" disabled={isSwitching}>
                            Capture & Estimate Calories
                        </Button>
                    )}
                     {capturedImage && (
                        <p className="text-center text-sm text-[var(--app-foreground-muted)]">Processing...</p>
                    )}
                    <Button onClick={handleClose} variant="outline" className="w-full">Cancel</Button>
                </div>
            </div>
        </div>
    );
} 