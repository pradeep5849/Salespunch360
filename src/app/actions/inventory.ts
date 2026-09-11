"use server";
import{revalidatePath}from"next/cache";import{createBatch,createProductPrice,createWarehouse,deactivateProductPrice,deactivateWarehouse,recordAdjustment,recordOpeningStock,registerSerialNumber,transferStock,updateInventoryProduct,updateProductPrice,updateWarehouse}from"@/lib/account/inventory";
const raw=(f:FormData,...omit:string[])=>Object.fromEntries([...f.entries()].filter(([k,v])=>v!==""&&!omit.includes(k)));
export async function warehouseAction(f:FormData){const op=String(f.get("operation")||"create"),id=String(f.get("id")||"");if(op==="deactivate")await deactivateWarehouse(id);else if(op==="update")await updateWarehouse(id,raw(f,"operation","id"));else await createWarehouse(raw(f,"operation","id"));revalidatePath("/workspace/account/inventory/warehouses");}
export async function inventoryProductAction(f:FormData){await updateInventoryProduct(String(f.get("productId")),raw(f,"productId"));revalidatePath("/workspace/account/inventory/items");}
export async function batchAction(f:FormData){await createBatch(raw(f));revalidatePath("/workspace/account/inventory/batches");}
export async function serialAction(f:FormData){await registerSerialNumber(raw(f));revalidatePath("/workspace/account/inventory/batches");}
export async function priceAction(f:FormData){const op=String(f.get("operation")||"create"),id=String(f.get("id")||"");if(op==="deactivate")await deactivateProductPrice(id);else if(op==="update")await updateProductPrice(id,raw(f,"operation","id"));else await createProductPrice(raw(f,"operation","id"));revalidatePath("/workspace/account/inventory/items");}
export async function openingAction(f:FormData){await recordOpeningStock(raw(f));revalidatePath("/workspace/account/inventory/stock");}
export async function adjustmentAction(f:FormData){await recordAdjustment(raw(f));revalidatePath("/workspace/account/inventory/stock");}
export async function transferAction(f:FormData){await transferStock(raw(f));revalidatePath("/workspace/account/inventory/stock");}
