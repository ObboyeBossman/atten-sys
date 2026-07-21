import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMyFeedback } from "@/actions/feedback";
import FeedbackForm from "@/components/feedback/FeedbackForm";
import FeedbackHistory from "@/components/feedback/FeedbackHistory";
import FeedbackPageClient from "@/components/feedback/FeedbackPageClient";
import styles from "@/components/feedback/FeedbackPage.module.css";

export const metadata: Metadata = { title: "Feedback" };
export const revalidate = 0;

export default async function StudentFeedbackPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const history = await getMyFeedback();

  return (
    <div className={styles.page}>
      {/* ── Hero ────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroEyebrow}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path d="M6 1l1.18 2.4 2.65.38-1.92 1.87.45 2.64L6 7.07 3.64 8.29l.45-2.64L2.17 3.78l2.65-.38L6 1z" />
          </svg>
          Student Feedback
        </div>
        <h1 className={styles.heroTitle}>Your voice matters</h1>
        <p className={styles.heroDesc}>
          Share your experience, recommend improvements, or flag issues. Every submission is reviewed to make the system better for you and your peers.
        </p>
      </div>

      {/* ── Tabbed content ──────────────────────────────────── */}
      <FeedbackPageClient
        historyCount={history.length}
        form={<FeedbackForm authorRole="student" />}
        history={<FeedbackHistory items={history} />}
      />
    </div>
  );
}
