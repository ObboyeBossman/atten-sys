"use client";

import { useState } from "react";
import styles from "./FeedbackPage.module.css";

type Props = {
  form: React.ReactNode;
  history: React.ReactNode;
  historyCount: number;
};

export default function FeedbackPageClient({ form, history, historyCount }: Props) {
  const [tab, setTab] = useState<"new" | "history">("new");

  return (
    <>
      {/* Tab nav */}
      <div className={styles.tabs} role="tablist">
        <button
          role="tab"
          aria-selected={tab === "new"}
          aria-controls="panel-new"
          className={`${styles.tab} ${tab === "new" ? styles.tabActive : ""}`}
          onClick={() => setTab("new")}
        >
          New feedback
        </button>
        <button
          role="tab"
          aria-selected={tab === "history"}
          aria-controls="panel-history"
          className={`${styles.tab} ${tab === "history" ? styles.tabActive : ""}`}
          onClick={() => setTab("history")}
        >
          My submissions
          {historyCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: "var(--color-primary)",
                color: "#fff",
                borderRadius: "999px",
                fontSize: "10px",
                fontWeight: 700,
                padding: "1px 6px",
                verticalAlign: "middle",
              }}
            >
              {historyCount}
            </span>
          )}
        </button>
      </div>

      {/* Panels */}
      {tab === "new" ? (
        <div
          id="panel-new"
          role="tabpanel"
          className={styles.card}
        >
          <h2 className={styles.cardTitle}>Submit feedback</h2>
          {form}
        </div>
      ) : (
        <div
          id="panel-history"
          role="tabpanel"
          className={styles.card}
        >
          <h2 className={styles.cardTitle}>Your past submissions</h2>
          {history}
        </div>
      )}
    </>
  );
}
