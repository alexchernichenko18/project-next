import { expect, test } from "@playwright/test";
import { mockBackend, seedAuth } from "./helpers";

test("logout: clicking Logout clears the session and returns to /sign-in", async ({
  context,
  page,
}) => {
  await seedAuth(context);
  await mockBackend(page);

  await page.goto("/messages");
  await page.waitForURL("**/messages");
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

  await page.getByRole("button", { name: "Logout" }).click();

  await page.waitForURL("**/sign-in");
  await expect(
    page.locator('[data-slot="card-title"]').filter({ hasText: "Sign in" }),
  ).toBeVisible();

  const tokenAfter = await page.evaluate(() =>
    window.localStorage.getItem("accessToken"),
  );
  expect(tokenAfter).toBeNull();
});
