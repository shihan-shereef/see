import { getAuthUserId } from "@convex-dev/auth/server";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  mutation,
  query,
} from "./_generated/server";
import { audit } from "./auditLog";
import { bump } from "./counters";
import { requireMember } from "./orgs";
import { recordUsage } from "./usage";

// Multi-tenant SEO Auditing module

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  handler: async (ctx, { workspaceId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    await requireMember(ctx, userId, workspaceId);
    return ctx.db
      .query("seoAudits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(50);
  },
});

export const get = query({
  args: { auditId: v.id("seoAudits") },
  handler: async (ctx, { auditId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const item = await ctx.db.get(auditId);
    if (!item) return null;
    await requireMember(ctx, userId, item.workspaceId);
    return item;
  },
});

export const listPaged = query({
  args: {
    workspaceId: v.id("workspaces"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { workspaceId, paginationOpts }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { page: [], isDone: true, continueCursor: "" };
    await requireMember(ctx, userId, workspaceId);
    return ctx.db
      .query("seoAudits")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

export const startAudit = mutation({
  args: {
    workspaceId: v.id("workspaces"),
    url: v.string(),
  },
  handler: async (ctx, { workspaceId, url }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await requireMember(ctx, userId, workspaceId);

    // Normalize URL
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      new URL(targetUrl);
    } catch {
      throw new Error("Invalid URL format");
    }

    const now = Date.now();
    const auditId = await ctx.db.insert("seoAudits", {
      workspaceId,
      userId,
      url: targetUrl,
      score: 0,
      status: "pending",
      createdAt: now,
      hasViewport: false,
      hasFavicon: false,
      totalImages: 0,
      imagesWithAlt: 0,
      imagesWithoutAlt: [],
      totalLinks: 0,
      internalLinks: 0,
      externalLinks: 0,
      recommendations: [],
    });

    await recordUsage(ctx, workspaceId, "seo.audits.run");
    await audit(ctx, workspaceId, userId, "seo.audit.start", { auditId, url: targetUrl });
    await bump(ctx, workspaceId, "seoAuditsTotal", 1);

    // Run action asynchronously in the background
    await ctx.scheduler.runAfter(0, internal.seo.runAudit, { auditId, url: targetUrl });

    return auditId;
  },
});

export const runAudit = internalAction({
  args: {
    auditId: v.id("seoAudits"),
    url: v.string(),
  },
  handler: async (ctx, { auditId, url }) => {
    await ctx.runMutation(internal.seo.setStatus, { auditId, status: "running" });

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
        signal: AbortSignal.timeout(15000), // 15 seconds timeout
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page: HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      const results = analyzeHTML(html, url);

      await ctx.runMutation(internal.seo.saveAuditResult, {
        auditId,
        results,
      });
    } catch (e) {
      console.error(`SEO Audit error for ${url}:`, e);
      await ctx.runMutation(internal.seo.failAudit, {
        auditId,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  },
});

export const setStatus = internalMutation({
  args: { auditId: v.id("seoAudits"), status: v.string() },
  handler: async (ctx, { auditId, status }) => {
    await ctx.db.patch(auditId, { status });
  },
});

export const saveAuditResult = internalMutation({
  args: {
    auditId: v.id("seoAudits"),
    results: v.any(),
  },
  handler: async (ctx, { auditId, results }) => {
    const current = await ctx.db.get(auditId);
    if (!current) return;
    await ctx.db.patch(auditId, {
      status: "completed",
      completedAt: Date.now(),
      score: results.score,
      title: results.title,
      titleLength: results.titleLength,
      description: results.description,
      descriptionLength: results.descriptionLength,
      headings: results.headings,
      ogTitle: results.ogTitle,
      ogDescription: results.ogDescription,
      ogImage: results.ogImage,
      twitterCard: results.twitterCard,
      hasViewport: results.hasViewport,
      hasFavicon: results.hasFavicon,
      canonicalUrl: results.canonicalUrl,
      totalImages: results.totalImages,
      imagesWithAlt: results.imagesWithAlt,
      imagesWithoutAlt: results.imagesWithoutAlt,
      totalLinks: results.totalLinks,
      internalLinks: results.internalLinks,
      externalLinks: results.externalLinks,
      recommendations: results.recommendations,
    });
  },
});

export const failAudit = internalMutation({
  args: {
    auditId: v.id("seoAudits"),
    error: v.string(),
  },
  handler: async (ctx, { auditId, error }) => {
    const current = await ctx.db.get(auditId);
    if (!current) return;
    await ctx.db.patch(auditId, {
      status: "failed",
      completedAt: Date.now(),
      error,
    });
  },
});

export const remove = mutation({
  args: { auditId: v.id("seoAudits") },
  handler: async (ctx, { auditId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const item = await ctx.db.get(auditId);
    if (!item) throw new Error("Audit not found");
    await requireMember(ctx, userId, item.workspaceId);

    await ctx.db.delete(auditId);
    await audit(ctx, item.workspaceId, userId, "seo.audit.delete", { auditId, url: item.url });
    await bump(ctx, item.workspaceId, "seoAuditsTotal", -1);
  },
});

// Clean text by stripping extra spaces, inner HTML tags, and HTML entities
function cleanText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Regex HTML SEO Scanner
function analyzeHTML(html: string, url: string) {
  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch && titleMatch[1] ? cleanText(titleMatch[1]) : undefined;
  const titleLength = title ? title.length : undefined;

  // Description
  const descRegex = /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i;
  const descRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i;
  const descMatch = html.match(descRegex) || html.match(descRegexAlt);
  const description = descMatch && descMatch[1] ? cleanText(descMatch[1]) : undefined;
  const descriptionLength = description ? description.length : undefined;

  // Headings H1-H6
  const headings = {
    h1: [] as string[],
    h2: [] as string[],
    h3: [] as string[],
    h4: [] as string[],
    h5: [] as string[],
    h6: [] as string[],
  };
  const headingRegex = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: loop over exec results
  while ((hMatch = headingRegex.exec(html)) !== null) {
    const level = parseInt(hMatch[1] || "1") as 1 | 2 | 3 | 4 | 5 | 6;
    const text = cleanText(hMatch[2] || "");
    if (text) {
      headings[`h${level}`].push(text);
    }
  }

  // Social tags (Open Graph & Twitter)
  const ogTitleRegex = /<meta[^>]*(?:property|name)=["']og:title["'][^]*content=["']([^"']*)["']/i;
  const ogTitleRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']og:title["']/i;
  const ogTitle = (html.match(ogTitleRegex) || html.match(ogTitleRegexAlt))?.[1] || undefined;

  const ogDescRegex = /<meta[^>]*(?:property|name)=["']og:description["'][^]*content=["']([^"']*)["']/i;
  const ogDescRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']og:description["']/i;
  const ogDescription = (html.match(ogDescRegex) || html.match(ogDescRegexAlt))?.[1] || undefined;

  const ogImageRegex = /<meta[^>]*(?:property|name)=["']og:image["'][^]*content=["']([^"']*)["']/i;
  const ogImageRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']og:image["']/i;
  const ogImage = (html.match(ogImageRegex) || html.match(ogImageRegexAlt))?.[1] || undefined;

  const twitterRegex = /<meta[^>]*(?:property|name)=["']twitter:card["'][^]*content=["']([^"']*)["']/i;
  const twitterRegexAlt = /<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']twitter:card["']/i;
  const twitterCard = (html.match(twitterRegex) || html.match(twitterRegexAlt))?.[1] || undefined;

  // Viewport & Favicon
  const hasViewport = /<meta[^>]*name=["']viewport["']/i.test(html);
  const hasFavicon = /<link[^>]*rel=["'](?:shortcut )?icon["']/i.test(html) || /href=["'][^"']*(?:favicon\.ico|\.png)["']/i.test(html);

  // Canonical
  const canonicalRegex = /<link[^>]*rel=["']canonical["'][^]*href=["']([^"']*)["']/i;
  const canonicalRegexAlt = /<link[^>]*href=["']([^"']*)["'][^]*rel=["']canonical["']/i;
  const canonicalUrl = (html.match(canonicalRegex) || html.match(canonicalRegexAlt))?.[1] || undefined;

  // Images Alt Checks
  const imagesWithoutAlt: string[] = [];
  const imgRegex = /<img\s+([^>]+)>/gi;
  let totalImages = 0;
  let imagesWithAlt = 0;
  let imgMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: loop over exec results
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    totalImages++;
    const attrs = imgMatch[1] || "";
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const srcMatch = attrs.match(/src=["']([^"']*)["']/i);
    const alt = altMatch && altMatch[1] ? altMatch[1].trim() : "";
    const src = srcMatch && srcMatch[1] ? srcMatch[1] : "";
    if (alt) {
      imagesWithAlt++;
    } else if (src) {
      imagesWithoutAlt.push(src);
    }
  }

  // Anchor Links
  const origin = new URL(url).origin;
  let totalLinks = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  const linkRegex = /<a\s+[^>]*href=["']([^"']*)["']/gi;
  let lMatch: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: loop over exec results
  while ((lMatch = linkRegex.exec(html)) !== null) {
    const href = (lMatch[1] || "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    totalLinks++;
    if (href.startsWith("/") || href.startsWith(origin) || !/^[a-z]+:\/\//i.test(href)) {
      internalLinks++;
    } else {
      externalLinks++;
    }
  }

  // Scoring and Actionable Recommendations
  const recommendations: { category: string; severity: string; message: string; suggestion: string }[] = [];
  let score = 100;

  // Title Audit
  if (!title) {
    score -= 15;
    recommendations.push({
      category: "meta",
      severity: "critical",
      message: "Missing page Title tag",
      suggestion: "Add a <title> tag inside the <head> of the document. Keep it between 30-60 characters.",
    });
  } else if (title.length < 30 || title.length > 60) {
    score -= 5;
    recommendations.push({
      category: "meta",
      severity: "warning",
      message: `Title length is sub-optimal (${title.length} characters)`,
      suggestion: `Modify your page title to be between 30 and 60 characters for optimal visibility in search results. Current title: "${title}"`,
    });
  }

  // Description Audit
  if (!description) {
    score -= 15;
    recommendations.push({
      category: "meta",
      severity: "critical",
      message: "Missing Meta Description tag",
      suggestion: "Add a <meta name='description' content='...'> tag in the <head> to summarize the page content.",
    });
  } else if (description.length < 100 || description.length > 160) {
    score -= 5;
    recommendations.push({
      category: "meta",
      severity: "warning",
      message: `Meta description length is sub-optimal (${description.length} characters)`,
      suggestion: `Modify your description to be between 100 and 160 characters to ensure it isn't truncated in search engines. Current description: "${description}"`,
    });
  }

  // Headings Structure Audit
  const h1Count = headings.h1.length;
  if (h1Count === 0) {
    score -= 15;
    recommendations.push({
      category: "headings",
      severity: "critical",
      message: "Missing H1 heading",
      suggestion: "Add exactly one H1 tag representing the primary topic of your page.",
    });
  } else if (h1Count > 1) {
    score -= 10;
    recommendations.push({
      category: "headings",
      severity: "critical",
      message: `Multiple H1 headings detected (${h1Count})`,
      suggestion: "Reduce H1 tags to exactly one. Use H2 or H3 tags for subsequent sub-headings.",
    });
  }

  // Viewport
  if (!hasViewport) {
    score -= 15;
    recommendations.push({
      category: "mobile",
      severity: "critical",
      message: "Missing responsive viewport meta tag",
      suggestion: "Add <meta name='viewport' content='width=device-width, initial-scale=1'> to enable mobile responsive layouts.",
    });
  }

  // Favicon
  if (!hasFavicon) {
    score -= 5;
    recommendations.push({
      category: "meta",
      severity: "warning",
      message: "Missing website Favicon icon",
      suggestion: "Configure a favicon.ico or PNG image and link it in the <head> to improve brand presence and SEO trust.",
    });
  }

  // Canonical URL
  if (!canonicalUrl) {
    score -= 5;
    recommendations.push({
      category: "meta",
      severity: "warning",
      message: "Missing canonical link tag",
      suggestion: "Add a <link rel='canonical' href='...'> tag pointing to the authoritative URL of this page to avoid index duplication.",
    });
  }

  // Image Alts
  const missingAltCount = totalImages - imagesWithAlt;
  if (totalImages > 0 && missingAltCount > 0) {
    const penalty = Math.min(15, missingAltCount * 3);
    score -= penalty;
    recommendations.push({
      category: "media",
      severity: "warning",
      message: `${missingAltCount} out of ${totalImages} images are missing alt attributes`,
      suggestion: "Provide meaningful descriptive 'alt' attribute values to all <img> tags to improve accessibility and image SEO.",
    });
  }

  // Links
  if (totalLinks === 0) {
    score -= 5;
    recommendations.push({
      category: "links",
      severity: "warning",
      message: "No anchor links found on this page",
      suggestion: "Add internal links to other pages or external links to related resources to help search bots crawl your site.",
    });
  } else if (externalLinks === 0) {
    score -= 5;
    recommendations.push({
      category: "links",
      severity: "info",
      message: "No external outbound links detected",
      suggestion: "Consider linking to high-quality external resources when referencing facts to improve site credibility.",
    });
  }

  // Social OG metadata
  if (!ogTitle || !ogDescription || !ogImage) {
    score -= 5;
    recommendations.push({
      category: "social",
      severity: "info",
      message: "Incomplete Open Graph markup",
      suggestion: "Configure og:title, og:description, and og:image tags to control how your page renders when shared on messaging and social platforms.",
    });
  }

  score = Math.max(0, score);

  return {
    score,
    title,
    titleLength,
    description,
    descriptionLength,
    headings,
    ogTitle,
    ogDescription,
    ogImage,
    twitterCard,
    hasViewport,
    hasFavicon,
    canonicalUrl,
    totalImages,
    imagesWithAlt,
    imagesWithoutAlt: imagesWithoutAlt.slice(0, 10),
    totalLinks,
    internalLinks,
    externalLinks,
    recommendations,
  };
}
