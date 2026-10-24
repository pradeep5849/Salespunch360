import ItemsPage from "../page";
export const metadata = { title: "Item Catalogue | SalesPunch360" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    branchId?: string;
    scope?: string;
    type?: string;
    asOf?: string;
  }>;
}) {
  return ItemsPage({
    searchParams: searchParams.then((query) => ({ ...query, view: "catalog" })),
  });
}
