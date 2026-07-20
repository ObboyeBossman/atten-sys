import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { disputeId, attendanceId, action, note } = body as {
      disputeId: string;
      attendanceId: string;
      action: "approve" | "reject";
      note: string | null;
    };

    // ── Basic input validation ────────────────────────────────────────────
    if (!disputeId || !attendanceId || !action) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }
    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { error: "Invalid action. Must be 'approve' or 'reject'." },
        { status: 400 }
      );
    }

    // ── Auth: must be a signed-in lecturer ───────────────────────────────
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const lecturerResult = await supabase
      .from("lecturers")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!lecturerResult.data) {
      return NextResponse.json({ error: "Not authorised." }, { status: 403 });
    }

    // ── Ownership check: dispute → attendance → session → course → lecturer ─
    // Fetch the attendance record for this dispute
    const attResult = await (supabase as any)
      .from("attendance")
      .select("id, session_id")
      .eq("id", attendanceId)
      .maybeSingle();

    if (!attResult.data) {
      return NextResponse.json(
        { error: "Attendance record not found." },
        { status: 404 }
      );
    }

    // Fetch the session to verify it belongs to this lecturer's course
    const sessionResult = await (supabase as any)
      .from("class_sessions")
      .select("id, course_id, courses(lecturer_id)")
      .eq("id", attResult.data.session_id)
      .maybeSingle();

    if (!sessionResult.data) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const lecturerIdOnCourse = sessionResult.data.courses?.lecturer_id;
    if (lecturerIdOnCourse !== user.id) {
      return NextResponse.json(
        { error: "You are not authorised to resolve this dispute." },
        { status: 403 }
      );
    }

    // Verify the dispute is still pending
    const disputeResult = await (supabase as any)
      .from("attendance_disputes")
      .select("id, status")
      .eq("id", disputeId)
      .maybeSingle();

    if (!disputeResult.data) {
      return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
    }
    if (disputeResult.data.status !== "pending") {
      return NextResponse.json(
        { error: "This dispute has already been resolved." },
        { status: 409 }
      );
    }

    // ── Resolve the dispute ───────────────────────────────────────────────
    const { error: disputeError } = await (supabase as any)
      .from("attendance_disputes")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
        resolution_note: note ?? null,
      })
      .eq("id", disputeId);

    if (disputeError) {
      return NextResponse.json({ error: disputeError.message }, { status: 500 });
    }

    // ── If approved, mark attendance as present ───────────────────────────
    if (action === "approve") {
      const { error: attError } = await (supabase as any)
        .from("attendance")
        .update({ status: "present" })
        .eq("id", attendanceId);

      if (attError) {
        return NextResponse.json({ error: attError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}
