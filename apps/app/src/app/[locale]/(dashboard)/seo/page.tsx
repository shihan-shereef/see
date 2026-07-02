"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Doc } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { Input } from "@v1/ui/input";
import { useMutation, usePaginatedQuery } from "convex/react";
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  Trash2,
  TrendingUp,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 ring-yellow-600/20",
  running: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-blue-600/20",
  completed: "bg-green-500/10 text-green-600 dark:text-green-400 ring-green-600/20",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400 ring-red-600/20",
};

export default function SeoDashboardPage() {
  const { current } = useWorkspace();
  const params = useParams();
  const locale = params.locale || "en";
  const [urlInput, setUrlInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Local storage fallback for offline local development
  const [localAudits, setLocalAudits] = useState<any[]>(() => {
    if (typeof window !== "undefined") {
      const saved = window.localStorage.getItem("seo_audits");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });

  const isOffline = process.env.NODE_ENV === "development";

  const {
    results: dbAudits,
    status: dbStatus,
    loadMore,
  } = usePaginatedQuery(
    api.seo.listPaged,
    !isOffline && current ? { workspaceId: current } : "skip",
    { initialNumItems: 15 },
  );

  const startAudit = useMutation(api.seo.startAudit);
  const deleteAudit = useMutation(api.seo.remove);

  const audits = isOffline ? localAudits : (dbAudits || []);
  const status = isOffline ? "Idle" : dbStatus;

  const handleStartAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    setIsSubmitting(true);

    // Normalize URL
    let targetUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    if (isOffline) {
      const tempId = "local_" + Date.now();
      const pendingAudit = {
        _id: tempId,
        url: targetUrl,
        status: "running",
        score: 0,
        createdAt: Date.now(),
        hasViewport: false,
        hasFavicon: false,
        totalImages: 0,
        imagesWithAlt: 0,
        imagesWithoutAlt: [],
        totalLinks: 0,
        internalLinks: 0,
        externalLinks: 0,
        recommendations: [],
      };

      const updated = [pendingAudit, ...localAudits];
      setLocalAudits(updated);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("seo_audits", JSON.stringify(updated));
      }

      try {
        const res = await fetch(`/${locale}/api/audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to scan site");
        }

        const data = await res.json();
        const completedAudit = {
          ...pendingAudit,
          status: "completed",
          ...data,
        };

        const finalAudits = updated.map((a) => (a._id === tempId ? completedAudit : a));
        setLocalAudits(finalAudits);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("seo_audits", JSON.stringify(finalAudits));
        }
        toast.success("SEO Audit completed successfully!");
        setUrlInput("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Audit failed");
        const failedAudit = {
          ...pendingAudit,
          status: "failed",
          error: err instanceof Error ? err.message : "Connection failed",
        };
        const finalAudits = updated.map((a) => (a._id === tempId ? failedAudit : a));
        setLocalAudits(finalAudits);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("seo_audits", JSON.stringify(finalAudits));
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!current) {
      toast.error("No active workspace selected");
      setIsSubmitting(false);
      return;
    }

    try {
      await startAudit({
        workspaceId: current,
        url: urlInput,
      });
      toast.success("SEO Audit queued successfully");
      setUrlInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to queue audit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (auditId: any) => {
    if (confirm("Are you sure you want to delete this audit report?")) {
      if (isOffline) {
        const filtered = localAudits.filter((a) => a._id !== auditId);
        setLocalAudits(filtered);
        if (typeof window !== "undefined") {
          window.localStorage.setItem("seo_audits", JSON.stringify(filtered));
        }
        toast.success("Audit report deleted");
        return;
      }

      try {
        await deleteAudit({ auditId });
        toast.success("Audit report deleted");
      } catch (err) {
        toast.error("Failed to delete audit");
      }
    }
  };

  // Math metrics for summary
  const completedAudits = audits.filter((a) => a.status === "completed");
  const averageScore =
    completedAudits.length > 0
      ? Math.round(
          completedAudits.reduce((acc, curr) => acc + curr.score, 0) /
            completedAudits.length,
        )
      : null;
  const bestScore =
    completedAudits.length > 0
      ? Math.max(...completedAudits.map((a) => a.score))
      : null;

  return (
    <div className="flex min-h-full w-full flex-col bg-secondary/30 px-4 py-8 dark:bg-black/40 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-screen-xl space-y-8">
        
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">SEO Audit</h1>
            <p className="mt-1 text-sm text-primary/60">
              Analyze meta headers, structural outline, social card previews, and optimize your web pages.
            </p>
          </div>
        </div>

        {/* Audit Form Section */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="absolute right-0 top-0 -mr-16 -mt-16 h-40 w-40 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-primary">Scan a website</h2>
              <p className="text-xs text-primary/50">
                Enter any public HTTP/HTTPS URL. The scan will perform standard SEO indexability analysis.
              </p>
            </div>
            
            <form onSubmit={handleStartAudit} className="flex w-full flex-col gap-2 sm:flex-row md:max-w-xl">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/40" />
                <Input
                  type="text"
                  placeholder="example.com or https://example.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="pl-9 bg-background/50 border-border focus-visible:ring-1 focus-visible:ring-primary/30"
                  disabled={isSubmitting || !current}
                />
              </div>
              <Button type="submit" disabled={isSubmitting || !current} className="gap-2 shrink-0">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Scanning
                  </>
                ) : (
                  <>
                    Analyze Site
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Metrics Grid */}
        {completedAudits.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary/40">Total Audited</p>
                <p className="text-2xl font-bold text-primary">{completedAudits.length} sites</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary/40">Average Score</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-primary">{averageScore}%</p>
                  <span className="text-[10px] text-primary/50">on-page score</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/5 text-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary/40">Best Score</p>
                <p className="text-2xl font-bold text-primary">{bestScore}%</p>
              </div>
            </div>
          </div>
        )}

        {/* Audit trend graph (Pure SVG) */}
        {completedAudits.length > 2 && (
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary/50">SEO Health Trend</h3>
            <div className="flex h-24 items-end gap-2 px-2">
              {completedAudits
                .slice()
                .reverse()
                .map((audit, idx) => {
                  const barHeight = Math.max(10, audit.score); // min height
                  const color =
                    audit.score >= 80
                      ? "bg-green-500/80 hover:bg-green-500"
                      : audit.score >= 50
                        ? "bg-yellow-500/80 hover:bg-yellow-500"
                        : "bg-red-500/80 hover:bg-red-500";

                  return (
                    <Link
                      key={audit._id}
                      href={`/seo/${audit._id}`}
                      className="group flex flex-1 flex-col items-center gap-1.5"
                    >
                      <div className="relative w-full flex-1 flex items-end">
                        <div
                          style={{ height: `${barHeight}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 ${color}`}
                        />
                        <div className="absolute bottom-full left-1/2 mb-1 hidden -translate-x-1/2 rounded bg-black px-2 py-0.5 text-[10px] text-white group-hover:block dark:bg-zinc-800">
                          {audit.score}%
                        </div>
                      </div>
                      <span className="text-[10px] text-primary/40 truncate max-w-[80px]">
                        {audit.url.replace(/^https?:\/\/(www\.)?/, "")}
                      </span>
                    </Link>
                  );
                })}
            </div>
          </div>
        )}

        {/* History Table */}
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border/80 px-6 py-4">
            <h3 className="text-sm font-semibold text-primary">Audit History</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border/60 text-left text-primary/50">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Domain / Path</th>
                  <th className="px-6 py-3.5 font-medium">Status</th>
                  <th className="px-6 py-3.5 font-medium text-center">SEO Score</th>
                  <th className="px-6 py-3.5 font-medium">Scanned Date</th>
                  <th className="px-6 py-3.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {status === "LoadingFirstPage" && (
                  <tr>
                    <td className="px-6 py-8 text-center text-primary/40" colSpan={5}>
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary/60" />
                        <span>Loading audit logs...</span>
                      </div>
                    </td>
                  </tr>
                )}
                
                {status !== "LoadingFirstPage" && audits.length === 0 && (
                  <tr>
                    <td className="px-6 py-12 text-center text-primary/40" colSpan={5}>
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Globe className="h-8 w-8 text-primary/20" />
                        <div className="space-y-0.5">
                          <p className="font-medium text-primary/60">No audits found</p>
                          <p className="text-xs">Enter a website URL above to start your first scan.</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}

                {audits.map((audit) => {
                  const cleanDomain = audit.url.replace(/^https?:\/\/(www\.)?/, "");
                  const formattedDate = new Date(audit.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <tr key={audit._id} className="group hover:bg-secondary/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col max-w-md">
                          <span className="font-medium text-primary truncate">{cleanDomain}</span>
                          <span className="text-[10px] text-primary/40 truncate">{audit.url}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                            statusStyles[audit.status] ?? ""
                          }`}
                        >
                          {audit.status === "running" && (
                            <Loader2 className="mr-1 h-2.5 w-2.5 animate-spin" />
                          )}
                          {audit.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {audit.status === "completed" ? (
                          <span
                            className={`inline-flex items-center justify-center font-bold px-2 py-1 rounded-md text-xs ${
                              audit.score >= 80
                                ? "text-green-600 bg-green-500/10 dark:text-green-400"
                                : audit.score >= 50
                                  ? "text-yellow-600 bg-yellow-500/10 dark:text-yellow-400"
                                  : "text-red-600 bg-red-500/10 dark:text-red-400"
                            }`}
                          >
                            {audit.score} / 100
                          </span>
                        ) : audit.status === "failed" ? (
                          <span className="inline-flex items-center justify-center text-primary/30">
                            —
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center text-primary/40 animate-pulse">
                            ...
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-primary/60 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-primary/40" />
                          {formattedDate}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {audit.status === "completed" && (
                            <Link href={`/seo/${audit._id}`} passHref>
                              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                                Report
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                            </Link>
                          )}
                          {audit.status === "failed" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-600 hover:bg-red-500/5"
                              onClick={() =>
                                toast.error(audit.error || "Unknown scan error", {
                                  duration: 6000,
                                })
                              }
                            >
                              <AlertCircle className="h-3 w-3" />
                              Error
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 text-primary/40 hover:text-red-600 hover:bg-red-500/5"
                            onClick={() => handleDelete(audit._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {status === "CanLoadMore" && (
            <div className="flex justify-center border-t border-border/40 p-4">
              <Button variant="outline" size="sm" onClick={() => loadMore(15)}>
                Load More
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
