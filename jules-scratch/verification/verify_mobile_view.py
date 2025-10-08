import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        # Define a mobile viewport
        pixel_4 = p.devices['Pixel 4a (5G)']
        context = await browser.new_context(
            **pixel_4,
        )
        page = await context.new_page()

        try:
            # 1. Log in
            await page.goto("http://localhost:3000/login")
            await page.get_by_label("Nazwa użytkownika").fill("testuser")
            await page.get_by_label("Hasło").fill("password")
            await page.get_by_role("button", name="Zaloguj się").click()

            # Wait for dashboard to load
            await expect(page.get_by_role("heading", name="Panel Główny")).to_be_visible()

            # 2. Verify Orders List View
            await page.get_by_role("button", name="Menu").click()
            await page.get_by_role("link", name="Zamówienia").click()
            await expect(page.get_by_role("heading", name="Zamówienia")).to_be_visible()
            # Wait for some order cards to be visible
            await page.wait_for_selector('.lg\\:hidden .font-bold.text-lg.text-indigo-600')
            await page.screenshot(path="jules-scratch/verification/01_orders_list_mobile.png")
            print("Screenshot of orders list created.")

            # 3. Verify New Order View
            await page.get_by_role("button", name="Menu").click()
            await page.get_by_role("link", name="Nowe Zamówienie").click()
            await expect(page.get_by_role("heading", name="Nowe Zamówienie")).to_be_visible()

            # Add a product to show the card layout
            await page.get_by_placeholder("Wyszukaj lub zeskanuj produkt...").fill("test")
            # Wait for suggestions and click the first one
            await page.wait_for_selector('ul > li')
            await page.locator('ul > li').first.click()

            await expect(page.get_by_text("Ilość:")).to_be_visible()
            await page.screenshot(path="jules-scratch/verification/02_new_order_mobile.png")
            print("Screenshot of new order view created.")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error.png")

        finally:
            await browser.close()

asyncio.run(main())