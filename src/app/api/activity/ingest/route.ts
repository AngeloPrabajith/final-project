import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireManager, withRoute } from "@/lib/authorize";
import { prisma } from "@/lib/prisma";

interface IngestEntry {
  developerId: string;
  source: "seed" | "github" | "mock";
  activityDate: string;
  commitCount?: number;
  pullRequestCount?: number;
  reviewCount?: number;
  externalRef?: string | null;
}

interface IngestBody {
  entries: IngestEntry[];
}

function isValidEntry(e: unknown): e is IngestEntry {
  if (!e || typeof e !== "object") return false;
  const x = e as Record<string, unknown>;
  return (
    typeof x.developerId === "string" &&
    typeof x.source === "string" &&
    ["seed", "github", "mock"].includes(x.source as string) &&
    typeof x.activityDate === "string"
  );
}

/**
 * Manager-only. Each entry carries an arbitrary `developerId`, so a developer
 * with access could fabricate activity against a colleague's record — which
 * would then feed the predictive layer. Restrict to managers (and, in Phase 2,
 * a service credential for the GitHub webhook).
 */
export async function POST(req: NextRequest) {
  return withRoute(async () => {
    const ctx = await requireAuth(req);
    requireManager(ctx);

    const body = (await req.json()) as IngestBody;
    if (!body.entries || !Array.isArray(body.entries)) {
      return NextResponse.json(
        { error: "Body must include entries: IngestEntry[]" },
        { status: 400 }
      );
    }

    const entries = body.entries.filter(isValidEntry);
    if (entries.length === 0) {
      return NextResponse.json({ ingested: 0 });
    }

    // Upsert when externalRef is present (Phase 2 GitHub), plain create otherwise.
    let ingested = 0;
    for (const e of entries) {
      const data = {
        developerId: e.developerId,
        source: e.source,
        activityDate: new Date(e.activityDate),
        commitCount: e.commitCount ?? 0,
        pullRequestCount: e.pullRequestCount ?? 0,
        reviewCount: e.reviewCount ?? 0,
        externalRef: e.externalRef ?? null,
      };
      if (e.externalRef) {
        await prisma.developerActivity.upsert({
          where: { source_externalRef: { source: e.source, externalRef: e.externalRef } },
          update: data,
          create: data,
        });
      } else {
        await prisma.developerActivity.create({ data });
      }
      ingested += 1;
    }

    return NextResponse.json({ ingested });
  });
}
