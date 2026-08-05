import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  request: NextRequest,
  context: any
) {
  try {
    const params = await context.params;
    const filename = params.filename;
    const filePath = path.join(process.cwd(), "public", "recordings", filename);

    if (!fs.existsSync(filePath)) {
      return new NextResponse("Recording not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    let contentType = "audio/webm";
    if (ext === ".mp3") contentType = "audio/mpeg";
    else if (ext === ".wav") contentType = "audio/wav";
    else if (ext === ".ogg") contentType = "audio/ogg";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": fileBuffer.length.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error: any) {
    console.error("Error serving recording:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
