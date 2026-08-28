import type { MetadataRoute } from "next";
import { productionOrigin } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: productionOrigin, changeFrequency: "weekly", priority: 1 },
    { url: `${productionOrigin}/how-it-works`, changeFrequency: "monthly", priority: .8 },
    { url: `${productionOrigin}/example`, changeFrequency: "monthly", priority: .8 },
    { url: `${productionOrigin}/install`, changeFrequency: "monthly", priority: .9 },
    { url: `${productionOrigin}/about`, changeFrequency: "monthly", priority: .7 },
    { url: `${productionOrigin}/contact`, changeFrequency: "monthly", priority: .7 },
    { url: `${productionOrigin}/privacy`, changeFrequency: "monthly", priority: .6 },
    { url: `${productionOrigin}/terms`, changeFrequency: "monthly", priority: .6 },
  ];
}
