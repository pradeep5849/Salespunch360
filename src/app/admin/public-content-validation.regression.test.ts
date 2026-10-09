import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  permit: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  find: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/authorization", () => ({
  requireGlobalSuperAdmin: m.permit,
}));
vi.mock("@/lib/db", () => ({
  db: {
    publicBlogPost: { create: m.create, update: m.update, findUnique: m.find },
    publicTestimonial: {
      create: m.create,
      update: m.update,
      findUnique: m.find,
    },
    publicVideoTutorial: { create: m.create, update: m.update },
  },
}));
import { createBlogPostAction, updateBlogPostAction } from "./blog/actions";
import {
  createTestimonialAction,
  updateTestimonialAction,
} from "./testimonials/actions";
import {
  createTutorialAction,
  updateTutorialAction,
} from "./video-tutorials/actions";
beforeEach(() => {
  vi.resetAllMocks();
  m.permit.mockResolvedValue({ id: "admin" });
  m.find.mockResolvedValue({
    id: "existing",
    slug: "article",
    publishedAt: null,
    imagePath: null,
  });
});
it.each([
  ["article", createBlogPostAction, "content", 30000, { title: "Article" }],
  [
    "article edit",
    updateBlogPostAction,
    "content",
    30000,
    { id: "existing", title: "Article" },
  ],
  [
    "testimonial",
    createTestimonialAction,
    "quote",
    2000,
    { customerName: "Customer" },
  ],
  [
    "testimonial edit",
    updateTestimonialAction,
    "quote",
    2000,
    { id: "existing", customerName: "Customer" },
  ],
  [
    "tutorial",
    createTutorialAction,
    "description",
    800,
    { title: "Tutorial", videoUrl: "https://example.com/video" },
  ],
  [
    "tutorial edit",
    updateTutorialAction,
    "description",
    800,
    {
      id: "existing",
      title: "Tutorial",
      videoUrl: "https://example.com/video",
    },
  ],
] as const)(
  "rejects overlong %s before persistence",
  async (_name, action, field, max, other) => {
    const form = new FormData();
    Object.entries(other).forEach(([k, v]) => form.set(k, v));
    form.set(field, "x".repeat(max + 1));
    await expect(action(form)).rejects.toThrow(`${max}-character`);
    expect(m.create).not.toHaveBeenCalled();
    expect(m.update).not.toHaveBeenCalled();
  },
);
