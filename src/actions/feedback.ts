"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FeedbackCategory =
  | "general"
  | "attendance_system"
  | "course_experience"
  | "lecturer_feedback"
  | "platform_suggestion"
  | "technical_issue"
  | "other";

export type FeedbackSentiment = "positive" | "neutral" | "negative";
export type FeedbackAuthorRole = "student" | "lecturer";

export type FeedbackPayload = {
  category: FeedbackCategory;
  sentiment: FeedbackSentiment;
  rating: number;
  title: string;
  body: string;
  isAnonymous: boolean;
  authorRole: FeedbackAuthorRole;
};

export type FeedbackItem = {
  id: string;
  category: FeedbackCategory;
  sentiment: FeedbackSentiment;
  rating: number;
  title: string;
  body: string;
  isAnonymous: boolean;
  createdAt: string;
};

export async function submitFeedback(
  payload: FeedbackPayload
): Promise<{ error: string } | { success: true; id: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized. Please log in again." };

  if (!payload.title?.trim()) return { error: "Please add a short title." };
  if (!payload.body?.trim()) return { error: "Please share some details." };
  if (payload.rating < 1 || payload.rating > 5)
    return { error: "Rating must be between 1 and 5." };

  const { data, error: insertError } = await (supabase as any)
    .from("feedback")
    .insert({
      author_id: user.id,
      author_role: payload.authorRole,
      category: payload.category,
      sentiment: payload.sentiment,
      rating: payload.rating,
      title: payload.title.trim(),
      body: payload.body.trim(),
      is_anonymous: payload.isAnonymous,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("submitFeedback error:", insertError);
    return { error: "Failed to submit feedback. Please try again." };
  }

  return { success: true, id: (data as { id: string }).id };
}

export async function getMyFeedback(): Promise<FeedbackItem[]> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await (supabase as any)
    .from("feedback")
    .select("id, category, sentiment, rating, title, body, is_anonymous, created_at")
    .eq("author_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (!data) return [];

  return (data as Array<{
    id: string;
    category: string;
    sentiment: string;
    rating: number;
    title: string;
    body: string;
    is_anonymous: boolean;
    created_at: string;
  }>).map((r) => ({
    id: r.id,
    category: r.category as FeedbackCategory,
    sentiment: r.sentiment as FeedbackSentiment,
    rating: r.rating,
    title: r.title,
    body: r.body,
    isAnonymous: r.is_anonymous,
    createdAt: r.created_at,
  }));
}
