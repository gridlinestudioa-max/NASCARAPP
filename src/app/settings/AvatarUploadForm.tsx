"use client";

import ImageUploadField from "@/components/ui/ImageUploadField";
import { setAvatarUrl } from "./actions";

export default function AvatarUploadForm({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  return (
    <ImageUploadField
      currentUrl={avatarUrl}
      fallbackText={(name.charAt(0) || "?").toUpperCase()}
      pathPrefix="avatars"
      clientPayload={JSON.stringify({ kind: "avatar" })}
      onUploaded={setAvatarUrl}
      helperText="Shown next to your name in every league you're in. JPG, PNG, WEBP or GIF, up to 5MB."
    />
  );
}
