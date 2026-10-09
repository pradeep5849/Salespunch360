import Link from "next/link";
export function ContentPagination({
  page,
  hasMore,
}: {
  page: number;
  hasMore: boolean;
}) {
  return (
    <nav aria-label="Content pages">
      {page > 1 && <Link href={`?page=${page - 1}`}>Previous page</Link>}
      <span>Page {page}</span>
      {hasMore && <Link href={`?page=${page + 1}`}>Next page</Link>}
    </nav>
  );
}
