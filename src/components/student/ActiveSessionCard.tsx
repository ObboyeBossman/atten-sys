"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./ActiveSessionCard.module.css";

/* ─── types ───────────────────────────────────────────────── */
interface LiveSession {
  id: string;
  started_at: string;
  venue: string | null;
  isCheckedIn: boolean;
  courseName: string;
  courseCode: string;
}

interface Props {
  studentId: string;
  groupIds: string[];
  courseIds: string[];
}

type CardState = "idle" | "loading" | "offline" | "session" | "empty" | "error";

/* ─── helpers ────────────────────────────────────────────── */
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GH", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function elapsedLabel(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return `${mins}m elapsed`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m elapsed`;
}

/* ─── component ─────────────────────────────────────────── */
export default function ActiveSessionCard({ studentId, groupIds, courseIds }: Props) {
  const [state, setState] = useState<CardState>("idle");
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const checkSession = useCallback(async () => {
    /* offline guard */
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setState("offline");
      return;
    }

    if (courseIds.length === 0) {
      setState("empty");
      return;
    }

    setState("loading");
    setErrorMsg("");

    try {
      const supabase = createSupabaseBrowserClient();

      /* 1. Fetch live sessions for student's courses */
      type RawSession = {
        id: string;
        started_at: string;
        venue: string | null;
        courses: { id: string; name: string; code: string } | null;
      };
      const { data: rawSessions, error: sessErr } = await (supabase
        .from("class_sessions")
        .select(`id, started_at, venue, courses(id, name, code)`)
        .in("course_id", courseIds)
        .is("ended_at", null) as unknown as Promise<{
          data: RawSession[] | null;
          error: { message: string } | null;
        }>);

      if (sessErr) throw new Error(sessErr.message);
      if (!rawSessions || rawSessions.length === 0) {
        setState("empty");
        return;
      }

      /* 2. Check which sessions the student already checked in to */
      const sessionIds = rawSessions.map((s) => s.id);
      const { data: myAtt } = await (supabase
        .from("attendance")
        .select("session_id")
        .in("session_id", sessionIds)
        .eq("student_id", studentId) as unknown as Promise<{
          data: { session_id: string }[] | null;
        }>);

      const checkedIn = new Set((myAtt ?? []).map((a) => a.session_id));

      const mapped: LiveSession[] = rawSessions.map((s) => ({
        id: s.id,
        started_at: s.started_at,
        venue: s.venue ?? null,
        isCheckedIn: checkedIn.has(s.id),
        courseName: s.courses?.name ?? "Unknown course",
        courseCode: s.courses?.code ?? "—",
      }));

      setSessions(mapped);
      setState("session");
    } catch {
      setErrorMsg("Could not reach the server. Please check your connection and try again.");
      setState("error");
    }
  }, [courseIds, studentId]);

  /* Listen for online events so the button re-enables automatically */
  useEffect(() => {
    const handleOnline = () => {
      if (state === "offline") setState("idle");
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [state]);

  /* ── idle: CTA card ───────────────────────────────────── */
  if (state === "idle") {
    return (
      <div className={styles.idleCard} role="region" aria-label="Active session checker">
        <div className={styles.idleLeft}>
          <div className={styles.idleIcon} aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="14" height="11" rx="2" />
              <path d="M16 10l5-3v10l-5-3" />
            </svg>
          </div>
          <div>
            <div className={styles.idleTitle}>Lecturer started class?</div>
            <div className={styles.idleSubtitle}>Tap to check for an active session</div>
          </div>
        </div>
        <button
          className={styles.checkBtn}
          onClick={checkSession}
          aria-label="Check for active session"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M23 4v6h-6" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          Check Session
        </button>
      </div>
    );
  }

  /* ── loading: skeleton ───────────────────────────────── */
  if (state === "loading") {
    return (
      <div className={styles.skeletonCard} aria-busy="true" aria-label="Checking for active sessions…">
        <div className={styles.skeletonLeft}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonIcon}`} />
          <div className={styles.skeletonLines}>
            <div className={`${styles.skeletonBlock} ${styles.skeletonLine1}`} />
            <div className={`${styles.skeletonBlock} ${styles.skeletonLine2}`} />
          </div>
        </div>
        <div className={`${styles.skeletonBlock} ${styles.skeletonBtn}`} />
      </div>
    );
  }

  /* ── offline ─────────────────────────────────────────── */
  if (state === "offline") {
    return (
      <div className={styles.offlineCard} role="alert">
        <span className={styles.offlineIcon} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />
          </svg>
        </span>
        <div>
          <div className={styles.offlineTitle}>You're offline</div>
          <div className={styles.offlineSubtitle}>Reconnect to campus Wi-Fi and we'll let you try again automatically.</div>
        </div>
      </div>
    );
  }

  /* ── empty ───────────────────────────────────────────── */
  if (state === "empty") {
    return (
      <div className={styles.emptyCard}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </span>
        <div>
          <div className={styles.emptyTitle}>No classes in session right now</div>
          <div className={styles.emptySubtitle}>Check back when your next class starts.</div>
        </div>
        <button className={styles.retryLink} onClick={() => setState("idle")} aria-label="Check again">
          Check again
        </button>
      </div>
    );
  }

  /* ── error ───────────────────────────────────────────── */
  if (state === "error") {
    return (
      <div className={styles.errorCard} role="alert">
        <span className={styles.errorIcon} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </span>
        <div className={styles.errorText}>{errorMsg}</div>
        <button className={styles.retryLink} onClick={checkSession} aria-label="Try again">
          Try again
        </button>
      </div>
    );
  }

  /* ── session found ─────────────────────────────────── */
  return (
    <div className={styles.sessionWrap} role="region" aria-label="Active sessions">
      {sessions.map((session) => (
        <div key={session.id} className={styles.liveBanner}>
          <div className={styles.liveBannerGlow} aria-hidden="true" />

          <div className={styles.liveBannerContent}>
            {/* Pulsing video icon */}
            <div className={styles.livePulse} aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="6" width="14" height="11" rx="2" />
                <path d="M16 10l5-3v10l-5-3" />
              </svg>
            </div>

            <div className={styles.liveTextWrap}>
              <div className={styles.liveLabelRow}>
                <span className={styles.liveDot} aria-label="Live session">● LIVE</span>
                <span className={styles.elapsedTag}>{elapsedLabel(session.started_at)}</span>
              </div>
              <div className={styles.liveCourseName}>{session.courseName}</div>
              <div className={styles.liveCourseMeta}>
                {session.courseCode}
                {session.venue ? ` · ${session.venue}` : ""}
                {" · "}Started at {formatTime(session.started_at)}
              </div>
            </div>
          </div>

          <div className={styles.liveBannerActions}>
            {session.isCheckedIn ? (
              <div className={styles.liveCheckedIn}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 8l4 4 6-7" />
                </svg>
                Checked In
              </div>
            ) : (
              <Link href={`/student/checkin/${session.id}`} className="btn btn-primary">
                Check In Now
              </Link>
            )}
            <Link
              href={`/student/attendance/${session.id}`}
              className={styles.detailsLink}
            >
              View details
            </Link>
          </div>
        </div>
      ))}

      {/* Re-check trigger at bottom of results */}
      <button className={styles.refreshRow} onClick={checkSession} aria-label="Refresh session list">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 4v6h-6" />
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
        </svg>
        Refresh
      </button>
    </div>
  );
}
