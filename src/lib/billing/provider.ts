export type VerifiedPayment={provider:string;providerPaymentId:string;orderId:string;amount:string;currency:'INR';capturedAt:Date};
export const PAYMENT_PROVIDER_STATUS = 'UNCONFIGURED' as const;
export interface PaymentProvider{createOrder(input:{orderId:string;amount:string;currency:'INR'}):Promise<{providerOrderId:string}>;verifyPayment(input:unknown):Promise<VerifiedPayment>}
export class UnconfiguredPaymentProvider implements PaymentProvider{async createOrder():Promise<never>{throw new Error('PAYMENT_PROVIDER_UNAVAILABLE')}async verifyPayment():Promise<never>{throw new Error('PAYMENT_PROVIDER_UNAVAILABLE')}}
export class TestPaymentProvider implements PaymentProvider{constructor(){if(process.env.NODE_ENV==='production')throw new Error('TEST_PROVIDER_FORBIDDEN')}async createOrder(i:{orderId:string}){return{providerOrderId:`test_order_${i.orderId}`}}async verifyPayment(input:unknown){const i=input as VerifiedPayment;if(!i||i.provider!=='TEST'||!i.providerPaymentId)throw new Error('PAYMENT_VERIFICATION_FAILED');return i}}
export function paymentProvider(){return new UnconfiguredPaymentProvider()}
