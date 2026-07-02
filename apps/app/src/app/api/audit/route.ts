import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      new URL(targetUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    let html = "";
    const ollagraphKey = process.env.OLLAGRAPH_API_KEY || "sk-t0-KSm7dKs9VRgU-cr1kRqgWm7E0u7EoJmJBRTZHdZomG1GYoquMg4lk8k4zeL52";

    if (ollagraphKey && !ollagraphKey.startsWith("mock_")) {
      try {
        const baseUrl = process.env.OLLAGRAPH_API_URL || "https://api.ollagraphic";
        const response = await fetch(`${baseUrl}/v1/scrape`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${ollagraphKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: targetUrl,
          }),
          signal: AbortSignal.timeout(15000),
        });

        if (response.ok) {
          const data = await response.json();
          html = data.html || data.raw_html || data.rawHtml || data.text || data.content || "";
        } else {
          console.warn(`Ollagraph API returned status ${response.status}. Falling back to direct fetch.`);
        }
      } catch (err) {
        console.warn("Ollagraph API call failed, falling back to direct fetch:", err);
      }
    }

    if (!html) {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return NextResponse.json({
          error: `Failed to fetch page: HTTP ${response.status} ${response.statusText}`
        }, { status: 400 });
      }

      html = await response.text();
    }

    const results = analyzeHTML(html, targetUrl);

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err)
    }, { status: 500 });
  }
}

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
