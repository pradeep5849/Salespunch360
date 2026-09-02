import{afterEach,beforeEach,describe,expect,it,vi}from"vitest";
import{reverseGeocode}from"./reverse-geocode";

describe("reverseGeocode",()=>{
 const original=process.env.GOOGLE_MAPS_SERVER_API_KEY;
 beforeEach(()=>{process.env.GOOGLE_MAPS_SERVER_API_KEY="server-secret";vi.stubGlobal("fetch",vi.fn());});
 afterEach(()=>{vi.unstubAllGlobals();if(original===undefined)delete process.env.GOOGLE_MAPS_SERVER_API_KEY;else process.env.GOOGLE_MAPS_SERVER_API_KEY=original;});
 it("returns the first usable bounded formatted address",async()=>{vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({status:"OK",results:[{formatted_address:"  Bengaluru, Karnataka  "}]}),{status:200}));await expect(reverseGeocode(12.97,77.59)).resolves.toBe("Bengaluru, Karnataka");expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain("latlng=12.97%2C77.59");});
 it("returns null without a server key",async()=>{delete process.env.GOOGLE_MAPS_SERVER_API_KEY;await expect(reverseGeocode(1,2)).resolves.toBeNull();expect(fetch).not.toHaveBeenCalled();});
 it.each([{status:"ZERO_RESULTS",results:[]},{status:"REQUEST_DENIED",results:[]},{status:"OK",results:[{}]}])("returns null for unusable Google responses",async body=>{vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify(body),{status:200}));await expect(reverseGeocode(1,2)).resolves.toBeNull();});
 it("returns null for network and HTTP errors",async()=>{vi.mocked(fetch).mockRejectedValueOnce(new Error("network"));await expect(reverseGeocode(1,2)).resolves.toBeNull();vi.mocked(fetch).mockResolvedValueOnce(new Response("no",{status:500}));await expect(reverseGeocode(1,2)).resolves.toBeNull();});
 it("aborts a stalled request and returns null",async()=>{vi.useFakeTimers();vi.mocked(fetch).mockImplementation((_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener("abort",()=>reject(new DOMException("Aborted","AbortError")))));const result=reverseGeocode(1,2);await vi.advanceTimersByTimeAsync(3000);await expect(result).resolves.toBeNull();vi.useRealTimers();});
});
