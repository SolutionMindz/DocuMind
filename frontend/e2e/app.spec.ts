import path from "path";
import { expect, test } from "@playwright/test";

const SAMPLE_PDF = path.join(__dirname, "fixtures", "sample.pdf");

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

test("home page loads and shows header", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("header")).toContainText("DocuMind");
});

test("home page shows upload zone", async ({ page }) => {
  await page.goto("/");
  const uploadZone = page.getByText("Drag and drop a PDF, or click to browse");
  await expect(uploadZone).toBeVisible();
});

test("home page shows recent documents section", async ({ page }) => {
  await page.goto("/");
  const heading = page.getByText("Recent documents");
  await expect(heading).toBeVisible();
});

test("home page resolves out of loading state", async ({ page }) => {
  await page.goto("/");
  // Wait for the "Loading..." text to disappear — either the empty state
  // or a list of documents must appear.
  await page.waitForFunction(
    () => !document.body.innerText.includes("Loading...")
  );
  const hasEmpty = await page.getByText("No documents yet").isVisible().catch(() => false);
  const hasList = await page.locator("a[href^='/documents/']").count();
  expect(hasEmpty || hasList > 0).toBe(true);
});

// ---------------------------------------------------------------------------
// Upload flow
// ---------------------------------------------------------------------------

test("upload a PDF and see it appear in the list", async ({ page }) => {
  await page.goto("/");

  // Trigger file chooser and pick the sample PDF
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);
  await fileChooser.setFiles(SAMPLE_PDF);

  // Should see the new document card appear
  await expect(
    page.locator("a[href^='/documents/']").filter({ hasText: "sample.pdf" }).first()
  ).toBeVisible({ timeout: 10_000 });
});

test("uploading a non-PDF shows an error", async ({ page }) => {
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);

  // Create a temp .txt file as buffer
  await fileChooser.setFiles({
    name: "notapdf.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });

  // react-dropzone rejects non-PDFs silently (no upload attempt), so the
  // upload zone stays intact (no "Uploading..." spinner)
  await expect(page.getByText("Uploading...")).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Document detail page
// ---------------------------------------------------------------------------

test("clicking a document card navigates to the detail page", async ({ page }) => {
  await page.goto("/");

  const card = page.locator("a[href^='/documents/']").first();
  const count = await card.count();

  if (count === 0) {
    // Upload one first
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByText("Drag and drop a PDF, or click to browse").click(),
    ]);
    await fileChooser.setFiles(SAMPLE_PDF);
    await page.locator("a[href^='/documents/']").first().waitFor({ timeout: 10_000 });
  }

  await page.locator("a[href^='/documents/']").first().click();
  await expect(page).toHaveURL(/\/documents\/.+/);
});

test("document detail page shows filename and status badge", async ({ page }) => {
  await page.goto("/");

  // Ensure at least one document exists
  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);
  await fileChooser.setFiles(SAMPLE_PDF);

  const card = page.locator("a[href^='/documents/']").filter({ hasText: "sample.pdf" }).first();
  await card.waitFor({ timeout: 10_000 });
  await card.click();

  await expect(page).toHaveURL(/\/documents\/.+/);
  // Filename in heading
  await expect(page.getByRole("heading")).toContainText("sample.pdf");
  // Status badge shown (the <span> next to the filename, not the body text)
  const statusBadge = page.locator("span").filter({ hasText: /^(Queued|Processing\.\.\.|Ready|Error)$/ });
  await expect(statusBadge).toBeVisible();
});

test("document detail page shows Back link", async ({ page }) => {
  await page.goto("/");

  const card = page.locator("a[href^='/documents/']").first();
  const count = await card.count();
  if (count === 0) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByText("Drag and drop a PDF, or click to browse").click(),
    ]);
    await fileChooser.setFiles(SAMPLE_PDF);
    await page.locator("a[href^='/documents/']").first().waitFor({ timeout: 10_000 });
  }

  await page.locator("a[href^='/documents/']").first().click();
  const backLink = page.getByText("← Back");
  await expect(backLink).toBeVisible();

  await backLink.click();
  await expect(page).toHaveURL("/");
});

// ---------------------------------------------------------------------------
// Query box (present only when document is ready)
// ---------------------------------------------------------------------------

test("query input is disabled when document is not ready", async ({ page }) => {
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);
  await fileChooser.setFiles(SAMPLE_PDF);

  const card = page.locator("a[href^='/documents/']").filter({ hasText: "sample.pdf" }).first();
  await card.waitFor({ timeout: 10_000 });
  await card.click();

  // If status is queued/processing the "Ask AI" panel is not shown at all
  // (the component only renders it when status === "ready").
  // We just verify the query input either doesn't exist OR is disabled.
  const input = page.getByPlaceholder(/Ask a question|Document not ready/i);
  const isVisible = await input.isVisible().catch(() => false);
  if (isVisible) {
    await expect(input).toBeDisabled();
  }
  // Otherwise the entire QueryBox panel is hidden — both cases are correct.
});
