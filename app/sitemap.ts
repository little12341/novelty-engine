import type { MetadataRoute } from "next";
import { productionOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{
    url: productionOrigin,
    changeFrequency: "weekly",
    priority: 1,
  }];
}
