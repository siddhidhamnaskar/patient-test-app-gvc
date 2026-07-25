import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const text = searchParams.get("text");
    if (!text) {
      return new NextResponse("Text parameter is required", { status: 400 });
    }

    const cleanText = text.replace(/[*_#`~[\]]/g, "").trim();
    if (!cleanText) {
      return new NextResponse("Empty text after filtering", { status: 400 });
    }

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q=${encodeURIComponent(cleanText)}`;

    // Server-side request avoids browser CORS and Referrer policy blocks
    const response = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch TTS: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=86400", // Cache for 24 hours to optimize performance
      },
    });
  } catch (error: any) {
    console.error("TTS API Error:", error);
    return new NextResponse(error.message || "Failed to generate TTS", { status: 500 });
  }
}
