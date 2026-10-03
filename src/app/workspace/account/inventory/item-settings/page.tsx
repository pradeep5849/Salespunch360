import {getAccountSettings}from"@/lib/account/settings";
import{updateItemSettingsAction}from"@/app/actions/account-settings";
import{AccountPageHeader}from"@/components/account/account-shell";
import{AccountSaveForm,AccountSubmitButton}from"@/components/account/account-save-form";

const toggles=[['enabled','Enable Items','Show item workflows in Account.'],['barcodeScanning','Barcode scanning for items','Allow supported clients to capture barcodes.'],['stockMaintenance','Stock maintenance','Track product quantities through the inventory ledger.'],['itemUnits','Item Units','Enable units and a default unit.'],['itemCategory','Item Category','Organise items with categories.'],['partyWiseRate','Party-wise item rate','Use customer-specific price records.'],['wholesalePrice','Wholesale Price','Allow wholesale price tiers.'],['itemWiseTax','Item-wise tax','Use the tax configured on each item.'],['taxOnMrp','Calculate tax based on MRP','Use MRP as the supported tax base.'],['itemWiseDiscount','Item-wise discount','Allow line-level item discounts.'],['updateSalePrice','Update sale price from transaction','Allow a transaction to update an item sale price.'],['additionalFields','Additional Item Fields','Show additional item metadata.'],['customFields','Item Custom Fields','Use company item custom fields.'],['description','Description','Show item descriptions.'],['hsnSac','HSN/SAC Code','Enable GST classification codes.'],['additionalCess','Additional CESS','Enable supported additional CESS fields.']] as const;

export default async function Page(){
 const row=await getAccountSettings();
 const saved=(row?.itemSettings??{})as Record<string,unknown>;
 return <div className="account-inner-page">
  <AccountPageHeader title="Item Settings" backHref="/workspace/account/inventory"/>
  <AccountSaveForm action={updateItemSettingsAction} className="account-item-settings" successMessage="Item settings saved successfully">
   <section><h2>General Items</h2><label>Item Type<select name="itemType" defaultValue={String(saved.itemType??'BOTH')}><option value="PRODUCTS">Products</option><option value="SERVICES">Services</option><option value="BOTH">Products and Services</option></select></label>{toggles.slice(0,14).map(([key,label,help])=><label className="account-setting-toggle" key={key}><input type="checkbox" name={key} defaultChecked={saved[key]===undefined||saved[key]===true}/><span><b>{label}</b><small>{help}</small></span></label>)}<label>Default Unit <input name="defaultUnit" defaultValue={String(saved.defaultUnit??'')} placeholder="For example, PCS"/></label><label>Quantity decimal places<select name="quantityDecimals" defaultValue={String(saved.quantityDecimals??2)}>{[0,1,2,3,4].map(x=><option key={x}>{x}</option>)}</select></label><label className="account-setting-toggle unavailable"><input type="checkbox" disabled/><span><b>Manufacturing · Coming Soon</b><small>No manufacturing backend is available; this setting cannot be enabled.</small></span></label></section>
   <section><h2>GST</h2>{toggles.slice(14).map(([key,label,help])=><label className="account-setting-toggle" key={key}><input type="checkbox" name={key} defaultChecked={saved[key]===undefined||saved[key]===true}/><span><b>{label}</b><small>{help}</small></span></label>)}</section>
   <AccountSubmitButton className="account-primary">Save Item Settings</AccountSubmitButton>
  </AccountSaveForm>
 </div>;
}
