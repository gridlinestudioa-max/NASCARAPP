"use client";

import ImageUploadField from "@/components/ui/ImageUploadField";
import { setLeagueIcon } from "./actions";

export default function LeagueIconForm({
  leagueId,
  leagueName,
  iconUrl,
}: {
  leagueId: string;
  leagueName: string;
  iconUrl: string | null;
}) {
  return (
    <ImageUploadField
      currentUrl={iconUrl}
      fallbackText={(leagueName.charAt(0) || "?").toUpperCase()}
      pathPrefix={`league-icons/${leagueId}`}
      clientPayload={JSON.stringify({ kind: "league-icon", leagueId })}
      onUploaded={(url) => setLeagueIcon(leagueId, url)}
      shape="square"
      helperText="Shown next to your league's name in place of the initial-letter avatar. JPG, PNG, WEBP or GIF, up to 5MB."
    />
  );
}
