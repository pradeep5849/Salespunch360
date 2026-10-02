package com.salespunch360.mobile
import com.salespunch360.mobile.account.*
import org.junit.Assert.assertEquals
import org.junit.Test
class AccountSaleCustomerFlowTest{@Test fun `created party is inserted and selected`(){val draft=SalesEditorDraft(branchId="branch"),state=AccountSalesState(saving=true,options=SalesOptions(customers=listOf(SalesOption("old","Old"))),editor=draft),customer=SalesOption("new","New Party","branch",phone="999");val next=applyCreatedSaleCustomer(state,customer);assertEquals("new",next.editor?.customerId);assertEquals(listOf("old","new"),next.options.customers.map{it.id});assertEquals(false,next.saving)}}
