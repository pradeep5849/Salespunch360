"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProductPriceAction } from "@/app/actions/inventory";
import type { InventoryPriceType } from "@prisma/client";
export function ProductPriceForm({
  productId,
  productName,
  wholesale,
  partyWise,
  customers,
}: {
  productId: string;
  productName: string;
  wholesale: boolean;
  partyWise: boolean;
  customers: Array<{ id: string; name: string }>;
}) {
  const [type, setType] = useState<InventoryPriceType>("RETAIL"),
    [pending, startTransition] = useTransition(),
    [error, setError] = useState<string | null>(null),
    [success, setSuccess] = useState<string | null>(null),
    [fields, setFields] = useState<Record<string, string>>({});
  const form = useRef<HTMLFormElement>(null),
    router = useRouter();
  const types: Array<InventoryPriceType> = [
      "RETAIL",
      ...(wholesale ? ["WHOLESALE" as const] : []),
      ...(partyWise ? ["CUSTOMER" as const] : []),
    ],
    selected = types.includes(type) ? type : "RETAIL";
  return (
    <form
      ref={form}
      aria-label={`Price for ${productName}`}
      className="stack product-price-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const data = new FormData(event.currentTarget);
        setError(null);
        setSuccess(null);
        setFields({});
        startTransition(async () => {
          const result = await saveProductPriceAction(data);
          if (result.kind === "error") {
            setError(result.message);
            setFields(result.fieldErrors ?? {});
          } else {
            setSuccess(result.message);
            form.current?.reset();
            setType("RETAIL");
            router.refresh();
          }
        });
      }}
    >
      <fieldset disabled={pending} className="stack">
        <input type="hidden" name="productId" value={productId} />
        <label>
          Price type
          <select
            name="priceType"
            aria-label="Price type"
            value={selected}
            onChange={(event) =>
              setType(event.target.value as InventoryPriceType)
            }
          >
            {types.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {selected === "CUSTOMER" && (
          <label>
            Customer
            <select name="customerId" aria-label="Customer" required>
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Price rate
          <input
            aria-label="Price rate"
            name="rate"
            type="number"
            min="0"
            step=".0001"
            required
          />
        </label>
        {fields.rate && <p role="alert">{fields.rate}</p>}
        <label>
          Effective from
          <input type="date" name="effectiveFrom" />
        </label>
        <label>
          Effective to
          <input type="date" name="effectiveTo" />
        </label>
        <button>{pending ? "Saving…" : "Add price"}</button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">{success}</p>}
    </form>
  );
}
