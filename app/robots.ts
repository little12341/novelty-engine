import type { MetadataRoute } from "next";
import { productionOrigin } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/research-debug"],
    },
    sitemap: `${productionOrigin}/sitemap.xml`,
    host: productionOrigin,
  };
}
