import { expect, it } from "vitest";
import sharp from "sharp";
import { expenseItemInput, expenseItemPhoto } from "./expense-items";
it("validates a trimmed company item name and retry identity", () => {
  expect(
    expenseItemInput.parse({
      name: " Fuel ",
      requestKey: "11111111-1111-4111-8111-111111111111",
    }).name,
  ).toBe("Fuel");
  expect(
    expenseItemInput.safeParse({ name: " ", requestKey: "bad" }).success,
  ).toBe(false);
  expect(
    expenseItemInput.safeParse({
      name: "a".repeat(241),
      requestKey: "11111111-1111-4111-8111-111111111111",
    }).success,
  ).toBe(false);
});
it("decodes and bounds photo dimensions and strips original metadata", async () => {
  const input = await sharp({
    create: { width: 1400, height: 900, channels: 3, background: "red" },
  })
    .jpeg()
    .toBuffer();
  const photo = await expenseItemPhoto(
    new File([new Uint8Array(input)], "item.jpg", { type: "image/jpeg" }),
  );
  const metadata = await sharp(photo).metadata();
  expect(metadata.format).toBe("webp");
  expect(Math.max(metadata.width!, metadata.height!)).toBeLessThanOrEqual(720);
  expect(metadata.exif).toBeUndefined();
});
it("rejects corrupt images and non-image uploads", async () => {
  await expect(
    expenseItemPhoto(new File(["invalid"], "bad.jpg", { type: "image/jpeg" })),
  ).rejects.toThrow("INVALID_EXPENSE_ITEM_PHOTO");
  await expect(
    expenseItemPhoto(new File(["plain"], "bad.txt", { type: "text/plain" })),
  ).rejects.toThrow("INVALID_EXPENSE_ITEM_PHOTO");
});
