"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import { Button } from "@v1/ui/button";
import { useMutation, usePaginatedQuery } from "convex/react";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 ring-yellow-600/20",
  running: "bg-blue-500/10 text-blue-600 ring-blue-600/20",
  done: "bg-green-500/10 text-green-600 ring-green-600/20",
  error: "bg-red-500/10 text-red-600 ring-red-600/20",
};

const isOffline = false;

export default function JobsPage() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const { current } = useWorkspace();
  const [pending, setPending] = useState(false);

  // ─── Offline mode: real local jobs stored in db.json ───
  const [localJobs, setLocalJobs] = useState<any[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = async () => {
    try {
      const res = await fetch(`/${locale}/api/jobs`);
      if (res.ok) {
        const data = await res.json();
        setLocalJobs(data.jobs || []);
      }
    } catch {
      // silently ignore network errors
    }
  };

  useEffect(() => {
    if (!isOffline) return;
    fetchJobs();
    // Poll every 2 seconds so running→done transitions appear automatically
    pollingRef.current = setInterval(fetchJobs, 2000);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [locale]);

  // ─── Production mode: Convex real-time queries ───
  const {
    results: dbJobs,
    status: dbStatus,
    loadMore,
  } = usePaginatedQuery(
    api.jobs.listPaged,
    !isOffline && current ? { workspaceId: current } : "skip",
    { initialNumItems: 20 },
  );

  const jobs = isOffline ? localJobs : (dbJobs || []);
  const status = isOffline ? "Idle" : dbStatus;

  const createJob = useMutation(api.jobs.create);

  const handleRunJob = async () => {
    if (!isOffline && !current) return;
    setPending(true);
    try {
      if (isOffline) {
        const res = await fetch(`/${locale}/api/jobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "createJob",
            kind: "demo",
            input: { prompt: "hello world", requestedAt: new Date().toISOString() },
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          toast.error(err.error || "Failed to queue job");
          return;
        }
        toast.success("Job queued — processing started");
        await fetchJobs(); // immediate refresh to show pending state
      } else {
        await createJob({
          workspaceId: current!,
          kind: "demo",
          input: { prompt: "hello world" },
        });
        toast.success("Job queued");
      }
    } catch {
      toast.error("Couldn't queue job");
    } finally {
      setPending(false);
    }
  };

  const hasActiveJobs = localJobs.some(
    (j) => j.status === "pending" || j.status === "running"
  );

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="z-10 mx-auto w-full max-w-screen-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-primary">Jobs</h1>
            <p className="text-sm text-primary/60">
              {isOffline
                ? "Jobs are processed locally and stored in db.json. Polling every 2s for live updates."
                : "Workspace-scoped. Created in Convex → processed by the external backend → completed via webhook. Updates live."}
            </p>
          </div>
          <Button onClick={handleRunJob} disabled={pending || (!isOffline && !current)}>
            {pending ? "Creating…" : "Run demo job"}
          </Button>
        </div>

        {isOffline && hasActiveJobs && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-2.5 text-sm text-blue-600">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
            </span>
            Processing job… updates appear automatically
          </div>
        )}

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-primary/60">
              <tr>
                <th className="px-4 py-3 font-medium">Kind</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Result</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {status === "LoadingFirstPage" && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              )}
              {status !== "LoadingFirstPage" && jobs.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-primary/40" colSpan={4}>
                    No jobs yet — click &quot;Run demo job&quot; to create one.
                  </td>
                </tr>
              )}
              {jobs.map((job) => (
                <tr
                  key={job._id}
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="px-4 py-3 font-mono text-primary/80">
                    {job.kind}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                        statusStyles[job.status] ?? ""
                      }`}
                    >
                      {(job.status === "pending" || job.status === "running") && (
                        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                      )}
                      {job.status}
                    </span>
                  </td>
                  <td className="max-w-[420px] truncate px-4 py-3 font-mono text-xs text-primary/60">
                    {job.result
                      ? typeof job.result === "object"
                        ? JSON.stringify(job.result)
                        : String(job.result)
                      : job.error
                        ? `⚠ ${job.error}`
                        : "—"}
                  </td>
                  <td className="px-4 py-3 text-primary/50">
                    {new Date(job.updatedAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isOffline && status === "CanLoadMore" && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" size="sm" onClick={() => loadMore(20)}>
              Load more
            </Button>
          </div>
        )}
        {!isOffline && status === "LoadingMore" && (
          <p className="mt-4 text-center text-sm text-primary/40">Loading…</p>
        )}
      </div>
    </div>
  );
}
