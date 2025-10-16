import re
from playwright.sync_api import sync_playwright, Page, expect

def run_test(page: Page):
    """
    This test verifies that the OrderView component scrolls down only when a new
    item is added, not when an existing item's quantity is changed.
    """
    # 1. Arrange: Go to the application and log in.
    page.goto("http://localhost:3000/")

    # Log in using more robust selectors
    page.locator('input[type="text"]').first.fill("testuser")
    page.locator('input[type="password"]').first.fill("password")
    page.get_by_role("button", name="Zaloguj się").click()

    # Wait for navigation and click "Nowe Zamówienie"
    page.get_by_text("Nowe Zamówienie").click()

    # Now we should be in the order view, wait for the main input bar to be visible
    expect(page.get_by_placeholder("Wpisz kod EAN lub nazwę produktu")).to_be_visible(timeout=15000)

    # Helper function to get scroll position
    def get_scroll_y():
        scrollable_element = page.locator('div.flex-grow.p-4')
        if scrollable_element.is_visible():
            return scrollable_element.evaluate("el => el.scrollTop")
        return page.evaluate("() => window.scrollY")

    # 2. Act & Assert: Add products and check scroll behavior

    page.get_by_placeholder("Wprowadź nazwę klienta").fill("Klient Testowy")
    page.wait_for_timeout(500)

    # Add first product
    page.get_by_placeholder("Wpisz kod EAN lub nazwę produktu").fill("Produkt 1")
    page.get_by_role("button", name="Dodaj").click()
    page.wait_for_timeout(1000)

    scroll_after_add1 = get_scroll_y()

    # Add second product
    page.get_by_placeholder("Wpisz kod EAN lub nazwę produktu").fill("Produkt 2")
    page.get_by_role("button", name="Dodaj").click()
    page.wait_for_timeout(1000)

    scroll_after_add2 = get_scroll_y()
    assert scroll_after_add2 > scroll_after_add1, f"Scroll should have increased. Before: {scroll_after_add1}, After: {scroll_after_add2}"

    # Change quantity of the first product
    page.locator('input[type="number"]').first.fill("10")
    page.wait_for_timeout(1000)

    scroll_after_quantity_change = get_scroll_y()
    assert abs(scroll_after_quantity_change - scroll_after_add2) < 10, f"Scroll should not have changed significantly. Before: {scroll_after_add2}, After: {scroll_after_quantity_change}"

    # Add a third product to confirm scrolling still works
    page.get_by_placeholder("Wpisz kod EAN lub nazwę produktu").fill("Produkt 3")
    page.get_by_role("button", name="Dodaj").click()
    page.wait_for_timeout(1000)

    scroll_after_add3 = get_scroll_y()
    assert scroll_after_add3 > scroll_after_quantity_change, f"Scroll should have increased after adding a third item. Before: {scroll_after_quantity_change}, After: {scroll_after_add3}"

    # 5. Screenshot: Capture the final state
    page.screenshot(path="jules-scratch/verification/verification.png")
    print("Screenshot saved to jules-scratch/verification/verification.png")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            run_test(page)
        finally:
            browser.close()

if __name__ == "__main__":
    main()