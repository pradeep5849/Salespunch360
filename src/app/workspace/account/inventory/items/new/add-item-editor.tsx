"use client";
import {validUnitConversionRate} from "@/lib/account/unit-conversion-rate";
import {saveItemPhotoAction} from "@/app/actions/item-photos";
import {trapDialogFocus} from "@/components/account/dialog-keyboard";
import { generateItemCode } from "@/lib/account/item-identifiers";
import type { CustomFieldDefinition } from "@prisma/client";
import { CustomFieldInput } from "@/components/account/custom-field-input";
import { useRef, useEffect, type ReactNode } from "react";
import { updateQuickItemSettingAction } from "@/app/actions/account-settings";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createAccountCategoryAction,
  createAccountItemAction,
  createAccountUnitAction,
} from "@/app/actions/account-masters";
import {
  SaveFeedback,
  useSaveMutation,
} from "@/components/account/save-feedback";

type Unit = { id: string; name: string; symbol: string };
type Category = { id: string; name: string; scope: string };
type Props = {
  initialKind?: "products" | "services";
  units: Unit[];
  warehouses?: Array<{ id: string; name: string }>;
  categories: Category[];
  settings: Record<string, unknown>;
  customFields?: CustomFieldDefinition[];
  hsnCodes?: string[];
  canManageSettings?: boolean;
};
type HelpKey = "OPENING" | "PRICE" | "MIN" | null;
const taxRates = ["0", "0.1", "0.25", "3", "5", "12", "18", "28"];
function ItemEditorDialog({children,label,className,onClose,pending=false}:{children:ReactNode;label:string;className:string;onClose:()=>void;pending?:boolean}) {
  const dialog=useRef<HTMLDialogElement>(null);
  const restoreFocus=useRef<HTMLElement|null>(typeof document!=="undefined"&&document.activeElement instanceof HTMLElement?document.activeElement:null);
  useEffect(()=>{
    const previous=restoreFocus.current;
    const current=dialog.current;current?.showModal();
    return ()=>{current?.close();if(previous?.isConnected)previous.focus()};
  },[]);
  return <dialog ref={dialog} onKeyDown={trapDialogFocus} aria-label={label} className={className} onCancel={event=>{event.preventDefault();if(!pending)onClose()}} style={{margin:0,border:0,padding:0,width:"100vw",height:"100dvh",maxWidth:"none",maxHeight:"none",borderRadius:0}}>{children}</dialog>;
}
function HelpDialog({ text, onClose }: { text: string; onClose: () => void }) {
  return (
    <ItemEditorDialog label="Item help" className="sale-overlay" onClose={onClose}>
      <section className="sale-dialog">
        <header>
          <span />
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <p>{text}</p>
        <div className="dialog-actions">
          <button className="account-primary" onClick={onClose}>
            OK
          </button>
        </div>
      </section>
    </ItemEditorDialog>
  );
}
export function AddItemEditor({
  units: initialUnits,
  warehouses = [],
  categories: initialCategories,
  settings: initialSettings,
  canManageSettings = false,
  customFields = [],
  hsnCodes = [],
  initialKind = "products",
}: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const settingsTrigger = useRef<HTMLButtonElement>(null);
  const customFieldRoot = useRef<HTMLDivElement>(null);
  const editorRoot = useRef<HTMLElement>(null);
  const creationKey = useRef<string | null>(null);
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const router = useRouter(),
    [kind, setKind] = useState<"products" | "services">(
      settings.itemType === "SERVICES"
        ? "services"
        : settings.itemType === "PRODUCTS"
          ? "products"
          : initialKind,
    ),
    [name, setName] = useState(""),
    [primaryUnit, setPrimaryUnit] = useState(
      settings.itemUnits === false
        ? ""
        : (initialUnits.find((u) =>
            [u.name.toLowerCase(), u.symbol.toLowerCase()].includes(
              String(settings.defaultUnit ?? "").toLowerCase(),
            ),
          )?.id ?? ""),
    ),
    [secondaryUnit, setSecondaryUnit] = useState(""),
    [drawer, setDrawer] = useState(false),
    [transitionPending, startTransition] = useTransition(),
    [units, setUnits] = useState(initialUnits),
    [categories, setCategories] = useState(initialCategories),
    mutation = useSaveMutation(),
    pending = transitionPending || mutation.pending;
  const [secondaryUnitsPerBase,setSecondaryUnitsPerBase]=useState(""),[unitDraftRate,setUnitDraftRate]=useState("");
  const [unitError, setUnitError] = useState("");
  const [unitPage, setUnitPage] = useState(false),
    [unitTarget, setUnitTarget] = useState<"PRIMARY" | "SECONDARY" | null>(
      null,
    ),
    [unitDraftPrimary, setUnitDraftPrimary] = useState(""),
    [unitDraftSecondary, setUnitDraftSecondary] = useState(""),
    [addUnitOpen, setAddUnitOpen] = useState(false),
    [newUnitName, setNewUnitName] = useState(""),
    [newUnitSymbol, setNewUnitSymbol] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false),
    [categoryQuery, setCategoryQuery] = useState(""),
    [categoryId, setCategoryId] = useState(""),
    [categoryDraft, setCategoryDraft] = useState(""),
    [addCategoryOpen, setAddCategoryOpen] = useState(false),
    [newCategoryName, setNewCategoryName] = useState("");
  const [code, setCode] = useState(""),
    [description, setDescription] = useState(""),
    [hsn, setHsn] = useState(""),
    [tab, setTab] = useState<"PRICING" | "STOCK">("PRICING"),
    [salePrice, setSalePrice] = useState(""),
    [mrp, setMrp] = useState(""),
    [saleTaxMode, setSaleTaxMode] = useState<"WITHOUT" | "WITH">("WITHOUT"),
    [discount, setDiscount] = useState(""),
    [discountMode, setDiscountMode] = useState<"PERCENTAGE" | "AMOUNT">(
      "PERCENTAGE",
    ),
    [wholesale, setWholesale] = useState(""),
    [wholesaleOpen,setWholesaleOpen]=useState(false),
    [purchasePrice, setPurchasePrice] = useState(""),
    [purchaseTaxMode, setPurchaseTaxMode] = useState<"WITHOUT" | "WITH">(
      "WITHOUT",
    ),
    [taxRate, setTaxRate] = useState(""),
    [openingStock, setOpeningStock] = useState(""),
    [openingDate, setOpeningDate] = useState(
      new Date().toISOString().slice(0, 10),
    ),
    [atPrice, setAtPrice] = useState(""),
    [minStock, setMinStock] = useState(""),
    [itemLocation, setItemLocation] = useState(""),
    [help, setHelp] = useState<HelpKey>(null);
  useEffect(() => {
    if (!drawer) return;
    settingsDialog.current?.showModal();
    const trigger = settingsTrigger.current;
    return () => {
      trigger?.focus();
    };
  }, [drawer]);
  function toggleSetting(key: string, value: boolean) {
    startTransition(async () => {
      const saved = await mutation.run(async () => {
        const updated = await updateQuickItemSettingAction({ key, value });
        setSettings((current) => ({ ...current, ...updated }));
      }, "Item setting saved");
      void saved;
    });
  }
  const enabled = (key: string) => settings[key] !== false,
    expanded = name.trim().length > 0;
  const selectedUnit = units.find((x) => x.id === primaryUnit);
  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (x) =>
          (kind === "products"
            ? x.scope !== "SERVICE"
            : x.scope !== "PRODUCT") &&
          x.name.toLowerCase().includes(categoryQuery.toLowerCase()),
      ),
    [categories, categoryQuery, kind],
  );
  function openUnits() {
    setUnitDraftPrimary(primaryUnit);
    setUnitDraftSecondary(secondaryUnit);
    setUnitDraftRate(secondaryUnitsPerBase);
    setUnitError("");
    setUnitPage(true);
    setUnitTarget(null);
  }
  function saveUnits() {
    if(unitDraftSecondary&&(unitDraftSecondary===unitDraftPrimary||!validUnitConversionRate(unitDraftRate))){setUnitError("Choose different units and enter a positive conversion factor.");return;}
    setSecondaryUnitsPerBase(unitDraftSecondary?unitDraftRate:"");
    setPrimaryUnit(unitDraftPrimary);
    setSecondaryUnit(unitDraftSecondary);
    setUnitPage(false);
    setUnitTarget(null);
  }
  function assignCode() {
    if (!code) setCode(generateItemCode(kind));
  }
  const [photo,setPhoto]=useState<File|null>(null),[photoError,setPhotoError]=useState(""),[savedPhotoItem,setSavedPhotoItem]=useState(false);
  const photoInput=useRef<HTMLInputElement>(null),savedItem=useRef<{id:string;kind:"products"|"services"}|null>(null);
  function selectPhoto(file?:File){if(!file)return;if(!file.type.startsWith("image/")||file.size===0||file.size>5*1024*1024){setPhoto(null);setPhotoError("Choose an image up to 5 MB.");return}setPhoto(file);setPhotoError("")}
  async function uploadSelectedPhoto(){if(!photo||!savedItem.current)return;const form=new FormData();form.set("photo",photo);const result=await saveItemPhotoAction(savedItem.current.kind,savedItem.current.id,form);if(!result.ok)throw new Error(result.message)}
  function retryPhoto(){startTransition(async()=>{const ok=await mutation.run(uploadSelectedPhoto,"Item photo saved");if(ok)router.push("/workspace/account/inventory")})}
  function save() {
    if(savedItem.current){retryPhoto();return}
    if (pending || !name.trim()) return;
    const inputs=editorRoot.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>("input,select,textarea")??[];
    if(Array.from(inputs).some(control=>!control.reportValidity()))return;
    const controls = Array.from(
      customFieldRoot.current?.querySelectorAll<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >("input,select,textarea") ?? [],
    );
    if (controls.some((control) => !control.reportValidity())) return;
    const customFields = Object.fromEntries(
      controls.map((control) => [control.name.slice(7), control.value]),
    );
    startTransition(async () => {
      const saved = await mutation.run(
        async () => {
          const row=await createAccountItemAction({
            type: kind,
            creationRequestKey:
              kind === "products"
                ? (creationKey.current ??
                  (creationKey.current = crypto.randomUUID()))
                : undefined,
            itemLocation:
              kind === "products" && enabled("stockMaintenance")
                ? itemLocation || undefined
                : undefined,
            openingStock:
              kind === "products" &&
              enabled("stockMaintenance") &&
              openingStock.trim()
                ? {
                    warehouseId,
                    quantity: openingStock,
                    unitCost: atPrice || "0",
                    movementDate: openingDate,
                  }
                : undefined,
            customFields,
            name: name.trim(),
            unitId: enabled("itemUnits") ? primaryUnit || undefined : undefined,
            secondaryUnitId:enabled("itemUnits")?secondaryUnit||undefined:undefined,
            secondaryUnitsPerBase:enabled("itemUnits")&&secondaryUnit?secondaryUnitsPerBase:undefined,
            categoryId: enabled("itemCategory")
              ? categoryId || undefined
              : undefined,
            code: code || undefined,
            barcode: code || undefined,
            description: enabled("description")
              ? description || undefined
              : undefined,
            pricing:{...(enabled("taxOnMrp")&&mrp?{mrp}:{}),saleTaxMode:saleTaxMode==="WITH"?"INCLUSIVE":"EXCLUSIVE",purchaseTaxMode:purchaseTaxMode==="WITH"?"INCLUSIVE":"EXCLUSIVE",discountType:discountMode==="AMOUNT"?"FIXED":"PERCENTAGE",discountValue:enabled("itemWiseDiscount")?discount||"0":"0",...(enabled("wholesalePrice")&&wholesaleOpen&&wholesale?{wholesalePrice:wholesale}:{})},
            sellingRate: salePrice || "0",
            cost: purchasePrice || "0",
            taxRate: enabled("itemWiseTax") ? taxRate || "0" : "0",
            hsnSacCode: enabled("hsnSac") ? hsn || undefined : undefined,
            trackInventory:
              enabled("stockMaintenance") &&
              kind === "products" &&
              Boolean(openingStock || minStock || itemLocation),
            trackingMode: "NONE",
            lowStockThreshold:
              enabled("stockMaintenance") && kind === "products"
                ? minStock || "0"
                : "0",
          });
          savedItem.current={id:row.id,kind};setSavedPhotoItem(true);
          try{await uploadSelectedPhoto()}catch(error){setPhotoError("Item saved. The photo could not be uploaded. Retry the photo or continue without it.");throw error}
        },
        "Item created successfully",
      );
      if (saved)
        window.setTimeout(
          () => router.push("/workspace/account/inventory"),
          600,
        );
    });
  }
  function createUnitNow() {
    if (!newUnitName.trim() || !newUnitSymbol.trim()) return;
    setUnitError("");
    startTransition(async () => {
      try {
        const row = await createAccountUnitAction({
          name: newUnitName.trim(),
          symbol: newUnitSymbol.trim(),
        });
        if (!row.ok) {
          setUnitError(row.message);
          return;
        }
        setUnits((old) => [...old, row]);
        setUnitDraftPrimary(row.id);
        setNewUnitName("");
        setNewUnitSymbol("");
        setAddUnitOpen(false);
      } catch {
        setUnitError("The unit could not be saved. Retry when connected.");
      }
    });
  }
  function createCategoryNow() {
    if (!newCategoryName.trim()) return;
    startTransition(async () => {
      const row = await createAccountCategoryAction({
        name: newCategoryName.trim(),
        scope: kind === "products" ? "PRODUCT" : "SERVICE",
      });
      setCategories((old) => [
        ...old,
        { ...row, scope: kind === "products" ? "PRODUCT" : "SERVICE" },
      ]);
      setCategoryDraft(row.id);
      setNewCategoryName("");
      setAddCategoryOpen(false);
    });
  }
  if(savedPhotoItem)return <section className="add-item-page" aria-label="Item photo recovery"><h1>Item saved</h1><p role={photoError?"alert":"status"}>{photoError||"Your item has been created."}</p><input aria-label="Replacement item photo" type="file" accept="image/*" disabled={pending} onChange={event=>selectPhoto(event.target.files?.[0])}/><SaveFeedback state={mutation.feedback}/><button type="button" disabled={pending||!photo} onClick={retryPhoto}>Retry photo upload</button><Link href="/workspace/account/inventory">Continue without photo</Link></section>;
  return (
    <section ref={editorRoot} aria-label="Add Item editor" className="add-item-page">
      <SaveFeedback state={mutation.feedback} />
      <header>
        <Link href="/workspace/account/inventory" aria-label="Back">
          ‹
        </Link>
        <h1>Add Item</h1>
        <button
          type="button"
          aria-label="Add item image"
          disabled={pending}
          onClick={()=>photoInput.current?.click()}
          title="Select item photo (up to 5 MB)"
        >
          📷
        </button>
        <input ref={photoInput} aria-label="Item photo" type="file" accept="image/*" hidden onChange={event=>selectPhoto(event.target.files?.[0])}/>
        {photo&&<span role="status">Photo selected: {photo.name}<button type="button" disabled={pending} onClick={()=>{setPhoto(null);if(photoInput.current)photoInput.current.value=""}}>Remove photo</button></span>}
        {photoError&&<p role="alert">{photoError}</p>}
        <button
          type="button"
          ref={settingsTrigger}
          aria-label="Item settings"
          onClick={() => setDrawer(true)}
        >
          ⚙
        </button>
      </header>
      <div className="account-segmented add-item-kind" aria-label="Item type">
        {(["products", "services"] as const)
          .filter((x) => settings.itemType !== "PRODUCTS" || x === "products")
          .filter((x) => settings.itemType !== "SERVICES" || x === "services")
          .map((x) => (
            <button
              type="button"
              key={x}
              aria-pressed={kind === x}
              onClick={() => {
                setKind(x);
                setCategoryId("");
                setTab("PRICING");
              }}
            >
              {x === "products" ? "Product" : "Services"}
            </button>
          ))}
      </div>
      <section className="add-item-form">
        <div className="add-item-name-unit-field">
          <label htmlFor="add-item-name">Item Name *</label>
          <div className="add-item-name-unit-row">
            <input
              id="add-item-name"
              maxLength={200}
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter item name"
            />
            {enabled("itemUnits") && (
              <button
                type="button"
                className="add-item-unit-pill"
                onClick={openUnits}
              >
                {selectedUnit
                  ? `${selectedUnit.name} (${selectedUnit.symbol})`
                  : "Select Unit"}
              </button>
            )}
          </div>
        </div>
        {expanded && (
          <div className="add-item-expanded">
            <label>
              Item Code / Barcode
              <div className="add-item-code-row">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Item Code / Barcode"
                />
                <button type="button" onClick={assignCode}>
                  Assign Code
                </button>
              </div>
            </label>
            {enabled("itemCategory") && (
              <button
                type="button"
                className="selector-field"
                onClick={() => {
                  setCategoryDraft(categoryId);
                  setCategoryQuery("");
                  setCategoryOpen(true);
                }}
              >
                <small>Item Category</small>
                <span>
                  {categories.find((x) => x.id === categoryId)?.name ??
                    "Select Category"}
                  ⌄
                </span>
              </button>
            )}
            {enabled("description") && (
              <label>
                Description
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            )}
            {enabled("hsnSac") && (
              <label>
                HSN/SAC Code
                <div className="add-item-hsn-field">
                  <input
                    value={hsn}
                    onChange={(e) => setHsn(e.target.value)}
                    placeholder="HSN/SAC Code"
                    list="saved-hsn-codes"
                    aria-label="HSN/SAC Code"
                  />
                  <datalist id="saved-hsn-codes">
                    {hsnCodes.map((code) => (
                      <option key={code} value={code} />
                    ))}
                  </datalist>
                  <span className="field-icon" aria-hidden>
                    ⌕
                  </span>
                </div>
              </label>
            )}
            <div className="party-detail-tabs item-detail-tabs">
              <button
                type="button"
                aria-pressed={tab === "PRICING"}
                onClick={() => setTab("PRICING")}
              >
                Pricing
              </button>
              {kind === "products" && enabled("stockMaintenance") && (
                <button
                  type="button"
                  aria-pressed={tab === "STOCK"}
                  onClick={() => setTab("STOCK")}
                >
                  Stock
                </button>
              )}
            </div>
            {tab === "PRICING" ? (
              <div className="item-tab-panel">
                {enabled("taxOnMrp")&&<label>MRP (tax included)<input aria-label="MRP (tax included)" pattern={"\\d{1,14}(\\.\\d{1,4})?"} maxLength={19} inputMode="decimal" value={mrp} onChange={event=>setMrp(event.target.value)} disabled={pending}/><small>Optional maximum retail price including tax. Invoice tax uses the selling price, not MRP.</small></label>}
                <h2>Sale Price</h2>
                <label>
                  Sale Price
                  <div className="price-row">
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      placeholder="Sale Price"
                    />
                    <select
                      aria-label="Sale Price Tax Mode"
                      value={saleTaxMode}
                      onChange={(e) =>
                        setSaleTaxMode(e.target.value as "WITHOUT" | "WITH")
                      }
                    >
                      <option value="WITHOUT">Without Tax</option>
                      <option value="WITH">With Tax</option>
                    </select>
                  </div>
                </label>
                {enabled("itemWiseDiscount") && (
                  <label>
                    Disc. On Sale Price
                    <div className="price-row">
                      <input
                        type="number"
                        min="0"
                        step=".01"
                        aria-label="Sale Price Discount"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                      <select
                        aria-label="Sale Price Discount Type"
                        value={discountMode}
                        onChange={(e) =>
                          setDiscountMode(
                            e.target.value as "PERCENTAGE" | "AMOUNT",
                          )
                        }
                      >
                        <option value="PERCENTAGE">Percentage</option>
                        <option value="AMOUNT">Amount</option>
                      </select>
                    </div>
                  </label>
                )}
                {enabled("wholesalePrice") && (
                  <>
                    <button type="button" className="link-button" onClick={()=>setWholesaleOpen(true)}>
                      ＋ Add Wholesale Price
                    </button>
                    {wholesaleOpen && (
                      <input
                        aria-label="Wholesale Price" type="number" min="0" step="0.01"
                        value={wholesale}
                        onChange={(e) => setWholesale(e.target.value)}
                      />
                    )}
                  </>
                )}
                <h2>Purchase Price</h2>
                <label>
                  Purchase Price
                  <div className="price-row">
                    <input
                      type="number"
                      min="0"
                      step=".01"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      placeholder="Purchase Price"
                    />
                    <select
                      aria-label="Purchase Price Tax Mode"
                      value={purchaseTaxMode}
                      onChange={(e) =>
                        setPurchaseTaxMode(e.target.value as "WITHOUT" | "WITH")
                      }
                    >
                      <option value="WITHOUT">Without Tax</option>
                      <option value="WITH">With Tax</option>
                    </select>
                  </div>
                </label>
                {enabled("itemWiseTax") && (
                  <>
                    <h3>Taxes</h3>
                    <label>
                      Tax Rate
                      <select
                        aria-label="Tax Rate"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                      >
                        <option value="">None</option>
                        {taxRates.map((x) => (
                          <option value={x} key={x}>
                            {x}%
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
            ) : (
              <div className="item-tab-panel">
                <label>
                  Opening warehouse
                  <select
                    aria-label="Opening warehouse"
                    value={warehouseId}
                    onChange={(event) => setWarehouseId(event.target.value)}
                  >
                    <option value="">Select warehouse</option>
                    {warehouses.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Opening Stock{" "}
                  <button
                    type="button"
                    className="inline-info"
                    onClick={() => setHelp("OPENING")}
                    aria-label="Opening stock help"
                  >
                    ⓘ
                  </button>
                  <input
                    type="number"
                    min="0"
                    step=".0001"
                    aria-label="Opening Stock"
                    value={openingStock}
                    onChange={(e) => setOpeningStock(e.target.value)}
                    placeholder="Ex: 300"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    As of Date
                    <input
                      type="date"
                      value={openingDate}
                      onChange={(e) => setOpeningDate(e.target.value)}
                    />
                  </label>
                  <label>
                    At Price/Unit{" "}
                    <button
                      type="button"
                      className="inline-info"
                      onClick={() => setHelp("PRICE")}
                      aria-label="Opening price help"
                    >
                      ⓘ
                    </button>
                    <input
                      type="number"
                      min="0"
                      step=".0001"
                      aria-label="At Price/Unit"
                      value={atPrice}
                      onChange={(e) => setAtPrice(e.target.value)}
                      placeholder="Ex: 2,000"
                    />
                  </label>
                </div>
                <div className="form-grid">
                  <label>
                    Min Stock Qty{" "}
                    <button
                      type="button"
                      className="inline-info"
                      onClick={() => setHelp("MIN")}
                      aria-label="Minimum stock help"
                    >
                      ⓘ
                    </button>
                    <input
                      type="number"
                      min="0"
                      step=".0001"
                      value={minStock}
                      onChange={(e) => setMinStock(e.target.value)}
                      placeholder="Ex: 5"
                    />
                  </label>
                  <label>
                    Item Location
                    <input
                      value={itemLocation}
                      onChange={(e) => setItemLocation(e.target.value)}
                      placeholder="Item Location"
                    />
                  </label>
                </div>
              </div>
            )}
            <div ref={customFieldRoot} key={kind}>
              {customFields
                .filter(() => enabled("customFields"))
                .filter(
                  (field) =>
                    field.entityType ===
                    (kind === "products" ? "PRODUCT" : "SERVICE"),
                )
                .map((field) => (
                  <CustomFieldInput key={field.id} field={field} />
                ))}
            </div>
          </div>
        )}
      </section>
      <footer>
        <Link href="/workspace/account/inventory">Cancel</Link>
        <button disabled={!name.trim() || pending} onClick={save}>
          {pending ? "Saving…" : "Save"}
        </button>
      </footer>

      {unitPage && (
        <ItemEditorDialog label="Add Item Unit" className="sale-fullscreen-panel add-unit-full" onClose={()=>setUnitPage(false)} pending={pending}>
          <header>
            <button onClick={() => setUnitPage(false)} aria-label="Back">
              ←
            </button>
            <h2>Add Item Unit</h2>
            <span />
          </header>
          <div className="sale-fullscreen-body">
            <div className="unit-dropdown-wrap">
              <button
                type="button"
                className="selector-field"
                onClick={() =>
                  setUnitTarget(unitTarget === "PRIMARY" ? null : "PRIMARY")
                }
              >
                <small>Primary Unit</small>
                <span>
                  {units.find((x) => x.id === unitDraftPrimary)?.name ??
                    "Primary Unit"}
                  ⌄
                </span>
              </button>
              {unitTarget === "PRIMARY" && (
                <div className="unit-dropdown-menu">
                  <button
                    type="button"
                    className="unit-add-option"
                    onClick={() => setAddUnitOpen(true)}
                  >
                    Add Unit
                  </button>
                  {units.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => {
                        setUnitDraftPrimary(u.id);
                        setUnitTarget(null);
                      }}
                    >
                      {u.name.toUpperCase()} ( {u.symbol} )
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="unit-dropdown-wrap">
              <button
                type="button"
                className="selector-field"
                onClick={() =>
                  setUnitTarget(unitTarget === "SECONDARY" ? null : "SECONDARY")
                }
              >
                <small>Secondary Unit</small>
                <span>
                  {units.find((x) => x.id === unitDraftSecondary)?.name ??
                    "Secondary Unit"}
                  ⌄
                </span>
              </button>
              {unitTarget === "SECONDARY" && (
                <div className="unit-dropdown-menu">
                  <button
                    type="button"
                    className="unit-add-option"
                    onClick={() => setAddUnitOpen(true)}
                  >
                    Add Unit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitDraftSecondary("");
                      setUnitTarget(null);
                    }}
                  >
                    None
                  </button>
                  {units.map((u) => (
                    <button
                      type="button"
                      key={u.id}
                      onClick={() => {
                        setUnitDraftSecondary(u.id);
                        setUnitTarget(null);
                      }}
                    >
                      {u.name.toUpperCase()} ( {u.symbol} )
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          {unitDraftSecondary&&<div className="unit-conversion-input"><label>Secondary units per primary unit<input inputMode="decimal" value={unitDraftRate} onChange={event=>setUnitDraftRate(event.target.value)} required/></label><p>1 {units.find(unit=>unit.id===unitDraftPrimary)?.symbol||"primary unit"} = {unitDraftRate||"?"} {units.find(unit=>unit.id===unitDraftSecondary)?.symbol||"secondary units"}</p></div>}
          {unitError&&<p role="alert">{unitError}</p>}
          <footer className="sale-fullscreen-footer">
            <button onClick={() => setUnitPage(false)}>Cancel</button>
            <button disabled={!unitDraftPrimary||!!unitDraftSecondary&&(unitDraftSecondary===unitDraftPrimary||!validUnitConversionRate(unitDraftRate))} onClick={saveUnits}>
              Save
            </button>
          </footer>
        </ItemEditorDialog>
      )}

      {categoryOpen && (
        <ItemEditorDialog label="Select Category" className="sale-fullscreen-panel category-full" onClose={()=>setCategoryOpen(false)} pending={pending}>
          <header>
            <h2>Select Category</h2>
            <button onClick={() => setCategoryOpen(false)} aria-label="Close">
              ×
            </button>
          </header>
          <div className="sale-fullscreen-body">
            <input
              className="category-search"
              aria-label="Search Category"
              autoFocus
              value={categoryQuery}
              onChange={(e) => setCategoryQuery(e.target.value)}
              placeholder="Search Category"
            />
            <button
              type="button"
              className="category-add"
              onClick={() => setAddCategoryOpen(true)}
            >
              Add New Category <b>＋</b>
            </button>
            <div className="category-list">
              {filteredCategories.map((x) => (
                <label key={x.id}>
                  <span>{x.name.toUpperCase()}</span>
                  <input
                    type="checkbox"
                    checked={categoryDraft === x.id}
                    onChange={() =>
                      setCategoryDraft(categoryDraft === x.id ? "" : x.id)
                    }
                  />
                </label>
              ))}
            </div>
          </div>
          <footer className="category-apply">
            <button
              onClick={() => {
                setCategoryId(categoryDraft);
                setCategoryOpen(false);
              }}
            >
              Apply
            </button>
          </footer>
        </ItemEditorDialog>
      )}

      {addUnitOpen && (
        <ItemEditorDialog label="Add Unit" className="sale-overlay" onClose={()=>setAddUnitOpen(false)} pending={pending}>
          <section className="sale-dialog">
            <header>
              <h2>Add Unit</h2>
              <button aria-label="Close Add Unit" disabled={pending} onClick={() => setAddUnitOpen(false)}>×</button>
            </header>
            <label>
              Name
              <input
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                autoFocus
              />
            </label>
            <label>
              Symbol
              <input
                value={newUnitSymbol}
                onChange={(e) => setNewUnitSymbol(e.target.value)}
              />
            </label>
            {unitError && <p role="alert">{unitError}</p>}
            <div className="dialog-actions">
              <button onClick={() => setAddUnitOpen(false)}>Cancel</button>
              <button
                onClick={createUnitNow}
                disabled={
                  !newUnitName.trim() || !newUnitSymbol.trim() || pending
                }
              >
                Save
              </button>
            </div>
          </section>
        </ItemEditorDialog>
      )}
      {addCategoryOpen && (
        <ItemEditorDialog label="Add New Category" className="sale-overlay" onClose={()=>setAddCategoryOpen(false)} pending={pending}>
          <section className="sale-dialog">
            <header>
              <h2>Add New Category</h2>
              <button aria-label="Close Add New Category" disabled={pending} onClick={() => setAddCategoryOpen(false)}>×</button>
            </header>
            <label>
              Category Name
              <input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                autoFocus
              />
            </label>
            <div className="dialog-actions">
              <button onClick={() => setAddCategoryOpen(false)}>Cancel</button>
              <button
                onClick={createCategoryNow}
                disabled={!newCategoryName.trim() || pending}
              >
                Save
              </button>
            </div>
          </section>
        </ItemEditorDialog>
      )}
      {help === "OPENING" && (
        <HelpDialog
          text="The quantity of item in stock before using SalesPunch360 for stock tracking."
          onClose={() => setHelp(null)}
        />
      )}
      {help === "PRICE" && (
        <HelpDialog
          text="The average price at which you have bought the opening stock."
          onClose={() => setHelp(null)}
        />
      )}
      {help === "MIN" && (
        <HelpDialog
          text="The minimum quantity of item you wish to maintain in stock. SalesPunch360 will notify you when stock falls below this level."
          onClose={() => setHelp(null)}
        />
      )}
      {drawer && (
        <dialog
          ref={settingsDialog}
          className="sale-settings add-item-settings-dialog"
          aria-labelledby="item-settings-title"
          onClose={() => setDrawer(false)}
        >
          <header>
            <h2 id="item-settings-title">Item Settings</h2>
            <button
              aria-label="Close item settings"
              onClick={() => settingsDialog.current?.close()}
            >
              ×
            </button>
          </header>
          {!canManageSettings && (
            <p>Only a business administrator can change item settings.</p>
          )}
          {[
            ["customFields", "Item Custom Fields"],
            ["additionalFields", "Additional Item Fields"],
            ["wholesalePrice", "Wholesale Price"],
            ["barcodeScanning", "Barcode Scan"],
            ["itemCategory", "Item Category"],
            ["description", "Description"],
          ].map(([key, label]) => (
            <label className="item-setting-row" key={key}>
              <span>{label}</span>
              <input
                type="checkbox"
                checked={enabled(key)}
                disabled={!canManageSettings || pending}
                onChange={(event) => toggleSetting(key, event.target.checked)}
              />
            </label>
          ))}
          {canManageSettings && (
            <>
              <Link href="/workspace/account/settings/custom-fields">
                Manage Item Custom Fields
              </Link>
              <Link href="/workspace/account/settings/reminders/service">
                Service Reminders
              </Link>
              <Link href="/workspace/account/inventory/item-settings">
                More Settings
              </Link>
            </>
          )}
          <SaveFeedback state={mutation.feedback} />
        </dialog>
      )}
    </section>
  );
}
