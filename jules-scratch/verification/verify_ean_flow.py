import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Go to the login page
            await page.goto("http://localhost:3000/login", timeout=60000)

            # Wait for the login form to be visible
            await expect(page.get_by_role("heading", name="Zaloguj się do systemu")).to_be_visible(timeout=15000)

            # Fill in the login form and submit
            await page.locator('input[type="text"]').fill("test")
            await page.locator('input[type="password"]').fill("test")
            await page.get_by_role("button", name="Zaloguj się").click()

            # Wait for navigation to the dashboard and find the "Nowe Zamówienie" link
            await expect(page.get_by_role("heading", name="Panel Główny")).to_be_visible(timeout=10000)

            # Navigate to the new order page
            await page.get_by_role("link", name="Nowe Zamówienie").click()
            await expect(page.get_by_role("heading", name="Nowe Zamówienie")).to_be_visible(timeout=10000)

            # Get the EAN input bar
            ean_input = page.get_by_placeholder("Wyszukaj lub zeskanuj produkt...")

            # --- Test Case 1: Add non-existent product and skip ---
            non_existent_ean_1 = "1112223334445"
            await ean_input.fill(non_existent_ean_1)
            await ean_input.press("Enter")

            # Wait for the modal and click "Pomiń"
            await expect(page.get_by_role("heading", name="Dodaj produkt spoza listy")).to_be_visible(timeout=5000)
            await page.get_by_role("button", name="Pomiń").click()

            # Verify the item was added correctly
            await expect(page.get_by_text("produkt spoza listy")).to_be_visible()
            await expect(page.get_by_text(non_existent_ean_1)).to_be_visible()


            # --- Test Case 2: Add non-existent product and save with custom data ---
            non_existent_ean_2 = "5556667778889"
            await ean_input.fill(non_existent_ean_2)
            await ean_input.press("Enter")

            # Wait for the modal, fill form, and save
            await expect(page.get_by_role("heading", name="Dodaj produkt spoza listy")).to_be_visible(timeout=5000)
            await page.get_by_placeholder("produkt spoza listy").fill("Custom Test Product")
            await page.get_by_placeholder("0.00").fill("9.99")
            await page.get_by_role("button", name="Zapisz").click()

            # Verify the second item was added correctly
            await expect(page.get_by_text("Custom Test Product")).to_be_visible()
            await expect(page.get_by_text("9.99")).to_be_visible()
            await expect(page.get_by_text(non_existent_ean_2)).to_be_visible()

            # Take a screenshot of the final state
            await page.screenshot(path="jules-scratch/verification/verification.png")
            print("Screenshot saved to jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error.png")
        finally:
            await browser.close()

asyncio.run(main())