"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { submitAttendance } from "@/actions/attendance";

type Step = "intro" | "location" | "camera" | "submitting" | "success" | "error";

export function CheckinFlow({
  sessionId,
  studentId,
  startedAt,
  gpsAccuracyFloor,
  lateThresholdMinutes,
}: {
  sessionId: string;
  studentId: string;
  startedAt: string;
  gpsAccuracyFloor: number;
  lateThresholdMinutes: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [errorMsg, setErrorMsg] = useState("");
  const [geoVerified, setGeoVerified] = useState(false);
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // Helper to cleanup camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const handleStartGeolocation = () => {
    setStep("location");
    
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation is not supported by your browser.");
      setStep("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (position.coords.accuracy > gpsAccuracyFloor) {
          setErrorMsg(`GPS accuracy is too low (${Math.round(position.coords.accuracy)}m). Needs to be under ${gpsAccuracyFloor}m. Please move to a better area and try again.`);
          setStep("error");
          return;
        }
        setGeoVerified(true);
        startCamera();
      },
      (error) => {
        let msg = "Failed to get location.";
        if (error.code === error.PERMISSION_DENIED) msg = "Location permission denied. Please enable it in your browser.";
        setErrorMsg(msg);
        setStep("error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startCamera = async () => {
    setStep("camera");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      setErrorMsg("Camera access denied or not available. Please allow camera access.");
      setStep("error");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    // Draw video frame to canvas
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set target dimensions (max width 800px)
    const targetWidth = 800;
    const scale = targetWidth / video.videoWidth;
    const targetHeight = video.videoHeight * scale;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          setSelfieBlob(blob);
          stopCamera();
          submitFlow(blob);
        }
      },
      "image/jpeg",
      0.8
    );
  };

  const submitFlow = async (blob: Blob) => {
    setStep("submitting");
    
    try {
      // 1. Upload Selfie to R2
      const formData = new FormData();
      formData.append("file", blob, "selfie.jpg");
      formData.append("key", `attendance/${sessionId}/${studentId}.webp`);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json();
        throw new Error(errorData.error || "Failed to upload selfie.");
      }
      const { key: selfiePath } = await uploadRes.json();

      // 2. Determine device token
      let deviceToken = localStorage.getItem("device_token");
      if (!deviceToken) {
        deviceToken = crypto.randomUUID();
        localStorage.setItem("device_token", deviceToken);
      }

      // 3. Determine status
      const started = new Date(startedAt).getTime();
      const now = new Date().getTime();
      const diffMinutes = (now - started) / 1000 / 60;
      const status = diffMinutes > lateThresholdMinutes ? "late" : "present";

      // 4. Submit attendance
      const result = await submitAttendance({
        sessionId,
        studentId,
        status,
        selfiePath,
        deviceToken,
        geoVerified,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      setStep("success");
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred during submission.");
      setStep("error");
    }
  };

  return (
    <div className="card mt-6">
      {step === "intro" && (
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-primary-glow)] text-[var(--color-primary)] mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Ready to Check In?</h2>
          <p className="text-[var(--color-text-3)] mb-8 max-w-sm mx-auto">
            This process requires access to your location and front camera to verify your attendance.
          </p>
          <button className="btn btn-primary btn-lg w-full max-w-xs mx-auto" onClick={handleStartGeolocation}>
            Start Verification
          </button>
        </div>
      )}

      {step === "location" && (
        <div className="text-center py-12">
          <div className="btn-loading mb-6 w-12 h-12 inline-block relative border-[var(--color-primary)] opacity-50 rounded-full border-4" style={{borderTopColor: "transparent"}} />
          <h2 className="text-xl font-bold mb-2">Verifying Location...</h2>
          <p className="text-[var(--color-text-3)] max-w-sm mx-auto">
            Please allow location access if prompted. Getting high accuracy fix...
          </p>
        </div>
      )}

      {step === "camera" && (
        <div className="flex flex-col items-center py-4">
          <h2 className="text-xl font-bold mb-4">Take a Selfie</h2>
          <div className="relative w-full max-w-sm aspect-[3/4] bg-[var(--color-surface-2)] rounded-2xl overflow-hidden mb-6 shadow-md border border-[var(--color-border)]">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              muted 
              className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
            />
          </div>
          <canvas ref={canvasRef} style={{ display: "none" }} />
          <button className="btn btn-primary btn-lg w-full max-w-xs" onClick={capturePhoto}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <circle cx="12" cy="13" r="4"/>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
            </svg>
            Capture & Check In
          </button>
        </div>
      )}

      {step === "submitting" && (
        <div className="text-center py-12">
          <div className="btn-loading mb-6 w-12 h-12 inline-block relative border-[var(--color-primary)] opacity-50 rounded-full border-4" style={{borderTopColor: "transparent"}} />
          <h2 className="text-xl font-bold mb-2">Uploading Securely...</h2>
          <p className="text-[var(--color-text-3)] max-w-sm mx-auto">
            Finalising your attendance record. Please wait.
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] mb-6 shadow-glow">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Check-in Complete!</h2>
          <p className="text-[var(--color-text-3)] mb-8">
            Your attendance has been recorded successfully.
          </p>
          <button className="btn btn-primary" onClick={() => router.push("/student/dashboard")}>
            Return to Dashboard
          </button>
        </div>
      )}

      {step === "error" && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--color-danger-bg)] text-[var(--color-danger)] mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Verification Failed</h2>
          <p className="text-[var(--color-danger)] mb-8 max-w-md mx-auto">
            {errorMsg}
          </p>
          <div className="flex gap-4 justify-center">
            <button className="btn btn-secondary" onClick={() => router.push("/student/dashboard")}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => setStep("intro")}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
