import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers/login";

const UNIQUE_TITLE = `E2E Test ${Date.now()}`;
let requestId: string = "";

test.describe.serial("Flujo completo de aprobación", () => {
  test("login como solicitante redirige al dashboard", async ({ page }) => {
    await loginAs(page, "solicitante@alpha.cl", "Password123!");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("crear solicitud de compra como borrador", async ({ page }) => {
    await loginAs(page, "solicitante@alpha.cl", "Password123!");
    await page.goto("/dashboard/requests/new");

    
    await page.getByLabel(/título/i).fill(UNIQUE_TITLE);
    await page.getByLabel(/descripción/i).fill("Solicitud creada por prueba E2E automatizada");
    await page.getByLabel(/centro de costo/i).fill("CC-E2E");

    const productDesc = page.getByPlaceholder(/descripción del producto/i).first();
    const productQty = page.getByPlaceholder(/cantidad/i).first();
    const productPrice = page.getByPlaceholder(/precio/i).first();

    await productDesc.fill("Laptop E2E");
    await productQty.fill("1");
    await productPrice.fill("600000"); 

   
    await page.getByRole("button", { name: /guardar borrador/i }).click();

 
    await page.waitForURL(/\/dashboard\/requests/, { timeout: 15_000 });

    await page.goto("/dashboard/requests");
    await expect(page.getByText(UNIQUE_TITLE)).toBeVisible({ timeout: 10_000 });
  });

  test("enviar solicitud a jefatura", async ({ page }) => {
    await loginAs(page, "solicitante@alpha.cl", "Password123!");
    await page.goto("/dashboard/requests");

    const row = page.getByText(UNIQUE_TITLE);
    await expect(row).toBeVisible({ timeout: 10_000 });

    const verLink = row.locator("..").getByRole("link", { name: /ver/i });
    await verLink.click();
    await page.waitForURL(/\/dashboard\/requests\/[a-f0-9-]+/, { timeout: 10_000 });

    requestId = page.url().split("/").pop() ?? "";

    await page.getByRole("button", { name: /enviar a aprobaci/i }).click();

    await expect(page.getByText(/en jefatura/i)).toBeVisible({ timeout: 10_000 });
  });

  test("jefatura aprueba la solicitud (monto > 500k → pasa a finanzas)", async ({ page }) => {
    await loginAs(page, "jefatura@alpha.cl", "Password123!");

    if (requestId) {
      await page.goto(`/dashboard/requests/${requestId}`);
    } else {
      
      await page.goto("/dashboard/pending");
      await page.getByText(UNIQUE_TITLE).click();
    }
    await page.getByLabel(/acción/i).selectOption("APPROVE");

    await page.getByRole("button", { name: /enviar revisión/i }).click();

    await expect(page.getByText(/en finanzas/i)).toBeVisible({ timeout: 15_000 });
  });

  test("finanzas aprueba la solicitud → estado final APROBADA", async ({ page }) => {
    await loginAs(page, "finanzas@alpha.cl", "Password123!");

    if (requestId) {
      await page.goto(`/dashboard/requests/${requestId}`);
    } else {
      await page.goto("/dashboard/pending");
      await page.getByText(UNIQUE_TITLE).click();
    }

    await page.getByLabel(/acción/i).selectOption("APPROVE");
    await page.getByRole("button", { name: /enviar revisión/i }).click();

    await expect(page.getByText(/aprobada/i)).toBeVisible({ timeout: 15_000 });
  });

  test("jefatura puede acceder al dashboard de indicadores", async ({ page }) => {
    await loginAs(page, "jefatura@alpha.cl", "Password123!");
    await page.goto("/dashboard/indicators");
    await expect(page.getByText(/indicadores/i)).toBeVisible();
    await expect(page.getByText(/monto aprobado/i)).toBeVisible();
    await expect(page.getByText(/solicitudes por estado/i)).toBeVisible();
  });

  test("solicitante es redirigido fuera de indicadores", async ({ page }) => {
    await loginAs(page, "solicitante@alpha.cl", "Password123!");
    await page.goto("/dashboard/indicators");
    await expect(page).toHaveURL(/\/dashboard\/requests/, { timeout: 10_000 });
  });
});

