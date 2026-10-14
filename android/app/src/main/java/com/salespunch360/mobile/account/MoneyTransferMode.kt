package com.salespunch360.mobile.account

enum class MoneyTransferMode(val label:String){BANK_TO_CASH("Bank to Cash"),CASH_TO_BANK("Cash to Bank"),BANK_TO_BANK("Bank to Bank"),ALL("Other internal transfer")}
fun transferModeAccepts(mode:MoneyTransferMode,type:String,source:Boolean):Boolean {
 if(mode==MoneyTransferMode.ALL)return true
 val cash=(mode==MoneyTransferMode.BANK_TO_CASH&&!source)||(mode==MoneyTransferMode.CASH_TO_BANK&&source)
 return if(cash)type=="CASH"||type=="PETTY_CASH" else type=="BANK"
}
