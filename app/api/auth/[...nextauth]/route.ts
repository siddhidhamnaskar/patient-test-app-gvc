import { handlers } from "@/auth";
import { NextRequest } from "next/server";

export const GET = (req: NextRequest) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/app3001")) {
    url.pathname = `/app3001${url.pathname}`;
  }
  const newReq = new NextRequest(url.toString(), req);
  return handlers.GET(newReq);
};

export const POST = (req: NextRequest) => {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/app3001")) {
    url.pathname = `/app3001${url.pathname}`;
  }
  const newReq = new NextRequest(url.toString(), req);
  return handlers.POST(newReq);
};
