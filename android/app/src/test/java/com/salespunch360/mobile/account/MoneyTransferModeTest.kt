package com.salespunch360.mobile.account
import org.junit.Assert.*
import org.junit.Test
class MoneyTransferModeTest {
 @Test fun cashRemainsOnCorrectSide(){assertTrue(transferModeAccepts(MoneyTransferMode.BANK_TO_CASH,"BANK",true));assertFalse(transferModeAccepts(MoneyTransferMode.BANK_TO_CASH,"CASH",true));assertTrue(transferModeAccepts(MoneyTransferMode.BANK_TO_CASH,"PETTY_CASH",false));assertTrue(transferModeAccepts(MoneyTransferMode.CASH_TO_BANK,"CASH",true));assertFalse(transferModeAccepts(MoneyTransferMode.CASH_TO_BANK,"BANK",true));assertTrue(transferModeAccepts(MoneyTransferMode.CASH_TO_BANK,"BANK",false))}
 @Test fun bankToBankDeniesCashOnBothSides(){for(source in listOf(true,false)){assertTrue(transferModeAccepts(MoneyTransferMode.BANK_TO_BANK,"BANK",source));assertFalse(transferModeAccepts(MoneyTransferMode.BANK_TO_BANK,"CASH",source))};assertTrue(transferModeAccepts(MoneyTransferMode.ALL,"PETTY_CASH",true))}
}
