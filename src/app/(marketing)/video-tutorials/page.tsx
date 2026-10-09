import { ContentPagination } from "@/components/public/content-pagination";
import {
  publicContentPage,
  PUBLIC_CONTENT_PAGE_SIZE,
} from "@/lib/public-site/pagination";
import type { Metadata } from "next";
import Image from "next/image";
import { db } from "@/lib/db";
export const metadata: Metadata = {
  title: "Video Tutorials",
  description: "Official SalesPunch360 product tutorials.",
  alternates: { canonical: "/video-tutorials" },
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const page = publicContentPage((await searchParams).page);
  const rows = await db.publicVideoTutorial.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PUBLIC_CONTENT_PAGE_SIZE,
    take: PUBLIC_CONTENT_PAGE_SIZE + 1,
  });
  const videos = rows.slice(0, PUBLIC_CONTENT_PAGE_SIZE);
  return (
    <div className="content-page">
      <p className="eyebrow">SUPPORT</p>
      <h1>Video Tutorials</h1>
      <p>Official walkthroughs and training for SalesPunch360.</p>
      <section className="card-grid">
        {videos.length ? (
          videos.map((v) => (
            <article className="card" key={v.id}>
              {v.thumbnailUrl ? (
                <Image
                  src={v.thumbnailUrl}
                  alt=""
                  width={640}
                  height={360}
                  unoptimized
                />
              ) : null}
              <small>
                {v.product === "SALES"
                  ? "Sales Tracking"
                  : v.product === "ACCOUNT"
                    ? "Account & Business"
                    : v.product === "PLUS"
                      ? "SalesPunch360 Plus"
                      : "General"}
              </small>
              <h2>{v.title}</h2>
              {v.description ? <p>{v.description}</p> : null}
              <a
                className="learn"
                href={v.videoUrl}
                target="_blank"
                rel="noreferrer"
              >
                Watch tutorial →
              </a>
            </article>
          ))
        ) : (
          <p>Tutorials will be published here soon.</p>
        )}
      </section>
      <ContentPagination
        page={page}
        hasMore={rows.length > PUBLIC_CONTENT_PAGE_SIZE}
      />
    </div>
  );
}
