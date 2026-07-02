import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

// Find db.json in multiple possible locations
function findDbFile(): string {
  const candidates = [
    path.join(process.cwd(), "db.json"),
    path.join(process.cwd(), "apps/app/db.json"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return path.join(process.cwd(), "db.json");
}

function getDb(): any {
  try {
    const file = findDbFile();
    if (!fs.existsSync(file)) return { jobs: [], audits: [] };
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return { jobs: [], audits: [] };
  }
}

function saveDb(db: any): void {
  const file = findDbFile();
  fs.writeFileSync(file, JSON.stringify(db, null, 2), "utf-8");
}

// Synchronously process a job (runs entirely within the current request, no self-fetch)
function processJobSync(db: any, jobId: string): any {
  const idx = db.jobs.findIndex((j: any) => j._id === jobId);
  if (idx === -1) return db;

  const job = db.jobs[idx];

  // Mark running
  db.jobs[idx] = { ...job, status: "running", updatedAt: Date.now() };
  saveDb(db);

  // Re-read after save to avoid stale reference
  const db2 = getDb();
  const idx2 = db2.jobs.findIndex((j: any) => j._id === jobId);
  if (idx2 === -1) return db2;

  const j = db2.jobs[idx2];
  let result: any = null;

  if (j.kind === "demo") {
    result = {
      output: `Demo job completed at ${new Date().toLocaleTimeString()}`,
      kind: j.kind,
      inputReceived: j.input,
      processedAt: new Date().toISOString(),
    };
  } else if (j.kind === "seo") {
    const score = Math.floor(Math.random() * 40) + 60;
    result = {
      score,
      grade: score >= 80 ? "A" : score >= 60 ? "B" : "C",
      recommendations: Math.floor(Math.random() * 5) + 1,
      processedAt: new Date().toISOString(),
    };
  } else {
    result = {
      status: "completed",
      kind: j.kind,
      processedAt: new Date().toISOString(),
    };
  }

  db2.jobs[idx2] = {
    ...j,
    status: "done",
    result,
    error: null,
    updatedAt: Date.now(),
  };

  if (!db2.audits) db2.audits = [];
  db2.audits.unshift({
    _id: "act_" + Date.now(),
    action: `Job completed: ${j.kind} (${j._id})`,
    at: Date.now(),
  });

  saveDb(db2);
  return db2;
}

// ─── POST /api/jobs ───────────────────────────────────────────────────────────
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, kind, input, jobId, prompt } = body;

    const db = getDb();

    // List jobs
    if (action === "listJobs") {
      const sorted = [...(db.jobs || [])].sort((a, b) => b.updatedAt - a.updatedAt);
      return NextResponse.json({ jobs: sorted });
    }

    // Create + immediately process a job (no async self-call)
    if (action === "createJob") {
      const newJobId = "job_" + Date.now();
      const now = Date.now();

      const job = {
        _id: newJobId,
        workspaceId: "dev-workspace",
        kind: kind || "demo",
        status: "pending",
        input: input || { prompt: prompt || "demo" },
        result: null,
        error: null,
        createdAt: now,
        updatedAt: now,
      };

      db.jobs = db.jobs || [];
      db.jobs.unshift(job);
      saveDb(db);

      // Process synchronously WITHIN this request — no fire-and-forget, no race condition
      processJobSync(getDb(), newJobId);

      const finalDb = getDb();
      const finalJob = finalDb.jobs.find((j: any) => j._id === newJobId);

      return NextResponse.json({ success: true, job: finalJob || { ...job, status: "done" } });
    }

    // Manually trigger processing (e.g. for stuck jobs)
    if (action === "processJob") {
      if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
      const updated = processJobSync(getDb(), jobId);
      const resultJob = updated.jobs.find((j: any) => j._id === jobId);
      return NextResponse.json({ success: true, job: resultJob });
    }

    // Re-run all stuck pending/running jobs
    if (action === "processAll") {
      let db3 = getDb();
      const stuck = (db3.jobs || []).filter(
        (j: any) => j.status === "pending" || j.status === "running"
      );
      for (const j of stuck) {
        db3 = processJobSync(db3, j._id);
      }
      return NextResponse.json({ success: true, processed: stuck.length });
    }

    // Delete a job
    if (action === "deleteJob") {
      db.jobs = (db.jobs || []).filter((j: any) => j._id !== jobId);
      saveDb(db);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Jobs API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

// ─── GET /api/jobs — list all jobs ────────────────────────────────────────────
export async function GET() {
  const db = getDb();
  const sorted = [...(db.jobs || [])].sort((a, b) => b.updatedAt - a.updatedAt);
  return NextResponse.json({ jobs: sorted });
}
