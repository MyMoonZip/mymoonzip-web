import { NextRequest } from "next/server";
import { runPipeline } from "../../../../scripts/harness/executor";

export async function POST(request: NextRequest) {
  let shellIds: number[] | undefined;

  try {
    const body = await request.json();
    if (Array.isArray(body.shells)) {
      shellIds = body.shells.map(Number).filter((n: number) => !isNaN(n));
    }
  } catch {
    // body 없음 → 전체 실행
  }

  const result = runPipeline({ shellIds });

  return Response.json(result);
}
