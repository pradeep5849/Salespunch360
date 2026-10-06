package com.salespunch360.mobile.ui.account.inventory

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
    vm:AccountAddItemViewModel=viewModel()
){
    val s=vm.state.collectAsStateWithLifecycle().value
    var service by remember{mutableStateOf(false)}
    var name by remember{mutableStateOf("")}
    var primaryUnit by remember{mutableStateOf<String?>(null)}
    var secondaryUnit by remember{mutableStateOf<String?>(null)}
    var code by remember{mutableStateOf("")}
    var categoryId by remember{mutableStateOf<String?>(null)}
    var description by remember{mutableStateOf("")}
    var hsn by remember{mutableStateOf("")}
    var salePrice by remember{mutableStateOf("")}
    var purchasePrice by remember{mutableStateOf("")}
    var taxRate by remember{mutableStateOf("")}
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
            saving=s.saving,
            onBack={unitPage=false},
            onSave={pUnit,sUnit->
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
            categories=s.categories,
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

    val expanded=name.isNotBlank()
    Scaffold(
        containerColor=MaterialTheme.colorScheme.surface,
        topBar={
            TopAppBar(
                title={Text("Add Item")},
                navigationIcon={IconButton(onClick=back){Icon(Icons.Default.ArrowBack,"Back")}},
                actions={
                    IconButton(onClick={}){Icon(Icons.Default.AddAPhoto,"Add item image")}
                    IconButton(onClick={settings=true}){Icon(Icons.Default.Settings,"Item settings")}
                }
            )
        },
        bottomBar={
            Surface(shadowElevation=6.dp){
                Row(Modifier.fillMaxWidth().navigationBarsPadding()){
                    TextButton(onClick=back,modifier=Modifier.weight(1f).height(64.dp)){Text("Cancel")}
                    Button(
                        onClick={
                            vm.save(
                                service=service,
                                name=name,
                                unitId=primaryUnit,
                                categoryId=categoryId,
                                code=code,
                                description=description,
                                sellingRate=salePrice,
                                cost=purchasePrice.ifBlank{atPrice},
                                taxRate=taxRate,
                                hsnSac=hsn,
                                trackInventory=!service&&(openingStock.isNotBlank()||minStock.isNotBlank()||itemLocation.isNotBlank()),
                                lowStockThreshold=minStock,
                            ){back()}
                        },
                        enabled=name.isNotBlank()&&!s.saving,
                        modifier=Modifier.weight(1f).height(64.dp),
                        shape=MaterialTheme.shapes.extraSmall
                    ){Text(if(s.saving)"Saving…" else "Save")}
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
                        onCheckedChange={
                            service=it
                            categoryId=null
                        },
                        modifier=Modifier.padding(horizontal=18.dp)
                    )
                    Text("Services",fontWeight=if(service)FontWeight.Bold else FontWeight.Normal)
                }
                HorizontalDivider()
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
                            FilledTonalButton(onClick={unitPage=true}){
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
                                            code="$prefix-${System.currentTimeMillis().toString().takeLast(6)}"
                                        }
                                    }
                                ){Text("Assign Code")}
                            }
                        )
                        OutlinedTextField(
                            value=s.categories.firstOrNull{it.id==categoryId}?.name.orEmpty(),
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
                        OutlinedTextField(
                            description,
                            {description=it},
                            label={Text("Description")},
                            modifier=Modifier.fillMaxWidth(),
                            minLines=3
                        )
                        OutlinedTextField(
                            hsn,
                            {hsn=it},
                            label={Text("HSN/SAC Code")},
                            modifier=Modifier.fillMaxWidth(),
                            trailingIcon={Icon(Icons.Default.Search,null)}
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
                        TextButton(
                            onClick={tab="STOCK"},
                            modifier=Modifier.weight(1f)
                        ){Text("Stock",fontWeight=if(tab=="STOCK")FontWeight.Bold else FontWeight.Normal)}
                    }
                    HorizontalDivider(thickness=2.dp,color=MaterialTheme.colorScheme.primary.copy(alpha=.25f))
                }
                if(tab=="PRICING"){
                    item{
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
                            Text("Sale Price",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                            PriceWithTaxField("Sale Price",salePrice,{salePrice=it})
                            DiscountField()
                            TextButton(onClick={}){Text("+ Add Wholesale Price")}
                            HorizontalDivider()
                            Text("Purchase Price",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                            PriceWithTaxField("Purchase Price",purchasePrice,{purchasePrice=it})
                            HorizontalDivider()
                            Text("Taxes",style=MaterialTheme.typography.titleMedium,fontWeight=FontWeight.Bold)
                            TaxRateField(taxRate){taxRate=it}
                        }
                    }
                }else{
                    item{
                        Column(Modifier.padding(16.dp),verticalArrangement=Arrangement.spacedBy(14.dp)){
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
            s.error?.let{error->
                item{Text(error,color=MaterialTheme.colorScheme.error,modifier=Modifier.padding(16.dp))}
            }
        }
    }

    if(settings)ModalBottomSheet(onDismissRequest={settings=false}){
        Column(Modifier.fillMaxWidth().padding(20.dp),verticalArrangement=Arrangement.spacedBy(12.dp)){
            Text("Add Item Settings",style=MaterialTheme.typography.titleLarge)
            listOf("Item Custom Fields","Additional Item Fields","Wholesale Price","Barcode Scan","Item Category","Description").forEach{
                Text("$it  ›")
            }
            Text("Service Reminders · Coming Soon")
            TextButton(onClick={settings=false;navigate("/workspace/account/inventory/item-settings")}){
                Text("⚙ More Settings")
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
private fun PriceWithTaxField(label:String,value:String,onChange:(String)->Unit){
    var mode by remember{mutableStateOf("Without Tax")}
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
                    DropdownMenuItem({Text(x)},{mode=x;open=false})
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DiscountField(){
    var amount by remember{mutableStateOf("")}
    var mode by remember{mutableStateOf("Percentage")}
    Row(Modifier.fillMaxWidth(),horizontalArrangement=Arrangement.spacedBy(8.dp)){
        OutlinedTextField(
            amount,
            {amount=it},
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
                    DropdownMenuItem({Text(x)},{mode=x;open=false})
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
    saving:Boolean,
    onBack:()->Unit,
    onSave:(String?,String?)->Unit,
    onCreateUnit:(String,String,(AccountOption)->Unit)->Unit
){
    var p by remember(primary){mutableStateOf(primary)}
    var s by remember(secondary){mutableStateOf(secondary)}
    var target by remember{mutableStateOf<String?>(null)}
    var query by remember{mutableStateOf("")}
    var addUnit by remember{mutableStateOf(false)}
    var unitName by remember{mutableStateOf("")}
    var unitSymbol by remember{mutableStateOf("")}
    val filtered=units.filter{"${it.name} ${it.symbol.orEmpty()}".contains(query,true)}
    Scaffold(
        topBar={
            TopAppBar(
                title={Text("Add Item Unit")},
                navigationIcon={IconButton(onClick=onBack){Icon(Icons.Default.ArrowBack,"Back")}},
                colors=TopAppBarDefaults.topAppBarColors(
                    containerColor=Color(0xFF1685AD),
                    titleContentColor=Color.White,
                    navigationIconContentColor=Color.White
                )
            )
        },
        bottomBar={
            Row(Modifier.fillMaxWidth().navigationBarsPadding()){
                TextButton(onClick=onBack,modifier=Modifier.weight(1f).height(64.dp)){Text("Cancel")}
                Button(
                    onClick={ onSave(p,s) },
                    enabled=!p.isNullOrBlank(),
                    modifier=Modifier.weight(1f).height(64.dp),
                    shape=MaterialTheme.shapes.extraSmall
                ){Text("Save")}
            }
        }
    ){padding->
        Column(
            Modifier.fillMaxSize().padding(padding).padding(horizontal=16.dp,vertical=32.dp),
            verticalArrangement=Arrangement.spacedBy(28.dp)
        ){
            UnitSelectorField("Primary Unit",p,units){target="PRIMARY";query=""}
            UnitSelectorField("Secondary Unit",s,units){target="SECONDARY";query=""}
            if(target!=null){
                OutlinedTextField(
                    query,
                    {query=it},
                    label={Text(if(target=="PRIMARY")"Primary Unit" else "Secondary Unit")},
                    modifier=Modifier.fillMaxWidth()
                )
                TextButton(onClick={addUnit=true}){Text("Add Unit")}
                LazyColumn(Modifier.fillMaxWidth().weight(1f)){
                    if(target=="SECONDARY"){
                        item{
                            ListItem(
                                headlineContent={Text("None")},
                                modifier=Modifier.clickable{s=null;query="";target=null}
                            )
                        }
                    }
                    items(filtered,key={it.id}){u->
                        ListItem(
                            headlineContent={Text(u.name.uppercase()+" ( "+u.symbol.orEmpty()+" )")},
                            modifier=Modifier.clickable{
                                if(target=="PRIMARY")p=u.id else s=u.id
                                query=""
                                target=null
                            }
                        )
                    }
                }
            }else{
                Spacer(Modifier.weight(1f))
            }
        }
    }
    if(addUnit)AlertDialog(
        onDismissRequest={addUnit=false},
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
                    onCreateUnit(unitName,unitSymbol){u->
                        p=u.id
                        addUnit=false
                        target=null
                    }
                }
            ){Text("Save")}
        },
        dismissButton={TextButton(onClick={addUnit=false}){Text("Cancel")}}
    )
}

@Composable
private fun UnitSelectorField(label:String,value:String?,units:List<AccountOption>,open:()->Unit){
    OutlinedTextField(
        value=units.firstOrNull{it.id==value}?.name.orEmpty(),
        onValueChange={},
        readOnly=true,
        placeholder={Text(label)},
        trailingIcon={Icon(Icons.Default.ArrowDropDown,"Select $label")},
        modifier=Modifier.fillMaxWidth().height(72.dp).clickable(onClick=open),
        singleLine=true
    )
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
