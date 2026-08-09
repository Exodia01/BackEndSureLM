import { NextRequest, NextResponse } from "next/server";
import { uploadBrochure, listBrochures } from "@/lib/pdf/batchProcess";
import { requireAuth, requireAdmin } from "@/lib/auth/guards";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status") || undefined;

    const result = await listBrochures(limit, offset, status);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET /api/brochures] Error:", error);
    
    return NextResponse.json(
      { error: "Failed to fetch brochures" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are allowed" },
        { status: 400 }
      );
    }

    const fileArrayBuffer = await file.arrayBuffer();
    
    const result = await uploadBrochure(
      fileArrayBuffer,
      file.name,
      file.size
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("[POST /api/brochures] Error:", error);
    
    if (error instanceof Error && error.message.includes("File exceeds maximum size")) {
      return NextResponse.json(
        { error: error.message },
        { status: 413 }
      );
    }

    return NextResponse.json(
      { error: "Failed to upload brochure" },
      { status: 500 }
    );
  }
}
