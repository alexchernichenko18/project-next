import { expect, test } from "@playwright/test";
import { mockBackend } from "./helpers";

// CardTitle is rendered as a `<div data-slot="card-title">`, not a heading,
// so we target it by data attribute. The button is matched by accessible
// name with a regex so it covers both "Sign in" and the pending "Signing in…".
const cardTitle = (label: RegExp | string) =>
  (page: import("@playwright/test").Page) =>
    page
      .locator('[data-slot="card-title"]')
      .filter({ hasText: label instanceof RegExp ? label : new RegExp(label) });

const sonnerToast = (label: RegExp) =>
  (page: import("@playwright/test").Page) =>
    page.locator("[data-sonner-toast]").filter({ hasText: label });

test.describe("sign-in flow", () => {
  test("happy path: valid creds land on /messages with an empty state", async ({
    page,
  }) => {
    await mockBackend(page);

    await page.goto("/sign-in");
    await expect(cardTitle("Sign in")(page)).toBeVisible();

    await page.getByLabel("Email").fill("alice@example.com");
    await page.getByLabel("Password").fill("super-secret");
    await page.getByRole("button", { name: /^Sign(ing)? in/ }).click();

    await page.waitForURL("**/messages");

    // The protected layout's header shows the signed-in email; the chat list
    // shows the empty state our mocked GET /messages returns.
    await expect(page.getByText("alice@example.com")).toBeVisible();
    await expect(page.getByText(/No messages yet/i)).toBeVisible();
  });

  test("invalid creds: surfaces the auth error toast and stays on /sign-in", async ({
    page,
  }) => {
    await mockBackend(page, {
      loginStatus: 401,
      loginBody: { message: "Invalid credentials" },
    });

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill("alice@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: /^Sign(ing)? in/ }).click();

    await expect(sonnerToast(/Invalid email or password/i)(page)).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/sign-in");
  });
});
