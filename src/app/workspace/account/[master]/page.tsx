import Link from "next/link";
import { CustomFieldInput } from "@/components/account/custom-field-input";
import { notFound } from "next/navigation";
import { WorkspacePageHeader } from "@/components/workspace/workspace-page-header";
import { accountMasterOverview } from "@/lib/account/service";
import { saveAccountMaster } from "@/app/actions/account-masters";
import {
  SaveFeedbackForm,
  SaveSubmitButton,
} from "@/components/account/save-feedback";

const titles: Record<string, string> = {
  "financial-years": "Financial year & currency",
  customers: "Account customers",
  vendors: "Vendors",
  units: "Units",
  categories: "Categories",
  products: "Products",
  services: "Services",
  "work-categories": "Work categories",
  "work-packages": "Work / packages",
};
const input = (
  name: string,
  label: string,
  type = "text",
  required = false,
) => (
  <label>
    {label}
    <input
      name={name}
      type={type}
      required={required}
      step={type === "number" ? "0.01" : undefined}
      min={type === "number" ? "0" : undefined}
      max={name === "taxRate" ? "100" : undefined}
    />
  </label>
);
export default async function MasterPage({
  params,
  searchParams,
}: {
  params: Promise<{ master: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { master } = await params;
  if (!titles[master]) notFound();
  const query = await searchParams,
    d = await accountMasterOverview(master, query);
  let fields: React.ReactNode;
  if (master === "financial-years")
    fields = (
      <>
        {input("name", "Label", "text", true)}
        {input("startDate", "Start date", "date", true)}
        {input("endDate", "End date", "date", true)}
        <label>
          <input name="isCurrent" type="checkbox" value="true" /> Current year
        </label>
      </>
    );
  else if (master === "units")
    fields = (
      <>
        {input("name", "Name", "text", true)}
        {input("symbol", "Symbol", "text", true)}
      </>
    );
  else if (master === "categories")
    fields = (
      <>
        {input("name", "Name", "text", true)}
        {input("description", "Description")}
        <label>
          Scope
          <select name="scope">
            <option value="BOTH">Product & service</option>
            <option value="PRODUCT">Product</option>
            <option value="SERVICE">Service</option>
          </select>
        </label>
      </>
    );
  else if (master === "work-categories")
    fields = (
      <>
        {input("name", "Name", "text", true)}
        {input("description", "Description")}
      </>
    );
  else if (master === "customers" || master === "vendors")
    fields = (
      <>
        {input("name", "Business name", "text", true)}
        {input("contactPerson", "Contact person")}
        {input("phone", "Phone", "tel")}
        {input("email", "Email", "email")}
        {input("address", "Billing / address")}
        {master === "customers" &&
          d.partySettings.shippingAddressEnabled &&
          input("shippingAddress", "Shipping / site address")}
        {d.partySettings.gstinEnabled && (
          <>
            {input("gstin", "GSTIN / TIN / VATIN")}
            {input("stateCode", "GST state code")}
            <label>
              GST registration
              <select name="gstRegistrationType">
                <option>UNREGISTERED</option>
                <option>REGULAR</option>
                <option>COMPOSITION</option>
                <option>SEZ</option>
              </select>
            </label>
            {input("pan", "PAN")}
          </>
        )}
        {input("notes", "Notes")}
        {d.partyCustomFields.map((field) => (
          <CustomFieldInput key={field.id} field={field} />
        ))}
      </>
    );
  else {
    const work = master === "work-packages";
    fields = (
      <>
        {input("name", "Name", "text", true)}
        {input("code", "Code / SKU")}
        {work && (
          <label>
            Work category
            <select name="workCategoryId" required>
              <option value="">Select</option>
              {d.workCategories.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {!work && (
          <label>
            Category
            <select name="categoryId">
              <option value="">None</option>
              {d.accountCategories.map((x) => (
                <option value={x.id} key={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Unit
          <select name="unitId">
            <option value="">None</option>
            {d.accountUnits.map((x) => (
              <option value={x.id} key={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
        {input("description", "Description / specification")}
        {input("sellingRate", "Selling rate", "number")}
        {input("cost", "Estimated / cost rate", "number")}
        {!work && input("taxRate", "GST %", "number")}
        {!work && input("hsnSacCode", master === "products" ? "HSN" : "SAC")}
      </>
    );
  }
  const rows =
    master === "customers"
      ? d.customers
      : master === "vendors"
        ? d.vendors
        : master === "units"
          ? d.accountUnits
          : master === "categories"
            ? d.accountCategories
            : master === "products"
              ? d.accountProducts
              : master === "services"
                ? d.accountServices
                : master === "work-categories"
                  ? d.workCategories
                  : master === "work-packages"
                    ? d.workPackages
                    : d.financialYears;
  const href = (page: number) =>
    `/workspace/account/${master}?${new URLSearchParams({ ...(d.q ? { q: d.q } : {}), page: String(page) }).toString()}`;
  return (
    <div className="employees-shell">
      <section className="employees-content">
        <WorkspacePageHeader
          title={titles[master]}
          backHref="/workspace/account"
        />
        <form method="get" className="account-master-form">
          <label>
            Search
            <input
              name="q"
              defaultValue={d.q}
              placeholder={`Search ${titles[master]}`}
            />
          </label>
          <button>Search</button>
        </form>
        {d.canCreate && (
          <SaveFeedbackForm
            action={saveAccountMaster}
            className="account-master-form"
            successMessage={`${titles[master]} saved successfully`}
          >
            <input type="hidden" name="type" value={master} />
            {fields}
            <SaveSubmitButton className="primary-button" pendingLabel="Saving…">
              Add
            </SaveSubmitButton>
          </SaveFeedbackForm>
        )}
        <div className="customer-grid">
          {rows.map((x) => (
            <article key={x.id}>
              <h2>{x.name}</h2>
              {"symbol" in x && <p>{String(x.symbol)}</p>}
              {"code" in x && <p>{String(x.code ?? "")}</p>}
              {"isCurrent" in x && Boolean(x.isCurrent) && (
                <strong>Current</strong>
              )}
            </article>
          ))}
        </div>
        <nav>
          {d.page > 1 && <Link href={href(d.page - 1)}>Previous</Link>}{" "}
          {d.hasMore && <Link href={href(d.page + 1)}>Next</Link>}
        </nav>
        <Link href="/workspace/account">Back to Account</Link>
      </section>
    </div>
  );
}
