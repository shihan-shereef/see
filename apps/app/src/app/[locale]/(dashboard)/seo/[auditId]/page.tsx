"use client";

import { useWorkspace } from "@/lib/useWorkspace";
import { api } from "@v1/backend/convex/_generated/api";
import type { Id } from "@v1/backend/convex/_generated/dataModel";
import { Button } from "@v1/ui/button";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileText,
  HelpCircle,
  Image as ImageIcon,
  Info,
  Link as LinkIcon,
  Loader2,
  Share2,
  ShieldAlert,
  Smartphone,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Tab = "overview" | "meta" | "headings" | "media";

export default function SeoReportDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [socialTab, setSocialTab] = useState<"google" | "facebook" | "twitter">("google");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const auditId = params.auditId as string;
  const isOffline = process.env.NODE_ENV === "development" || auditId.startsWith("local_");

  const dbAudit = useQuery(
    api.seo.get,
    !isOffline ? { auditId: auditId as Id<"seoAudits"> } : "skip",
  );

  const [localAudit] = useState<any>(() => {
    if (typeof window !== "undefined" && isOffline) {
      const saved = window.localStorage.getItem("seo_audits");
      if (saved) {
        const list = JSON.parse(saved);
        return list.find((a: any) => a._id === auditId) || null;
      }
    }
    return null;
  });

  const audit = isOffline ? localAudit : dbAudit;
  const deleteMutation = useMutation(api.seo.remove);

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this SEO report?")) {
      if (isOffline) {
        if (typeof window !== "undefined") {
          const saved = window.localStorage.getItem("seo_audits");
          if (saved) {
            const list = JSON.parse(saved);
            const filtered = list.filter((a: any) => a._id !== auditId);
            window.localStorage.setItem("seo_audits", JSON.stringify(filtered));
          }
        }
        toast.success("Audit report deleted successfully");
        router.push("/seo");
        return;
      }
      try {
        await deleteMutation({ auditId: auditId as Id<"seoAudits"> });
        toast.success("Audit report deleted successfully");
        router.push("/seo");
      } catch {
        toast.error("Failed to delete report");
      }
    }
  };

  // Prevent hydration mismatch: SVG circle strokeDashoffset depends on audit.score
  // which is only available in the browser (localStorage). Show spinner until mounted.
  if (!mounted || audit === undefined) {
    return (
      <div className="flex h-[80vh] w-full items-center justify-center bg-secondary/10 dark:bg-black/20">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary/60" />
          <p className="text-sm text-primary/60">Loading SEO Report...</p>
        </div>
      </div>
    );
  }

  if (!audit) {
    return (
      <div className="flex h-[80vh] w-full flex-col items-center justify-center gap-4 bg-secondary/10 dark:bg-black/20">
        <ShieldAlert className="h-12 w-12 text-red-500/80" />
        <div className="space-y-1 text-center">
          <p className="text-lg font-semibold text-primary">Report not found</p>
          <p className="text-sm text-primary/50">This audit may have been deleted or you do not have permission to access it.</p>
        </div>
        <Link href="/seo">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  const criticalRecs = audit.recommendations.filter((r: any) => r.severity === "critical");
  const warningRecs = audit.recommendations.filter((r: any) => r.severity === "warning");
  const infoRecs = audit.recommendations.filter((r: any) => r.severity === "info");

  // Score styling
  const scoreColor =
    audit.score >= 80
      ? "text-green-500 border-green-500/20 bg-green-500/5"
      : audit.score >= 50
        ? "text-yellow-500 border-yellow-500/20 bg-yellow-500/5"
        : "text-red-500 border-red-500/20 bg-red-500/5";

  const scoreText =
    audit.score >= 80
      ? "Excellent SEO"
      : audit.score >= 50
        ? "Needs Improvement"
        : "Poor SEO Health";

  return (
    <div className="flex min-h-full w-full flex-col bg-secondary/30 px-4 py-8 dark:bg-black/40 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-screen-xl space-y-8">
        
        {/* Navigation & Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link href="/seo">
              <Button variant="outline" size="sm" className="h-9 w-9 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-mono tracking-wider text-primary/40">SEO Audit Report</span>
                <span className="h-1 w-1 rounded-full bg-primary/20" />
                <span className="text-xs text-primary/50 font-mono">
                  {new Date(audit.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-lg font-semibold text-primary truncate max-w-md sm:max-w-xl md:max-w-2xl">
                {audit.url}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a href={audit.url} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs">
                Visit Site
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-9 p-0 text-primary/40 hover:text-red-500 hover:bg-red-500/5"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Score Overview Panel */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Circular Score Gauge */}
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card p-8 text-center shadow-sm">
            <h3 className="mb-6 text-sm font-semibold uppercase tracking-wider text-primary/50">SEO Score</h3>
            
            <div className="relative flex h-36 w-36 items-center justify-center">
              {/* SVG Ring Background */}
              <svg className="absolute transform -rotate-90" width="144" height="144">
                <circle
                  cx="72"
                  cy="72"
                  r="64"
                  className="stroke-muted fill-none"
                  strokeWidth="10"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="64"
                  className={`fill-none transition-all duration-1000 ${
                    audit.score >= 80
                      ? "stroke-green-500"
                      : audit.score >= 50
                        ? "stroke-yellow-500"
                        : "stroke-red-500"
                  }`}
                  strokeWidth="10"
                  strokeDasharray={402}
                  strokeDashoffset={402 - (402 * audit.score) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center">
                <span className="text-4xl font-extrabold tracking-tight text-primary">
                  {audit.score}
                </span>
                <span className="text-xs text-primary/40 block">/ 100</span>
              </div>
            </div>

            <div className={`mt-6 rounded-full border px-4 py-1 text-xs font-semibold ${scoreColor}`}>
              {scoreText}
            </div>
          </div>

          {/* Quick Stats Blocks */}
          <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="space-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
                  <ShieldAlert className="h-4.5 w-4.5" />
                </div>
                <p className="text-xs font-medium text-primary/50 uppercase tracking-wider">Critical Issues</p>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-primary">{criticalRecs.length}</p>
                <p className="text-xs text-primary/40 mt-1">Must fix immediately</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="space-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-600 dark:text-yellow-400">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <p className="text-xs font-medium text-primary/50 uppercase tracking-wider">Warnings</p>
              </div>
              <div className="mt-4">
                <p className="text-3xl font-bold text-primary">{warningRecs.length}</p>
                <p className="text-xs text-primary/40 mt-1">Recommendations to optimize</p>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="space-y-1">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="h-4.5 w-4.5" />
                </div>
                <p className="text-xs font-medium text-primary/50 uppercase tracking-wider">Checks Passed</p>
              </div>
              <div className="mt-4">
                {/* Score mapping to passed checks */}
                <p className="text-3xl font-bold text-primary">
                  {10 - criticalRecs.length - warningRecs.length - infoRecs.length}
                </p>
                <p className="text-xs text-primary/40 mt-1">SEO standards met</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabbed Navigation */}
        <div className="flex border-b border-border">
          {(["overview", "meta", "headings", "media"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize border-b-2 transition-all ${
                activeTab === tab
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-primary/60 hover:text-primary"
              }`}
            >
              {tab === "meta" ? "Meta & Social" : tab}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="min-h-[400px]">
          {/* TAB 1: OVERVIEW & RECOMMENDATIONS */}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {audit.recommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-border p-12 text-center bg-card">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-primary">Perfect Score! No issues detected.</p>
                    <p className="text-xs text-primary/50">Your page successfully follows all basic on-page SEO recommendations.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-primary">Action Plan</h3>
                  
                  {audit.recommendations.map((rec: any, index: number) => {
                    const sevColor =
                      rec.severity === "critical"
                        ? "border-red-500/20 bg-red-500/5 text-red-600 dark:text-red-400"
                        : rec.severity === "warning"
                          ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-600 dark:text-yellow-400"
                          : "border-blue-500/20 bg-blue-500/5 text-blue-600 dark:text-blue-400";

                    const SevIcon =
                      rec.severity === "critical"
                        ? ShieldAlert
                        : rec.severity === "warning"
                          ? AlertTriangle
                          : Info;

                    return (
                      <div
                        // biome-ignore lint/react/noArrayIndexKey: static key
                        key={index}
                        className={`flex gap-4 rounded-xl border p-5 ${sevColor}`}
                      >
                        <SevIcon className="h-5 w-5 shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-mono tracking-wider font-bold">
                              {rec.severity}
                            </span>
                            <span className="h-1 w-1 rounded-full bg-current/30" />
                            <span className="text-xs capitalize font-medium opacity-80">
                              Category: {rec.category}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-primary">{rec.message}</h4>
                          <p className="text-xs text-primary/70 leading-relaxed">
                            {rec.suggestion}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: META & SOCIAL PREVIEW */}
          {activeTab === "meta" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Meta Tags Analysis */}
              <div className="lg:col-span-2 space-y-6">
                <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-primary">On-Page Meta Headers</h3>
                  
                  {/* Title */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary/60">Page Title</span>
                      <span className={`font-mono px-2 py-0.5 rounded ${
                        audit.titleLength && audit.titleLength >= 30 && audit.titleLength <= 60
                          ? "bg-green-500/10 text-green-600"
                          : "bg-yellow-500/10 text-yellow-600"
                      }`}>
                        {audit.titleLength ?? 0} / 60 chars
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-background/50 p-3 text-sm text-primary/80 break-words font-medium">
                      {audit.title || <span className="italic text-primary/30">Missing Title Tag</span>}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary/60">Meta Description</span>
                      <span className={`font-mono px-2 py-0.5 rounded ${
                        audit.descriptionLength && audit.descriptionLength >= 100 && audit.descriptionLength <= 160
                          ? "bg-green-500/10 text-green-600"
                          : "bg-yellow-500/10 text-yellow-600"
                      }`}>
                        {audit.descriptionLength ?? 0} / 160 chars
                      </span>
                    </div>
                    <div className="rounded-lg border border-border/80 bg-background/50 p-3 text-sm text-primary/80 break-words leading-relaxed">
                      {audit.description || <span className="italic text-primary/30">Missing Meta Description Tag</span>}
                    </div>
                  </div>

                  {/* Tech specs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/60">
                    <div className="flex items-center justify-between text-sm rounded-lg bg-secondary/10 p-3">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-primary/50" />
                        <span className="text-primary/70">Viewport Responsive</span>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${audit.hasViewport ? "bg-green-500" : "bg-red-500"}`} />
                    </div>

                    <div className="flex items-center justify-between text-sm rounded-lg bg-secondary/10 p-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary/50" />
                        <span className="text-primary/70">Favicon Configured</span>
                      </div>
                      <span className={`h-2.5 w-2.5 rounded-full ${audit.hasFavicon ? "bg-green-500" : "bg-red-500"}`} />
                    </div>
                  </div>

                  {/* Canonical URL */}
                  <div className="space-y-1.5 pt-2">
                    <span className="text-xs font-semibold text-primary/60">Canonical URL Reference</span>
                    <div className="rounded-lg border border-border/80 bg-background/50 p-3 text-xs text-primary/60 truncate font-mono">
                      {audit.canonicalUrl || <span className="italic text-primary/30">Missing Canonical URL Tag</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Social Share Cards Live Mockups */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-primary">Live Share Preview</h3>
                
                {/* Toggle Buttons */}
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-secondary/40 p-1 border border-border/50">
                  {(["google", "facebook", "twitter"] as const).map((platform) => (
                    <button
                      key={platform}
                      onClick={() => setSocialTab(platform)}
                      className={`py-1 text-xs font-medium capitalize rounded-md transition-all ${
                        socialTab === platform
                          ? "bg-card text-primary shadow-sm"
                          : "text-primary/60 hover:text-primary"
                      }`}
                    >
                      {platform}
                    </button>
                  ))}
                </div>

                {/* Mock Card Rendering */}
                <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                  {/* Google Preview */}
                  {socialTab === "google" && (
                    <div className="p-5 font-sans space-y-1 bg-white text-zinc-800">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">Ad</span>
                        <span className="truncate">{audit.url}</span>
                      </div>
                      <h4 className="text-lg font-medium text-blue-800 hover:underline leading-tight cursor-pointer break-words">
                        {audit.title || "Add a page title here"}
                      </h4>
                      <p className="text-xs text-zinc-600 leading-relaxed break-words">
                        {audit.description || "Add a meta description here to describe your page's purpose to search users."}
                      </p>
                    </div>
                  )}

                  {/* Facebook Preview */}
                  {socialTab === "facebook" && (
                    <div className="font-sans bg-zinc-100 text-zinc-900 border-zinc-200">
                      {audit.ogImage ? (
                        // biome-ignore lint/a11y/useAltText: social preview mockup
                        <img src={audit.ogImage} className="h-44 w-full object-cover border-b border-zinc-200" />
                      ) : (
                        <div className="h-44 w-full bg-zinc-200 border-b border-zinc-300 flex items-center justify-center text-zinc-400">
                          <ImageIcon className="h-8 w-8" />
                        </div>
                      )}
                      <div className="p-4 space-y-1.5 bg-white border-b border-zinc-200">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider block font-mono">
                          {new URL(audit.url).hostname}
                        </span>
                        <h4 className="text-sm font-semibold text-zinc-800 line-clamp-1 break-words">
                          {audit.ogTitle || audit.title || "No og:title configured"}
                        </h4>
                        <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed break-words">
                          {audit.ogDescription || audit.description || "No og:description configured."}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Twitter Preview */}
                  {socialTab === "twitter" && (
                    <div className="font-sans bg-black p-4 text-white">
                      <div className="rounded-xl border border-zinc-800 overflow-hidden bg-zinc-950">
                        {audit.ogImage ? (
                          // biome-ignore lint/a11y/useAltText: social preview mockup
                          <img src={audit.ogImage} className="h-40 w-full object-cover" />
                        ) : (
                          <div className="h-40 w-full bg-zinc-900 flex items-center justify-center text-zinc-700">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}
                        <div className="p-3 space-y-1 bg-zinc-900 border-t border-zinc-800">
                          <span className="text-[10px] text-zinc-500 block">
                            {new URL(audit.url).hostname}
                          </span>
                          <h4 className="text-xs font-semibold text-zinc-200 line-clamp-1 break-words">
                            {audit.ogTitle || audit.title || "No title defined"}
                          </h4>
                          <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed break-words">
                            {audit.ogDescription || audit.description || "No description configured."}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: HEADINGS STRUCTURE */}
          {activeTab === "headings" && (
            <div className="space-y-6">
              
              {/* Headings stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
                {(["h1", "h2", "h3", "h4", "h5", "h6"] as const).map((tag) => {
                  const count = audit.headings ? audit.headings[tag].length : 0;
                  return (
                    <div key={tag} className="rounded-xl border border-border bg-card p-4 text-center shadow-sm">
                      <span className="text-xs font-mono font-bold uppercase text-primary/40">{tag}</span>
                      <p className="text-2xl font-bold text-primary mt-1">{count}</p>
                    </div>
                  );
                })}
              </div>

              {/* Structure Outline Visual Tree */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-primary">Heading Structure Tree</h3>
                  {audit.headings?.h1.length === 1 ? (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-2 py-0.5 rounded font-medium">
                      <CheckCircle2 className="h-3 w-3" /> Valid semantic hierarchy
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-500/10 px-2 py-0.5 rounded font-medium">
                      <AlertTriangle className="h-3 w-3" /> Fix H1 count
                    </span>
                  )}
                </div>

                <div className="rounded-lg border border-border/60 bg-background/50 p-6 space-y-4 max-h-[500px] overflow-y-auto">
                  {/* Flatten headings array with tag type for linear rendering */}
                  {(() => {
                    const tree: { tag: string; text: string; indent: string }[] = [];
                    if (audit.headings) {
                      for (let i = 1; i <= 6; i++) {
                        const tag = `h${i}`;
                        const indents: Record<number, string> = {
                          1: "pl-0",
                          2: "pl-4 sm:pl-6 border-l border-border/80 ml-1.5",
                          3: "pl-8 sm:pl-12 border-l border-dashed border-border/60 ml-1.5",
                          4: "pl-12 sm:pl-18 border-l border-dotted border-border/40 ml-1.5",
                          5: "pl-16 sm:pl-24 opacity-80",
                          6: "pl-20 sm:pl-30 opacity-70",
                        };
                        const list = (audit.headings as any)[tag] as string[];
                        for (const text of list) {
                          tree.push({
                            tag: tag.toUpperCase(),
                            text,
                            indent: indents[i] || "pl-0",
                          });
                        }
                      }
                    }

                    if (tree.length === 0) {
                      return (
                        <div className="py-6 text-center text-sm text-primary/30 italic">
                          No heading tags detected.
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3.5">
                        {tree.map((node, index) => (
                          <div key={index} className={`flex items-start gap-3 ${node.indent}`}>
                            <span className="shrink-0 font-mono font-extrabold text-[10px] text-primary/40 bg-secondary/80 px-1.5 py-0.5 rounded border border-border/40">
                              {node.tag}
                            </span>
                            <span className="text-sm font-medium text-primary/80 break-words pt-0.5">
                              {node.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              </div>

            </div>
          )}

          {/* TAB 4: MEDIA & LINKS */}
          {activeTab === "media" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Media Checks Card */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <ImageIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">Image Optimization</h3>
                    <p className="text-xs text-primary/40">Audits alt text attributes for accessibility.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-border/80 bg-secondary/15 p-4 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/40">Total Images</span>
                    <p className="text-2xl font-bold text-primary mt-1">{audit.totalImages}</p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-secondary/15 p-4 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/40">Missing Alt Tags</span>
                    <p className={`text-2xl font-bold mt-1 ${
                      audit.totalImages - audit.imagesWithAlt > 0 ? "text-yellow-600" : "text-green-600"
                    }`}>
                      {audit.totalImages - audit.imagesWithAlt}
                    </p>
                  </div>
                </div>

                {audit.imagesWithoutAlt && audit.imagesWithoutAlt.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-primary/60">Images Missing Alt tags (up to 10):</h4>
                    <div className="divide-y divide-border/40 max-h-[220px] overflow-y-auto rounded-lg border border-border/50 bg-background/50">
                      {audit.imagesWithoutAlt.map((src: string, index: number) => (
                        <div key={index} className="p-3 text-xs text-primary/50 font-mono truncate break-all">
                          {src}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Links Checks Card */}
              <div className="rounded-xl border border-border bg-card p-6 space-y-6 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/5 text-primary">
                    <LinkIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-primary">Anchor Links Review</h3>
                    <p className="text-xs text-primary/40">Tracks internal routing structures vs external sources.</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border/80 bg-secondary/15 p-4 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/40">Total Links</span>
                    <p className="text-2xl font-bold text-primary mt-1">{audit.totalLinks}</p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-secondary/15 p-4 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/40">Internal</span>
                    <p className="text-2xl font-bold text-primary mt-1">{audit.internalLinks}</p>
                  </div>
                  <div className="rounded-lg border border-border/80 bg-secondary/15 p-4 text-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/40">External</span>
                    <p className="text-2xl font-bold text-primary mt-1">{audit.externalLinks}</p>
                  </div>
                </div>

                <div className="space-y-3.5 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-primary/60">Search indexability</span>
                    <span className="font-semibold text-primary/80">Follows crawl standards</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-primary/60">Outbound density ratio</span>
                    <span className="font-semibold text-primary/80">
                      {audit.totalLinks > 0 ? `${Math.round((audit.externalLinks / audit.totalLinks) * 100)}%` : "0%"}
                    </span>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
