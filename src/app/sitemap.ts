import type { MetadataRoute } from "next";
import { OUTREACH_PATH, SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: SITE_URL }, { url: `${SITE_URL}${OUTREACH_PATH}` }];
}
