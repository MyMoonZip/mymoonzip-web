import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin as supabase } from "@/lib/supabase";
import { grade } from "@/lib/grader";

interface Params {
  params: Promise<{ id: string }>;
}

// POST /api/workbooks/[id]/submit
// body: { answers: { questionId: string; userAnswer: string }[] }
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const userAnswers: { questionId: string; userAnswer: string }[] =
    body.answers ?? [];

  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, answer")
    .eq("workbook_id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const answerMap = new Map(questions.map((q) => [q.id, q.answer]));

  const inputs = userAnswers.map((ua) => ({
    questionId: ua.questionId,
    answer: answerMap.get(ua.questionId) ?? "",
    userAnswer: ua.userAnswer,
  }));

  const summary = grade(inputs);

  return NextResponse.json(summary);
}
