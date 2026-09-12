import {describe,expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {humanize,StatusBadge} from "./account-ui";

describe("authenticated account presentation",()=>{
  it("turns internal enum values into readable labels",()=>{expect(humanize("PENDING_APPROVAL")).toBe("Pending Approval");expect(humanize("PURCHASE_BILL")).toBe("Purchase Bill")});
  it("uses restrained semantic status tones",()=>{expect(renderToStaticMarkup(<StatusBadge value="POSTED"/>)).toContain("account-status-success");expect(renderToStaticMarkup(<StatusBadge value="REJECTED"/>)).toContain("account-status-danger")});
});
