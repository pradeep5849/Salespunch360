import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({order:vi.fn(),payments:vi.fn()}));
vi.mock("./cashfree-sandbox",()=>({fetchSandboxOrder:mocks.order,fetchSandboxPayments:mocks.payments}));
import { verifyCashfreeSandboxPayment } from "./cashfree-verification";
const snapshot={id:"test-order",totalAmount:{toFixed:()=> "100.00"},currency:"INR"};
const remote={order_id:snapshot.id,order_currency:"INR",order_amount:100,order_status:"PAID"};
const payment={order_id:snapshot.id,payment_currency:"INR",payment_amount:100,payment_status:"SUCCESS",cf_payment_id:"12345",payment_time:"2026-11-25T10:00:00Z"};
beforeEach(()=>{vi.resetAllMocks();mocks.order.mockResolvedValue(remote);mocks.payments.mockResolvedValue([payment]);});
describe("Cashfree sandbox verification",()=>{
it("returns a sandbox-tagged verified capture",async()=>{expect(await verifyCashfreeSandboxPayment(snapshot)).toMatchObject({provider:"CASHFREE_SANDBOX",providerPaymentId:"cashfree_sandbox_12345",amount:"100.00",currency:"INR",orderId:snapshot.id});});
it("does not activate an unpaid order",async()=>{mocks.order.mockResolvedValue({...remote,order_status:"ACTIVE"});expect(await verifyCashfreeSandboxPayment(snapshot)).toBeNull();expect(mocks.payments).not.toHaveBeenCalled();});
it.each([{order_amount:99},{order_currency:"USD"},{order_id:"other"}])("rejects mismatched remote orders %o",async patch=>{mocks.order.mockResolvedValue({...remote,...patch});await expect(verifyCashfreeSandboxPayment(snapshot)).rejects.toThrow("PAYMENT_MISMATCH");});
it.each([{payment_amount:99},{payment_currency:"USD"},{payment_status:"FAILED"},{order_id:"other"}])("rejects mismatched captures %o",async patch=>{mocks.payments.mockResolvedValue([{...payment,...patch}]);await expect(verifyCashfreeSandboxPayment(snapshot)).rejects.toThrow("PAYMENT_MISMATCH");});
it("rejects invalid capture timestamps",async()=>{mocks.payments.mockResolvedValue([{...payment,payment_time:"invalid"}]);await expect(verifyCashfreeSandboxPayment(snapshot)).rejects.toThrow("INVALID_PAYMENT_TIME");});
});
