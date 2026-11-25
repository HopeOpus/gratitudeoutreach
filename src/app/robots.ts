import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// App pages also carry a noindex tag, so they are left crawlable for it to be seen.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: "/api/" }, sitemap: `${SITE_URL}/sitemap.xml` };
}
