import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Single upload endpoint backing every "upload an image" button in the
// app (profile picture, league icon) — the client always calls
// @vercel/blob/client's upload() with a clientPayload identifying which
// kind of upload this is, and this route is the only place that decides
// whether the signed-in user is actually allowed to do it before handing
// out a client token. The blob's resulting URL is persisted to the DB by
// a separate server action the client calls itself right after upload()
// resolves — this route only gates the upload, it doesn't write anything.
const ALLOWED_IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

type UploadTarget = { kind: "avatar" } | { kind: "league-icon"; leagueId: string };

function parseClientPayload(raw: string | null): UploadTarget | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { kind?: unknown; leagueId?: unknown };
    if (parsed.kind === "avatar") return { kind: "avatar" };
    if (parsed.kind === "league-icon" && typeof parsed.leagueId === "string") {
      return { kind: "league-icon", leagueId: parsed.leagueId };
    }
  } catch {
    // Falls through to the null return below.
  }
  return null;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayloadRaw) => {
        const session = await auth();
        if (!session?.user?.id) {
          throw new Error("You need to be signed in to upload an image.");
        }

        const target = parseClientPayload(clientPayloadRaw);
        if (!target) {
          throw new Error("Missing or invalid upload target.");
        }

        if (target.kind === "league-icon") {
          const membership = await prisma.leagueMembership.findUnique({
            where: { leagueId_userId: { leagueId: target.leagueId, userId: session.user.id } },
          });
          if (!membership || membership.role !== "OWNER") {
            throw new Error("Only the league commissioner can set its icon.");
          }
        }

        return {
          allowedContentTypes: ALLOWED_IMAGE_CONTENT_TYPES,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      // Fires as a webhook call from Vercel's Blob service once the
      // upload lands — unreachable from localhost (needs a publicly
      // routable URL), which is fine: nothing here needs to happen
      // server-side, the client persists the resulting URL itself.
      onUploadCompleted: async () => {},
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
