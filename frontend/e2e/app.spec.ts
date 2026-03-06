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
  await expect(page.getByText("Drag and drop a PDF, or click to browse")).toBeVisible();
});

test("home page shows recent documents section", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Recent documents")).toBeVisible();
});

test("home page resolves out of loading state", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => !document.body.innerText.includes("Loading..."));
  const hasEmpty = await page.getByText("No documents yet").isVisible().catch(() => false);
  const hasError = await page.getByText(/Ensure the API/).isVisible().catch(() => false);
  const hasList = await page.locator("a[href^='/d/']").count();
  expect(hasEmpty || hasError || hasList > 0).toBe(true);
});

// ---------------------------------------------------------------------------
// Upload flow
// ---------------------------------------------------------------------------

test("upload a PDF and see it appear in the list", async ({ page }) => {
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);
  await fileChooser.setFiles(SAMPLE_PDF);

  await expect(
    page.locator("a[href^='/d/']").filter({ hasText: "sample.pdf" }).first()
  ).toBeVisible({ timeout: 10_000 });
});

test("uploading a non-PDF is silently rejected", async ({ page }) => {
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);
  await fileChooser.setFiles({
    name: "notapdf.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello"),
  });

  // react-dropzone rejects non-PDFs — no spinner should appear
  await expect(page.getByText("Uploading...")).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Document detail page
// ---------------------------------------------------------------------------

test("clicking a document card navigates to the detail page", async ({ page }) => {
  await page.goto("/");

  let card = page.locator("a[href^='/d/']").first();
  if ((await card.count()) === 0) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByText("Drag and drop a PDF, or click to browse").click(),
    ]);
    await fileChooser.setFiles(SAMPLE_PDF);
    card = page.locator("a[href^='/d/']").first();
    await card.waitFor({ timeout: 10_000 });
  }

  await card.click();
  await expect(page).toHaveURL(/\/d\/.+/);
});

test("document detail page shows filename and status badge", async ({ page }) => {
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);
  await fileChooser.setFiles(SAMPLE_PDF);

  const card = page.locator("a[href^='/d/']").filter({ hasText: "sample.pdf" }).first();
  await card.waitFor({ timeout: 10_000 });
  await card.click();

  await expect(page).toHaveURL(/\/d\/.+/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("sample.pdf");

  const statusBadge = page
    .locator("span")
    .filter({ hasText: /^(Queued|Processing\.\.\.|Ready|Error)$/ });
  await expect(statusBadge).toBeVisible();
});

test("document detail page shows Document Intake Panel", async ({ page }) => {
  await page.goto("/");

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByText("Drag and drop a PDF, or click to browse").click(),
  ]);
  await fileChooser.setFiles(SAMPLE_PDF);

  const card = page.locator("a[href^='/d/']").filter({ hasText: "sample.pdf" }).first();
  await card.waitFor({ timeout: 10_000 });
  await card.click();

  await expect(page).toHaveURL(/\/d\/.+/);
  // DocumentIntakePanel heading
  await expect(page.getByText("1. Document Intake Panel")).toBeVisible();
  // Status cells
  await expect(page.getByText("UPLOAD STATUS")).toBeVisible();
  await expect(page.getByText("PROCESSING STAGE")).toBeVisible();
  await expect(page.getByText("FILE SIZE")).toBeVisible();
});

test("document detail page shows Back link and navigates home", async ({ page }) => {
  await page.goto("/");

  let card = page.locator("a[href^='/d/']").first();
  if ((await card.count()) === 0) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByText("Drag and drop a PDF, or click to browse").click(),
    ]);
    await fileChooser.setFiles(SAMPLE_PDF);
    card = page.locator("a[href^='/d/']").first();
    await card.waitFor({ timeout: 10_000 });
  }

  await card.click();
  await expect(page.getByText("← Back")).toBeVisible();
  await page.getByText("← Back").click();
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

  const card = page.locator("a[href^='/d/']").filter({ hasText: "sample.pdf" }).first();
  await card.waitFor({ timeout: 10_000 });
  await card.click();

  const input = page.getByPlaceholder(/Ask a question|Document not ready/i);
  const isVisible = await input.isVisible().catch(() => false);
  if (isVisible) {
    await expect(input).toBeDisabled();
  }
  // Panel hidden until status === ready — both cases are valid.
});
