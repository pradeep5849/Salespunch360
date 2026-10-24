package com.salespunch360.mobile.ui.account.inventory
import kotlinx.serialization.json.*
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddAPhoto
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.salespunch360.mobile.AccountAddItemViewModel
import com.salespunch360.mobile.data.AccountOption
import java.time.LocalDate

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddItemScreen(
    back:()->Unit,
    navigate:(String)->Unit,
    vm:AccountAddItemViewModel=viewModel(),
    initialService:Boolean=false,
    onCreated:((String,String)->Unit)?=null,
    returnPending:Boolean=false,
    returnError:String?=null
){
    val s=vm.state.collectAsStateWithLifecycle().value
    val finish:()->Unit={val current=vm.state.value;val id=current.createdItemId;val kind=current.createdItemKind;if(onCreated!=null&&id!=null&&kind!=null)onCreated(id,kind)else back()}
    if(onCreated!=null&&s.createdItemId!=null&&!s.photoPending){
        Column(Modifier.fillMaxSize().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            Text("Item saved",style=MaterialTheme.typography.headlineSmall)
            Text(returnError?:"Returning to the quotation…")
            Button(enabled=!returnPending,onClick=finish){Text(if(returnPending)"Returning…"else "Return to quotation")}
        };return
    }
    val context=LocalContext.current
    val photoScope=rememberCoroutineScope()
    var photoBytes by remember{mutableStateOf<ByteArray?>(null)}
    var photoMime by remember{mutableStateOf("image/jpeg")}
    var photoError by remember{mutableStateOf<String?>(null)}
    var photoLoading by remember{mutableStateOf(false)}
    val photoPicker=rememberLauncherForActivityResult(ActivityResultContracts.GetContent()){uri->if(uri!=null){photoLoading=true;photoScope.launch{
        runCatching{withContext(Dispatchers.IO){val mime=context.contentResolver.getType(uri).orEmpty();require(mime.startsWith("image/"));val bytes=context.contentResolver.openInputStream(uri)?.use{input->val output=java.io.ByteArrayOutputStream();val chunk=ByteArray(8192);while(true){val count=input.read(chunk);if(count<0)break;require(output.size()+count<=5*1024*1024);output.write(chunk,0,count)};output.toByteArray()}?:error("Unable to read image");require(bytes.isNotEmpty()&&bytes.size<=5*1024*1024);mime to bytes}}.onSuccess{photoMime=it.first;photoBytes=it.second;photoError=null}.onFailure{photoBytes=null;photoError="Choose a readable image up to 5 MB."};photoLoading=false
    }}}
    if(s.photoPending){Column(Modifier.fillMaxSize().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){Text("Item saved",style=MaterialTheme.typography.headlineSmall);Text(s.error?:"Uploading item photo…");photoError?.let{Text(it,color=MaterialTheme.colorScheme.error)};TextButton(enabled=!s.saving&&!photoLoading,onClick={photoPicker.launch("image/*")}){Text("Choose replacement photo")};Button(enabled=!s.saving,onClick={vm.retryPhoto(finish,photoBytes?.let{photoMime to it})}){Text("Retry photo upload")};TextButton(enabled=!s.saving,onClick=finish){Text("Continue without photo")}};return}
    var service by remember(initialService){mutableStateOf(initialService)}
    var name by remember{mutableStateOf("")}
    var customValues by remember(service){mutableStateOf<Map<String,String>>(emptyMap())}
    fun enabled(key:String)=s.itemSettings[key]?.jsonPrimitive?.booleanOrNull!=false
    val itemType=s.itemSettings["itemType"]?.jsonPrimitive?.contentOrNull?:"BOTH"
    val customFields=if(!enabled("customFields"))emptyList()else if(service)s.serviceFields else s.productFields
    val categoryOptions=if(service)s.serviceCategories else s.categories
    var primaryUnit by remember{mutableStateOf<String?>(null)}
    var secondaryUnit by remember{mutableStateOf<String?>(null)}
    var secondaryUnitsPerBase by remember{mutableStateOf("")}
    var code by remember{mutableStateOf("")}
    var categoryId by remember{mutableStateOf<String?>(null)}
    var description by remember{mutableStateOf("")}
    var hsnSearch by remember{mutableStateOf(false)}
    var hsnQuery by remember{mutableStateOf("")}
    var hsn by remember{mutableStateOf("")}
    var salePrice by remember{mutableStateOf("")}
    var mrp by remember{mutableStateOf("")}
    var purchasePrice by remember{mutableStateOf("")}
    var saleTaxMode by remember{mutableStateOf("Without Tax")}
    var purchaseTaxMode by remember{mutableStateOf("Without Tax")}
    var discountValue by remember{mutableStateOf("")}
    var discountMode by remember{mutableStateOf("Percentage")}
    var wholesaleOpen by remember{mutableStateOf(false)}
    var wholesalePrice by remember{mutableStateOf("")}
    var taxRate by remember{mutableStateOf("")}
    val creationRequestKey=remember{java.util.UUID.randomUUID().toString()}
    var openingWarehouseId by remember{mutableStateOf("")}
    var openingStock by remember{mutableStateOf("")}
    var openingDate by remember{mutableStateOf(LocalDate.now().toString())}
    var atPrice by remember{mutableStateOf("")}
    var minStock by remember{mutableStateOf("")}
    var itemLocation by remember{mutableStateOf("")}
    var tab by remember{mutableStateOf("PRICING")}
    var unitPage by remember{mutableStateOf(false)}
    var categoryPage by remember{mutableStateOf(false)}
    var settings by remember{mutableStateOf(false)}
    var help by remember{mutableStateOf<String?>(null)}

    if(unitPage){
        AddItemUnitScreen(
            units=s.units,
            primary=primaryUnit,
            secondary=secondaryUnit,
            conversionRate=secondaryUnitsPerBase,
            saving=s.saving,
            onBack={unitPage=false},
            onSave={pUnit,sUnit,factor->
                secondaryUnitsPerBase=if(sUnit==null)""else factor
                primaryUnit=pUnit
                secondaryUnit=sUnit
                unitPage=false
            },
            onCreateUnit=vm::createUnit
        )
        return
    }
    if(categoryPage){
        CategorySelectorScreen(
            categories=categoryOptions,
            selected=categoryId,
            service=service,
            saving=s.saving,
            onClose={categoryPage=false},
            onApply={
                categoryId=it
                categoryPage=false
            },
            onCreateCategory=vm::createCategory
        )
        return
    }

    LaunchedEffect(s.itemSettings){
        if(itemType=="PRODUCTS")service=false
        if(itemType=="SERVICES")service=true
        if(service||!enabled("stockMaintenance"))tab="PRICING"
        val defaultUnit=s.itemSettings["defaultUnit"]?.jsonPrimitive?.contentOrNull.orEmpty()
        if(primaryUnit==null&&enabled("itemUnits")&&defaultUnit.isNotBlank())primaryUnit=s.units.firstOrNull{it.name.equals(defaultUnit,true)||it.symbol.equals(defaultUnit,true)}?.id
    }
    val expanded=name.isNotBlank()
    if(hsnSearch)AlertDialog(
        onDismissRequest={hsnSearch=false},
        title={Text("Saved HSN/SAC Codes")},
        text={Column{
            OutlinedTextField(hsnQuery,{hsnQuery=it},label={Text("Search saved codes")})
            val matches=s.hsnCodes.filter{it.contains(hsnQuery,ignoreCase=true)}
            if(matches.isEmpty())Text("No saved codes found. You can enter a code manually.")
            LazyColumn(Modifier.heightIn(max=300.dp)){
                items(matches){code->TextButton(onClick={hsn=code;hsnSearch=false}){Text(code)}}
            }
        }},
        confirmButton={TextButton(onClick={hsnSearch=false}){Text("Close")}}
    )
    Scaffold(
        containerColor=MaterialTheme.colorScheme.surface,
        topBar={
            TopAppBar(
                title={Text("Add Item")},
                navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}},
                actions={
                    IconButton(enabled=!s.saving&&!photoLoading,onClick={photoPicker.launch("image/*")}){Icon(Icons.Default.AddAPhoto,"Add item image")}
                    IconButton(onClick={settings=true}){Icon(Icons.Default.Settings,"Item settings")}
                }
            )
        },
        bottomBar={
            Surface(shadowElevation=6.dp){
                Column{
                photoError?.let{Text(it,color=MaterialTheme.colorScheme.error)}
                if(photoBytes!=null)Row{Text("Photo selected");TextButton(enabled=!s.saving,onClick={photoBytes=null}){Text("Remove photo")}}
                s.error?.let{message->Text(message,color=MaterialTheme.colorScheme.error,modifier=Modifier.fillMaxWidth().padding(12.dp).semantics{liveRegion=LiveRegionMode.Polite})}
                Row(Modifier.fillMaxWidth().navigationBarsPadding()){
                    TextButton(onClick=back,modifier=Modifier.weight(1f).height(64.dp)){Text("Cancel")}
                    Button(
                        onClick={
                            vm.save(
                                service=service,photoBytes=photoBytes,photoMime=photoMime,
                                name=name,
                                unitId=primaryUnit.takeIf{enabled("itemUnits")},
                                secondaryUnitId=secondaryUnit.takeIf{enabled("itemUnits")},
                                secondaryUnitsPerBase=secondaryUnitsPerBase,
                                categoryId=categoryId.takeIf{enabled("itemCategory")},
                                code=code,
                                description=if(enabled("description"))description else "",
                                pricing=buildJsonObject{
                                    if(enabled("taxOnMrp")&&mrp.isNotBlank())put("mrp",mrp)
                                    put("saleTaxMode",if(saleTaxMode=="With Tax")"INCLUSIVE" else "EXCLUSIVE")
                                    put("purchaseTaxMode",if(purchaseTaxMode=="With Tax")"INCLUSIVE" else "EXCLUSIVE")
                                    put("discountType",if(discountMode=="Amount")"FIXED" else "PERCENTAGE")
                                    put("discountValue",if(enabled("itemWiseDiscount"))discountValue.ifBlank{"0"}else "0")
                                    if(enabled("wholesalePrice")&&wholesaleOpen&&wholesalePrice.isNotBlank())put("wholesalePrice",wholesalePrice)
                                },
                                sellingRate=salePrice,
                                cost=purchasePrice,
                                creationRequestKey=creationRequestKey,
                                openingQuantity=if(enabled("stockMaintenance")&&!service)openingStock else "",
                                openingWarehouseId=openingWarehouseId,
                                openingDate=openingDate,
                                openingPrice=atPrice,
                                itemLocation=if(enabled("stockMaintenance")&&!service)itemLocation else "",
                                taxRate=if(enabled("itemWiseTax"))taxRate else "0",
                                hsnSac=if(enabled("hsnSac"))hsn else "",
                                trackInventory=enabled("stockMaintenance")&&!service&&(openingStock.isNotBlank()||minStock.isNotBlank()||itemLocation.isNotBlank()),
                                lowStockThreshold=if(enabled("stockMaintenance")&&!service)minStock else "0",
                                customFields=if(enabled("customFields"))customValues else emptyMap(),
                                retainCommittedIdentity=onCreated!=null,
                            ){finish()}
                        },
                        enabled=!photoLoading&&name.isNotBlank()&&s.configLoaded&&!s.loading&&!s.saving&&customFields.filter{it.isRequired}.all{!customValues[it.fieldKey].isNullOrBlank()},
                        modifier=Modifier.weight(1f).height(64.dp),
                        shape=MaterialTheme.shapes.extraSmall
                    ){Text(if(s.saving)"Saving…" else "Save")}
                }
                }
            }
        }
    ){padding->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding=PaddingValues(bottom=24.dp)
        ){
            item{
                Row(
                    Modifier.fillMaxWidth().padding(vertical=18.dp),
                    horizontalArrangement=Arrangement.Center,
                    verticalAlignment=Alignment.CenterVertically
                ){
                    Text("Product",fontWeight=if(!service)FontWeight.Bold else FontWeight.Normal)
                    Switch(
                        checked=service,
                        enabled=itemType=="BOTH",
                        onCheckedChange={
                            service=it
                            categoryId=null
                            tab="PRICING"
                        },
                        modifier=Modifier.padding(horizontal=18.dp)
                    )
                    Text("Services",fontWeight=if(service)FontWeight.Bold else FontWeight.Normal)
                }
                HorizontalDivider()
            }
            if(expanded)items(customFields,key={it.fieldKey}){field->
                val value=customValues[field.fieldKey].orEmpty()
                val label=field.label+if(field.isRequired)" *"else ""
                if(field.dataType in listOf("SELECT","BOOLEAN")){
                    var open by remember(field.fieldKey){mutableStateOf(false)}
                    val choices=if(field.dataType=="BOOLEAN")listOf("true" to "Yes","false" to "No")else field.options.map{it to it}
                    ExposedDropdownMenuBox(open,{open=!open},Modifier.padding(horizontal=16.dp)){
                        OutlinedTextField(choices.firstOrNull{it.first==value}?.second.orEmpty(),{},readOnly=true,enabled=!s.saving,label={Text(label)},modifier=Modifier.fillMaxWidth().menuAnchor(MenuAnchorType.PrimaryNotEditable))
                        ExposedDropdownMenu(open,{open=false}){(listOf("" to "Select")+choices).forEach{(key,text)->DropdownMenuItem({Text(text)},{customValues=customValues+(field.fieldKey to key);open=false})}}
                    }
                }else OutlinedTextField(value,{customValues=customValues+(field.fieldKey to it)},enabled=!s.saving,label={Text(if(field.dataType=="DATE")"$label (YYYY-MM-DD)"else label)},singleLine=field.dataType!="TEXTAREA",isError=field.isRequired&&value.isBlank(),modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp))
            }
            item{
                Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(16.dp)){
                    OutlinedTextField(
                        value=name,
                        onValueChange={name=it},
                        label={Text("Item Name *")},
                        modifier=Modifier.fillMaxWidth(),
                        singleLine=true,
                        trailingIcon={
                            if(enabled("itemUnits"))FilledTonalButton(onClick={unitPage=true}){
                                Text(s.units.firstOrNull{it.id==primaryUnit}?.symbol?:"Select Unit")
                            }
                        }
                    )
                    if(expanded){
                        OutlinedTextField(
                            value=code,
                            onValueChange={code=it},
                            label={Text("Item Code / Barcode")},
                            modifier=Modifier.fillMaxWidth(),
                            trailingIcon={
                                TextButton(
                                    onClick={
                                        if(code.isBlank()){
                                            val prefix=if(service)"SER" else "ITEM"
                                            code="$prefix-${java.util.UUID.randomUUID().toString().uppercase()}"
                                        }
                                    }
                                ){Text("Assign Code")}
                            }
                        )
                        if(enabled("itemCategory"))OutlinedTextField(
                            value=categoryOptions.firstOrNull{it.id==categoryId}?.name.orEmpty(),
                            onValueChange={},
                            readOnly=true,
                            label={Text("Item Category")},
                            modifier=Modifier.fillMaxWidth(),
                            trailingIcon={
                                IconButton(onClick={categoryPage=true}){
                                    Icon(Icons.Default.ArrowDropDown,"Select category")
                                }
                            }
                        )
                        if(enabled("description"))OutlinedTextField(
                            description,
                            {description=it},
                            label={Text("Description")},
                            modifier=Modifier.fillMaxWidth(),
                            minLines=3
                        )
                        if(enabled("hsnSac"))OutlinedTextField(
                            hsn,
                            {hsn=it},
                            label={Text("HSN/SAC Code")},
                            modifier=Modifier.fillMaxWidth(),
                            trailingIcon={IconButton(onClick={hsnQuery=hsn;hsnSearch=true}){Icon(Icons.Default.Search,"Search saved HSN/SAC codes")}}
                        )
                    }
                }
            }
            if(expanded){
                item{
                    Row(Modifier.fillMaxWidth()){
                        TextButton(
                            onClick={tab="PRICING"},
                            modifier=Modifier.weight(1f)
                        ){Text("Pricing",fontWeight=if(tab=="PRICING")FontWeight.Bold else FontWeight.Normal)}
                        if(!service&&enabled("stockMaintenance"))TextButton(
                            onClick={tab="STOCK"},
                            modifier=Modifier.weight(1f)
                        ){Text("Stock",fontWeight=if(tab=="STOCK")FontWeight.Bold else FontWeight.Normal)}
                    }
                    HorizontalDivider(thickness=2.dp,color=MaterialTheme.colorScheme.primary.copy(alpha=.25f))
                }
                if(tab=="PRICING"){
                    item{
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
                            if(enabled("taxOnMrp")){
                                OutlinedTextField(mrp,{mrp=it},label={Text("MRP (tax included)")},enabled=!s.saving)
                                Text("Optional maximum retail price including tax. Invoice tax uses the selling price, not MRP.")
                            }
                            Text("Sale Price",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                            PriceWithTaxField("Sale Price",salePrice,{salePrice=it},saleTaxMode,{saleTaxMode=it})
                            if(enabled("itemWiseDiscount"))DiscountField(discountValue,{discountValue=it},discountMode,{discountMode=it})
                            if(enabled("wholesalePrice")){
                                TextButton(onClick={wholesaleOpen=true}){Text("+ Add Wholesale Price")}
                                if(wholesaleOpen)OutlinedTextField(wholesalePrice,{wholesalePrice=it},label={Text("Wholesale Price")},enabled=!s.saving)
                            }
                            HorizontalDivider()
                            Text("Purchase Price",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                            PriceWithTaxField("Purchase Price",purchasePrice,{purchasePrice=it},purchaseTaxMode,{purchaseTaxMode=it})
                            HorizontalDivider()
                            Text("Taxes",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                            if(enabled("itemWiseTax"))TaxRateField(taxRate){taxRate=it}
                        }
                    }
                }else{
                    item{
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
                            com.salespunch360.mobile.ui.account.accounting.Option("Opening warehouse",openingWarehouseId,s.warehouses.map{buildJsonObject{put("id",it.id);put("name",it.name)}}){openingWarehouseId=it}
                            HelpField("Opening Stock",openingStock,{openingStock=it},"Ex: 300"){help="OPENING"}
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                                OutlinedTextField(
                                    openingDate,
                                    {openingDate=it},
                                    label={Text("As of Date")},
                                    modifier=Modifier.weight(1f)
                                )
                                Box(Modifier.weight(1f)){
                                    HelpField("At Price/Unit",atPrice,{atPrice=it},"Ex: 2,000"){help="PRICE"}
                                }
                            }
                            Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(10.dp)){
                                Box(Modifier.weight(1f)){
                                    HelpField("Min Stock Qty",minStock,{minStock=it},"Ex: 5"){help="MIN"}
                                }
                                OutlinedTextField(
                                    itemLocation,
                                    {itemLocation=it},
                                    label={Text("Item Location")},
                                    modifier=Modifier.weight(1f)
                                )
                            }
                        }
                    }
                }
            }
            s.error?.let{
                item{if(!s.configLoaded)OutlinedButton(onClick={vm.load()},modifier=Modifier.padding(16.dp)){Text("Retry item options")}}
            }
        }
    }

    if(settings)ModalBottomSheet(onDismissRequest={settings=false}){
        Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            Text("Add Item Settings",style=MaterialTheme.typography.titleLarge)
            if(!s.canManageItemSettings)Text("Only a business administrator can change item settings.")
            listOf("customFields" to "Item Custom Fields","additionalFields" to "Additional Item Fields","wholesalePrice" to "Wholesale Price","barcodeScanning" to "Barcode Scan","itemCategory" to "Item Category","description" to "Description").forEach{(key,label)->
                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically){
                    Text(label,Modifier.weight(1f))
                    Switch(checked=enabled(key),enabled=s.canManageItemSettings&&!s.saving,onCheckedChange={vm.toggleItemSetting(key,it)})
                }
            }
            s.error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
            if(s.canManageItemSettings){
                TextButton(onClick={settings=false;navigate("/workspace/account/settings/custom-fields")}){Text("Manage Item Custom Fields")}
                TextButton(onClick={settings=false;navigate("/workspace/account/settings/reminders/service")}){Text("Service Reminders")}
                TextButton(onClick={settings=false;navigate("/workspace/account/inventory/item-settings")}){Text("More Settings")}
            }
        }
    }
    help?.let{key->
        val text=when(key){
            "OPENING"->"The quantity of item in stock before using SalesPunch360 for stock tracking."
            "PRICE"->"The average price at which you have bought the opening stock."
            else->"The minimum quantity of item you wish to maintain in stock. SalesPunch360 will notify you when stock falls below this level."
        }
        AlertDialog(
            onDismissRequest={help=null},
            text={Text(text)},
            confirmButton={TextButton(onClick={help=null}){Text("OK")}}
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PriceWithTaxField(label:String,value:String,onChange:(String)->Unit,mode:String,onMode:(String)->Unit){
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
        OutlinedTextField(value,onChange,label={Text(label)},modifier=Modifier.weight(1f))
        var open by remember{mutableStateOf(false)}
        ExposedDropdownMenuBox(
            expanded=open,
            onExpandedChange={open=it},
            modifier=Modifier.width(150.dp)
        ){
            OutlinedTextField(
                mode,
                {},
                readOnly=true,
                modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable)
            )
            ExposedDropdownMenu(expanded=open,onDismissRequest={open=false}){
                listOf("Without Tax","With Tax").forEach{x->
                    DropdownMenuItem({Text(x)},{onMode(x);open=false})
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscountField(amount:String,onAmount:(String)->Unit,mode:String,onMode:(String)->Unit){
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
        OutlinedTextField(
            amount,
            onAmount,
            label={Text("Disc. On Sale Price")},
            modifier=Modifier.weight(1f)
        )
        var open by remember{mutableStateOf(false)}
        ExposedDropdownMenuBox(expanded=open,onExpandedChange={open=it},modifier=Modifier.width(150.dp)){
            OutlinedTextField(
                mode,
                {},
                readOnly=true,
                modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable)
            )
            ExposedDropdownMenu(expanded=open,onDismissRequest={open=false}){
                listOf("Percentage","Amount").forEach{x->
                    DropdownMenuItem({Text(x)},{onMode(x);open=false})
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TaxRateField(value:String,onChange:(String)->Unit){
    var open by remember{mutableStateOf(false)}
    ExposedDropdownMenuBox(expanded=open,onExpandedChange={open=it}){
        OutlinedTextField(
            value=value.ifBlank{"None"},
            onValueChange={},
            readOnly=true,
            label={Text("Tax Rate")},
            modifier=Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth()
        )
        ExposedDropdownMenu(expanded=open,onDismissRequest={open=false}){
            listOf("","0","3","5","12","18","28").forEach{rate->
                DropdownMenuItem(
                    {Text(if(rate.isBlank())"None" else "$rate%")},
                    {onChange(rate);open=false}
                )
            }
        }
    }
}

@Composable
private fun HelpField(
    label:String,
    value:String,
    onChange:(String)->Unit,
    placeholder:String,
    onHelp:()->Unit
){
    OutlinedTextField(
        value=value,
        onValueChange=onChange,
        label={Text(label)},
        placeholder={Text(placeholder)},
        modifier=Modifier.fillMaxWidth(),
        trailingIcon={IconButton(onClick=onHelp){Icon(Icons.Default.Info,"$label help")}}
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddItemUnitScreen(
    units:List<AccountOption>,
    primary:String?,
    secondary:String?,
    conversionRate:String,
    saving:Boolean,
    onBack:()->Unit,
    onSave:(String?,String?,String)->Unit,
    onCreateUnit:(String,String,(AccountOption)->Unit)->Unit
){
    var p by remember(primary){mutableStateOf(primary)}
    var s by remember(secondary){mutableStateOf(secondary)}
    var factor by remember(conversionRate){mutableStateOf(conversionRate)}
    var addUnitTarget by remember{mutableStateOf<String?>(null)}
    var unitName by remember{mutableStateOf("")}
    var unitSymbol by remember{mutableStateOf("")}

    Scaffold(
        topBar={
            TopAppBar(
                title={Text("Add Item Unit")},
                navigationIcon={IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,"Back")}},
                colors=TopAppBarDefaults.topAppBarColors(
                    containerColor=Color(0xFF087AA5),
                    titleContentColor=Color.White,
                    navigationIconContentColor=Color.White
                )
            )
        },
        bottomBar={
            Row(Modifier.fillMaxWidth().navigationBarsPadding()){
                TextButton(onClick=onBack,modifier=Modifier.weight(1f).height(64.dp)){Text("Cancel")}
                Button(
                    onClick={ onSave(p,s,factor) },
                    enabled=!saving&&!p.isNullOrBlank()&&(s==null||(p!=s&&com.salespunch360.mobile.account.validUnitConversionRate(factor))),
                    modifier=Modifier.weight(1f).height(64.dp),
                    shape=MaterialTheme.shapes.extraSmall
                ){Text("Save")}
            }
        }
    ){padding->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp,vertical=32.dp),
            verticalArrangement=Arrangement.spacedBy(20.dp)
        ){
            UnitDropdownField(
                label="Primary Unit",
                value=p,
                units=units,
                allowNone=false,
                onSelect={p=it},
                onAddUnit={addUnitTarget="PRIMARY"}
            )
            UnitDropdownField(
                label="Secondary Unit",
                value=s,
                units=units,
                allowNone=true,
                onSelect={s=it},
                onAddUnit={addUnitTarget="SECONDARY"}
            )
            if(s!=null){OutlinedTextField(factor,{factor=it},label={Text("Secondary units per primary unit")},isError=factor.isNotBlank()&&!com.salespunch360.mobile.account.validUnitConversionRate(factor),enabled=!saving);Text("1 ${units.firstOrNull{it.id==p}?.symbol.orEmpty()} = ${factor.ifBlank{"?"}} ${units.firstOrNull{it.id==s}?.symbol.orEmpty()}")}
            Spacer(Modifier.weight(1f))
        }
    }

    if(addUnitTarget!=null)AlertDialog(
        onDismissRequest={addUnitTarget=null},
        title={Text("Add Unit")},
        text={
            Column{
                OutlinedTextField(unitName,{unitName=it},label={Text("Name")})
                OutlinedTextField(unitSymbol,{unitSymbol=it},label={Text("Symbol")})
            }
        },
        confirmButton={
            Button(
                enabled=unitName.isNotBlank()&&unitSymbol.isNotBlank()&&!saving,
                onClick={
                    val target=addUnitTarget
                    onCreateUnit(unitName,unitSymbol){u->
                        if(target=="SECONDARY")s=u.id else p=u.id
                        unitName=""
                        unitSymbol=""
                        addUnitTarget=null
                    }
                }
            ){Text("Save")}
        },
        dismissButton={TextButton(onClick={addUnitTarget=null}){Text("Cancel")}}
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun UnitDropdownField(
    label:String,
    value:String?,
    units:List<AccountOption>,
    allowNone:Boolean,
    onSelect:(String?)->Unit,
    onAddUnit:()->Unit
){
    var expanded by remember{mutableStateOf(false)}
    ExposedDropdownMenuBox(
        expanded=expanded,
        onExpandedChange={expanded=it},
        modifier=Modifier.fillMaxWidth()
    ){
        OutlinedTextField(
            value=units.firstOrNull{it.id==value}?.name.orEmpty(),
            onValueChange={},
            readOnly=true,
            placeholder={Text(label)},
            trailingIcon={ExposedDropdownMenuDefaults.TrailingIcon(expanded=expanded)},
            modifier=Modifier
                .menuAnchor(MenuAnchorType.PrimaryNotEditable)
                .fillMaxWidth()
                .height(60.dp),
            singleLine=true
        )
        ExposedDropdownMenu(
            expanded=expanded,
            onDismissRequest={expanded=false}
        ){
            DropdownMenuItem(
                text={Text("Add Unit",color=MaterialTheme.colorScheme.primary,fontWeight=FontWeight.SemiBold)},
                onClick={expanded=false;onAddUnit()}
            )
            if(allowNone){
                DropdownMenuItem(
                    text={Text("None")},
                    onClick={expanded=false;onSelect(null)}
                )
            }
            units.forEach{u->
                DropdownMenuItem(
                    text={Text(u.name.uppercase()+" ( "+u.symbol.orEmpty()+" )")},
                    onClick={expanded=false;onSelect(u.id)}
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategorySelectorScreen(
    categories:List<AccountOption>,
    selected:String?,
    service:Boolean,
    saving:Boolean,
    onClose:()->Unit,
    onApply:(String?)->Unit,
    onCreateCategory:(String,Boolean,(AccountOption)->Unit)->Unit
){
    var draft by remember(selected){mutableStateOf(selected)}
    var query by remember{mutableStateOf("")}
    var add by remember{mutableStateOf(false)}
    var newName by remember{mutableStateOf("")}
    val filtered=categories.filter{it.name.contains(query,true)}
    Scaffold(
        topBar={
            TopAppBar(
                title={Text("Select Category")},
                actions={IconButton(onClick=onClose){Icon(Icons.Default.Close,"Close")}}
            )
        },
        bottomBar={
            Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(16.dp)){
                Button(
                    onClick={ onApply(draft) },
                    modifier=Modifier.fillMaxWidth().height(56.dp)
                ){Text("Apply")}
            }
        }
    ){padding->
        LazyColumn(
            Modifier.fillMaxSize().padding(padding),
            contentPadding=PaddingValues(bottom=20.dp)
        ){
            item{
                OutlinedTextField(
                    query,
                    {query=it},
                    label={Text("Search Category")},
                    leadingIcon={Icon(Icons.Default.Search,null)},
                    modifier=Modifier.fillMaxWidth().padding(16.dp)
                )
            }
            item{
                ListItem(
                    headlineContent={Text("Add New Category",color=MaterialTheme.colorScheme.primary)},
                    trailingContent={Icon(Icons.Default.AddCircle,null)},
                    modifier=Modifier.clickable{add=true}
                )
            }
            items(filtered,key={it.id}){cat->
                ListItem(
                    headlineContent={Text(cat.name.uppercase())},
                    trailingContent={
                        Checkbox(
                            checked=draft==cat.id,
                            onCheckedChange={checked->draft=if(checked)cat.id else null}
                        )
                    },
                    modifier=Modifier.clickable{draft=if(draft==cat.id)null else cat.id}
                )
                HorizontalDivider()
            }
        }
    }
    if(add)AlertDialog(
        onDismissRequest={add=false},
        title={Text("Add New Category")},
        text={OutlinedTextField(newName,{newName=it},label={Text("Category Name")})},
        confirmButton={
            Button(
                enabled=newName.isNotBlank()&&!saving,
                onClick={
                    onCreateCategory(newName,service){row->
                        draft=row.id
                        add=false
                    }
                }
            ){Text("Save")}
        },
        dismissButton={TextButton(onClick={add=false}){Text("Cancel")}}
    )
}
