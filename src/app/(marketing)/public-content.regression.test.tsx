import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({ testimonials: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: { publicTestimonial: { findMany: m.testimonials } },
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) =>
    React.createElement("img", { src, alt }),
}));
import Home from "./page";
beforeEach(() => vi.resetAllMocks());
it("respects an empty publication state and does not fabricate customer stories or business statistics", async () => {
  m.testimonials.mockResolvedValue([]);
  const html = renderToStaticMarkup(await Home());
  expect(html).not.toContain("Imran K.");
  expect(html).not.toContain("Priya M.");
  for (const claim of ["50,000+", "1,000+", "95%", "99.9%"])
    expect(html).not.toContain(claim);
});
it("published testimonials expose a named keyboard scrolling region", async () => {
  m.testimonials.mockResolvedValue([
    {
      id: "fixture",
      customerName: "Test customer",
      customerRole: "Test role",
      companyName: null,
      imagePath: null,
      quote: "Published fixture statement",
      rating: 4,
    },
  ]);
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain("Published fixture statement");
  expect(html).toContain('tabindex="0"');
  expect(html).toContain("Customer testimonials; scroll horizontally");
});
