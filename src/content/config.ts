import { defineCollection, z } from "astro:content";

const publications = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    venue: z.string(),
    venue_short: z.string(),
    year: z.number(),
    links: z.record(z.string(), z.string()).optional(),
    bibtex: z.string().optional(),
  }),
});

export const collections = { publications };
