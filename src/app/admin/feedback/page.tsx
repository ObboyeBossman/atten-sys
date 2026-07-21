import type { Metadata } from "next";
import { getAllFeedback } from "@/actions/feedback";
import { FeedbackInboxClient } from "./FeedbackInboxClient";

export const metadata: Metadata = { title: "Feedback Inbox" };
export const revalidate = 0;

export default async function AdminFeedbackPage() {
  const items = await getAllFeedback();
  const unreadCount = items.filter((f) => !f.isReadAdmin).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Feedback Inbox</h1>
          <p className="page-subtitle">
            {items.length === 0
              ? "No feedback submitted yet."
              : `${items.length} submission${items.length !== 1 ? "s" : ""}${unreadCount > 0 ? ` · ${unreadCount} unread` : " · all read"}`}
          </p>
        </div>
      </div>
      <FeedbackInboxClient items={items} />
    </div>
  );
}
