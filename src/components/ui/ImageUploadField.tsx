"use client";

import { useRef, useState, useTransition } from "react";
import { upload } from "@vercel/blob/client";
import styles from "./ImageUploadField.module.css";

// Shared "upload an image, show a live preview, persist the URL"
// control — backs both the profile-picture field in Settings and the
// league-icon field on the Commissioner page. Uploads go straight from
// the browser to Vercel Blob (src/app/api/upload/route.ts only hands out
// a short-lived signed token, never proxies the file itself), then
// `onUploaded` — a server action passed in by the caller — persists the
// resulting URL to the DB.
export default function ImageUploadField({
  currentUrl,
  fallbackText,
  pathPrefix,
  clientPayload,
  onUploaded,
  shape = "circle",
  helperText,
}: {
  currentUrl: string | null;
  fallbackText: string;
  pathPrefix: string;
  clientPayload: string;
  onUploaded: (url: string | null) => Promise<{ error?: string } | void>;
  shape?: "circle" | "square";
  helperText?: string;
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(undefined);
    const localPreviewUrl = URL.createObjectURL(file);
    setPreview(localPreviewUrl);

    startTransition(async () => {
      try {
        const blob = await upload(`${pathPrefix}/${file.name}`, file, {
          access: "public",
          handleUploadUrl: "/api/upload",
          clientPayload,
        });
        const result = await onUploaded(blob.url);
        if (result?.error) {
          setError(result.error);
          setPreview(currentUrl);
        } else {
          setPreview(blob.url);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
        setPreview(currentUrl);
      } finally {
        URL.revokeObjectURL(localPreviewUrl);
      }
    });
  }

  function handleRemove() {
    setError(undefined);
    startTransition(async () => {
      const result = await onUploaded(null);
      if (result?.error) {
        setError(result.error);
      } else {
        setPreview(null);
      }
    });
  }

  const previewClass = shape === "circle" ? styles.previewCircle : styles.previewSquare;

  return (
    <div className={styles.row}>
      <div className={previewClass}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- object/blob URL and uploaded Vercel Blob URLs, not a static/local asset
          <img src={preview} alt="" className={styles.previewImg} />
        ) : (
          <span>{fallbackText}</span>
        )}
      </div>
      <div className={styles.controls}>
        {helperText && <div className={styles.helper}>{helperText}</div>}
        <div className={styles.actions}>
          <button type="button" onClick={() => inputRef.current?.click()} disabled={pending}>
            {pending ? "Uploading..." : preview ? "Change image" : "Upload image"}
          </button>
          {preview && (
            <button type="button" className={styles.removeButton} onClick={handleRemove} disabled={pending}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleFileChange}
          className={styles.hiddenInput}
        />
        {error && <p role="alert">{error}</p>}
      </div>
    </div>
  );
}
