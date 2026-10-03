"use server";
import {revalidatePath} from "next/cache";
import {savePartyAdditionalFields,updatePartySettings} from "@/lib/account/party-settings";
export async function updatePartySettingsAction(fd:FormData){await updatePartySettings({gstinEnabled:fd.get("gstinEnabled")==="on",groupingEnabled:fd.get("groupingEnabled")==="on",shippingAddressEnabled:fd.get("shippingAddressEnabled")==="on",printShippingAddress:fd.get("printShippingAddress")==="on"});revalidatePath("/workspace/account/settings/party")}
export async function savePartyAdditionalFieldsAction(fd:FormData){const fields=[0,1,2,3].map(i=>({key:i===3?"party_date":`party_additional_${i+1}`,enabled:fd.get(`enabled_${i}`)==="on",label:String(fd.get(`label_${i}`)||`Additional Field ${i+1}`),showInPrint:fd.get(`print_${i}`)==="on",...(i===3?{dateFormat:"DD/MM/YYYY"}:{})}));await savePartyAdditionalFields(fields);revalidatePath("/workspace/account/settings/party/additional-fields")}
