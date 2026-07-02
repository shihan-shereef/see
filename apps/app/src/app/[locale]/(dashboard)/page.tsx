"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import { useQuery } from "convex/react";
import { Activity, Boxes, FileText, ListChecks, Users } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

const isOffline = false;

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | undefined;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-primary/50">
        <Icon className="h-4 w-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-primary">{value ?? "—"}</p>
      {sub && <p className="mt-0.5 text-xs text-primary/40">{sub}</p>}
    </div>
  );
}

export default function Home() {
  const params = useParams();
  const locale = (params.locale as string) || "en";
  const { current } = useWorkspace();

  // Local state for offline data
  const [localStats, setLocalStats] = useState<any>(null);
  const [localAudit, setLocalAudit] = useState<any[]>([]);

  const fetchLocalData = async () => {
    try {
      const [mRes, kRes, aRes, jRes] = await Promise.all([
        fetch(`/${locale}/api/platform?action=getMembers`).then((r) => r.json()).catch(() => ({ members: [] })),
        fetch(`/${locale}/api/platform?action=getKeys`).then((r) => r.json()).catch(() => ({ keys: [] })),
        fetch(`/${locale}/api/platform?action=getAudits`).then((r) => r.json()).catch(() => ({ audits: [] })),
        fetch(`/${locale}/api/jobs`).then((r) => r.json()).catch(() => ({ jobs: [] })),
      ]);

      const jobs = jRes.jobs || [];
      const openJobs = jobs.filter((j: any) => j.status === "pending" || j.status === "running").length;

      setLocalStats({
        members: (mRes.members || []).length,
        files: 0,
        usageTotal: (kRes.keys || []).length * 5,
        jobs: jobs.length,
        openJobs,
      });
      setLocalAudit((aRes.audits || []).slice(0, 10));
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOffline) {
      fetchLocalData();
      const interval = setInterval(fetchLocalData, 5000);
      return () => clearInterval(interval);
    }
  }, [locale]);

  // Production Convex queries
  const scoped = !isOffline && current ? { workspaceId: current } : "skip";
  const dbStats = useQuery(api.dashboard.stats, scoped);
  const dbAudit = useQuery(api.audit.recent, scoped);

  const stats = isOffline ? localStats : dbStats;
  const audit = isOffline ? localAudit : dbAudit;

  return (
    <div className="flex h-full w-full bg-secondary px-6 py-8 dark:bg-black">
      <div className="mx-auto w-full max-w-screen-xl space-y-6">
        <div>
          <h1 className="text-xl font-medium text-primary">Dashboard</h1>
          <p className="text-sm text-primary/60">
            Overview of the selected workspace.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat
            icon={ListChecks}
            label="Open jobs"
            value={stats?.openJobs}
            sub={`${stats?.jobs ?? 0} total`}
          />
          <Stat icon={Users} label="Members" value={stats?.members} />
          <Stat icon={FileText} label="Files" value={stats?.files} />
          <Stat icon={Boxes} label="Usage events" value={stats?.usageTotal} />
        </div>

        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Activity className="h-4 w-4 text-primary/50" />
            <h2 className="text-sm font-medium text-primary">Recent activity</h2>
          </div>
          <div className="divide-y divide-border/50">
            {audit === undefined || (isOffline && !localStats) ? (
              <div className="px-4 py-6 text-sm text-primary/40">Loading…</div>
            ) : audit && audit.length ? (
              audit.map((a: any) => (
                <div
                  key={a._id}
                  className="flex items-center justify-between px-4 py-2.5 text-sm"
                >
                  <span className="font-mono text-primary/80">{a.action}</span>
                  <span className="text-primary/50">
                    {new Date(a.at).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-primary/40">
                No activity yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
