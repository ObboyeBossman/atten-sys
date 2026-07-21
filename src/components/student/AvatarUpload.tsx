"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { uploadProfilePhoto } from "@/actions/profile";

interface AvatarUploadProps {
  currentPhotoUrl: string | null;
  studentName: string;
}

export function AvatarUpload({ currentPhotoUrl, studentName }: AvatarUploadProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initials = studentName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const displayUrl = preview ?? currentPhotoUrl;

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Only image files are allowed.");
      setStatus("error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Image must be under 5 MB.");
      setStatus("error");
      return;
    }

    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setStatus("uploading");
    setErrorMsg(null);

    const fd = new FormData();
    fd.append("file", file);

    const result = await uploadProfilePhoto(fd);

    if (result.error) {
      setPreview(null);
      URL.revokeObjectURL(objectUrl);
      setErrorMsg(result.error);
      setStatus("error");
    } else {
      setStatus("success");
      router.refresh();
      // Brief success pause then reset to idle
      setTimeout(() => setStatus("idle"), 2000);
    }
  }, [router]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so the same file can be re-selected after an error
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const isUploading = status === "uploading";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", flexWrap: "wrap" }}>
      {/* Avatar display */}
      <div
        style={{
          position: "relative",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--color-surface-3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid var(--color-border)",
            fontSize: "var(--text-xl)",
            fontWeight: 700,
            color: "var(--color-text-3)",
            position: "relative",
          }}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={`${studentName} avatar`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span aria-hidden="true">{initials}</span>
          )}

          {/* Uploading overlay */}
          {isUploading && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  border: "2.5px solid rgba(255,255,255,0.3)",
                  borderTopColor: "#fff",
                  borderRadius: "50%",
                  display: "inline-block",
                  animation: "spin 0.6s linear infinite",
                }}
              />
            </div>
          )}

          {/* Success overlay */}
          {status === "success" && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(16,185,129,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                animation: "fade-in 200ms ease",
              }}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Upload controls */}
      <div style={{ flex: 1, minWidth: 200 }}>
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          style={{
            border: `1.5px dashed ${status === "error" ? "var(--color-danger)" : "var(--color-border)"}`,
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--color-surface-2)",
            cursor: isUploading ? "not-allowed" : "pointer",
            transition: "border-color var(--transition-fast)",
          }}
          onClick={() => !isUploading && inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload profile photo"
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === " ") && !isUploading) inputRef.current?.click();
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--color-surface-3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text-3)",
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text)", marginBottom: 2 }}>
                {isUploading ? "Uploading…" : "Change photo"}
              </p>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-3)" }}>
                JPEG, PNG or WebP · Max 5 MB · Drop or click
              </p>
            </div>
          </div>
        </div>

        {status === "error" && errorMsg && (
          <p
            role="alert"
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-danger)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMsg}
          </p>
        )}

        {status === "success" && (
          <p
            style={{
              marginTop: "var(--space-2)",
              fontSize: "var(--text-xs)",
              color: "var(--color-success)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-1)",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Photo updated successfully.
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleInputChange}
          disabled={isUploading}
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
