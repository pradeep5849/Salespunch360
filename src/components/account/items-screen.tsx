"use client";
import Link from "next/link";
import { formatStockQuantity } from "@/lib/account/quantity-display";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AccountIcon, type AccountIconName } from "./account-icons";

type Item = {
  id: string;
  type: "PRODUCT" | "SERVICE";
  name: string;
  code: string | null;
  categoryId: string | null;
  category: string | null;
  salePrice: string;
  purchasePrice: string;
  stock: string | null;
};
type Category = { id: string; name: string };
const links: {
  label: string;
  href: string;
  icon: AccountIconName;
  settings?: boolean;
}[] = [
  {
    label: "Online Store",
    href: "/workspace/account/inventory/online-store",
    icon: "store",
  },
  {
    label: "Stock Summary",
    href: "/workspace/account/inventory/stock-summary",
    icon: "stock",
  },
  {
    label: "Item Settings",
    href: "/workspace/account/inventory/item-settings",
    icon: "settings",
    settings: true,
  },
  {
    label: "Show All",
    href: "/workspace/account/inventory/catalog?type=PRODUCT",
    icon: "grid",
  },
];
const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});
function containDialogFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab") return;
  const dialog = event.currentTarget;
  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
    ),
  ).filter((node) => node.getClientRects().length > 0);
  const first = focusable[0],
    last = focusable[focusable.length - 1];
  if (!first || !last) {
    event.preventDefault();
    dialog.focus();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
export function ItemsScreen({
  items,
  categories,
  canConfigure,
  quantityDecimals,
  initialType,
  catalogMode = false,
  contextQuery = "",
}: {
  items: Item[];
  categories: Category[];
  canConfigure: boolean;
  quantityDecimals: number;
  initialType?: "PRODUCT" | "SERVICE";
  catalogMode?: boolean;
  contextQuery?: string;
}) {
  const catalogHref = (type: "PRODUCT" | "SERVICE") =>
    `/workspace/account/inventory/catalog?${new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(contextQuery)), type })}`;
  const [q, setQ] = useState(""),
    [filterOpen, setFilterOpen] = useState(false),
    [moreOpen, setMoreOpen] = useState(false),
    [types, setTypes] = useState<Set<string>>(
      new Set(initialType ? [initialType] : []),
    ),
    [cats, setCats] = useState<Set<string>>(new Set()),
    [draftTypes, setDraftTypes] = useState<Set<string>>(new Set()),
    [draftCats, setDraftCats] = useState<Set<string>>(new Set());
  const filterDialog = useRef<HTMLDialogElement>(null);
  const moreDialog = useRef<HTMLDialogElement>(null);
  const [shareMessage, setShareMessage] = useState("");
  useEffect(() => {
    if (filterOpen) filterDialog.current?.showModal();
    else filterDialog.current?.close();
  }, [filterOpen]);
  useEffect(() => {
    if (moreOpen) moreDialog.current?.showModal();
    else moreDialog.current?.close();
  }, [moreOpen]);
  const visible = useMemo(
    () =>
      items.filter((i) => {
        const search = `${i.name} ${i.code ?? ""}`
          .toLowerCase()
          .includes(q.toLowerCase());
        const typeOk = !types.size || types.has(i.type);
        const catOk = !cats.size || (i.categoryId && cats.has(i.categoryId));
        return (
          search && typeOk && catOk && (!catalogMode || i.type === initialType)
        );
      }),
    [items, q, types, cats, catalogMode, initialType],
  );
  const openFilter = () => {
    setDraftTypes(new Set(types));
    setDraftCats(new Set(cats));
    setFilterOpen(true);
  };
  const toggle = (set: Set<string>, value: string) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };
  const share = async (item: Item) => {
    const text = `${item.name}${item.code ? ` (${item.code})` : ""} · ${currency.format(Number(item.salePrice))}`;
    setShareMessage("");
    try {
      if (navigator.share) await navigator.share({ title: item.name, text });
      else {
        await navigator.clipboard.writeText(text);
        setShareMessage("Item details copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareMessage("Unable to share item details. Please try again.");
    }
  };
  return (
    <div className="account-items-screen">
      <header className="account-page-header">
        <div>
          <h1>Items</h1>
          <p>Products, services and live inventory</p>
        </div>
      </header>
      {catalogMode ? (
        <nav className="items-section-tabs" aria-label="Items sections">
          <Link
            href={catalogHref("PRODUCT")}
            aria-current={initialType === "PRODUCT" ? "page" : undefined}
          >
            Products
          </Link>
          <Link
            href={catalogHref("SERVICE")}
            aria-current={initialType === "SERVICE" ? "page" : undefined}
          >
            Services
          </Link>
          <Link href="/workspace/account/inventory/categories">Categories</Link>
          <Link href="/workspace/account/inventory/units">Units</Link>
        </nav>
      ) : (
        <section className="account-card account-quick-card">
          <h2>Quick Links</h2>
          <div>
            {links
              .filter((x) => !x.settings || canConfigure)
              .map((x) => (
                <Link
                  href={
                    x.label === "Show All" ? catalogHref("PRODUCT") : x.href
                  }
                  key={x.label}
                >
                  <span>
                    <AccountIcon name={x.icon} />
                  </span>
                  {x.label}
                </Link>
              ))}
          </div>
        </section>
      )}
      <div className="items-search-row">
        <label className="items-search-box">
          <AccountIcon name="search" />
          <input
            aria-label="Search items"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search for an item or code"
          />
        </label>
        <button
          type="button"
          className="items-filter-button"
          onClick={openFilter}
          aria-label="Filter items"
        >
          <AccountIcon name="filter" />
        </button>
        <button
          type="button"
          className="items-more-button"
          onClick={() => setMoreOpen(true)}
          aria-label="More item options"
        >
          ⋮
        </button>
      </div>
      <p role="status" aria-live="polite">
        {shareMessage || `${visible.length} items match the current filters.`}
      </p>
      <section className="account-item-list">
        {visible.length ? (
          visible.map((item) => (
            <article className="account-item-card" key={item.id}>
              <div>
                <h2>{item.name}</h2>
                {item.category && (
                  <span className="account-category">{item.category}</span>
                )}
                <small>{item.code || "No item code"}</small>
              </div>
              <button
                onClick={() => void share(item)}
                aria-label={`Share ${item.name}`}
              >
                <AccountIcon name="share" />
              </button>
              <dl>
                <div>
                  <dt>Sale price</dt>
                  <dd>{currency.format(Number(item.salePrice))}</dd>
                </div>
                <div>
                  <dt>Purchase price</dt>
                  <dd>{currency.format(Number(item.purchasePrice))}</dd>
                </div>
                <div>
                  <dt>{item.type === "PRODUCT" ? "In Stock" : "Type"}</dt>
                  <dd
                    className={
                      item.stock !== null && item.stock.startsWith("-")
                        ? "negative"
                        : undefined
                    }
                  >
                    {item.stock === null
                      ? "Service"
                      : formatStockQuantity(item.stock, quantityDecimals)}
                  </dd>
                </div>
              </dl>
            </article>
          ))
        ) : (
          <div className="account-home-empty">
            <strong>
              {catalogMode
                ? initialType === "SERVICE"
                  ? "No services found"
                  : "No products found"
                : "No items found"}
            </strong>
            <p>Try another item name, code or category.</p>
          </div>
        )}
      </section>
      <Link
        className="account-floating-action"
        href={`/workspace/account/inventory/items/new${catalogMode && initialType === "SERVICE" ? "?kind=services" : ""}`}
      >
        ＋{" "}
        {catalogMode
          ? initialType === "SERVICE"
            ? "Add Service"
            : "Add Product"
          : "Add New Item"}
      </Link>

      <dialog
        ref={filterDialog}
        onKeyDown={containDialogFocus}
        className="items-modal"
        aria-labelledby="items-filter-title"
        onCancel={() => setFilterOpen(false)}
      >
        <section className="items-filter-sheet">
          <header>
            <h2 id="items-filter-title">Filter By</h2>
            <button onClick={() => setFilterOpen(false)} aria-label="Close">
              ×
            </button>
          </header>
          <div className="items-filter-list">
            {[
              ["PRODUCT", "Products"],
              ["SERVICE", "Services"],
            ].map(([value, label]) => (
              <label key={value}>
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={draftTypes.has(value)}
                  onChange={() => setDraftTypes(toggle(draftTypes, value))}
                />
              </label>
            ))}
            <h3>Categories</h3>
            {categories.map((cat) => (
              <label key={cat.id}>
                <span>{cat.name}</span>
                <input
                  type="checkbox"
                  checked={draftCats.has(cat.id)}
                  onChange={() => setDraftCats(toggle(draftCats, cat.id))}
                />
              </label>
            ))}
          </div>
          <footer>
            <button
              onClick={() => {
                setDraftTypes(new Set());
                setDraftCats(new Set());
              }}
            >
              Clear
            </button>
            <button
              onClick={() => {
                setTypes(new Set(draftTypes));
                setCats(new Set(draftCats));
                setFilterOpen(false);
              }}
            >
              Apply
            </button>
          </footer>
        </section>
      </dialog>

      <dialog
        ref={moreDialog}
        onKeyDown={containDialogFocus}
        className="items-modal"
        aria-labelledby="items-more-title"
        onCancel={() => setMoreOpen(false)}
      >
        <section>
          <header>
            <h2 id="items-more-title">More Options</h2>
            <button onClick={() => setMoreOpen(false)} aria-label="Close">
              ×
            </button>
          </header>
          <Link
            className="sale-more-row"
            href="/workspace/account/inventory/active?mode=activate"
            onClick={() => setMoreOpen(false)}
          >
            Mark Items Active <b>›</b>
          </Link>
          <Link
            className="sale-more-row"
            href="/workspace/account/inventory/active?mode=deactivate"
            onClick={() => setMoreOpen(false)}
          >
            Mark Items Inactive <b>›</b>
          </Link>
          <Link
            className="sale-more-row"
            href="/workspace/account/inventory/units"
            onClick={() => setMoreOpen(false)}
          >
            Units <b>›</b>
          </Link>
          <Link
            className="sale-more-row"
            href="/workspace/account/inventory/categories"
            onClick={() => setMoreOpen(false)}
          >
            Categories <b>›</b>
          </Link>
        </section>
      </dialog>
    </div>
  );
}
