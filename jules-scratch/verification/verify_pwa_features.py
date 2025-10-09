import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(ignore_https_errors=True) # Ignore HTTPS errors for localhost
    page = context.new_page()

    try:
        # Step 1: Navigate to the login page
        page.goto("http://localhost:8000/login", timeout=60000)

        # Expect the login form to be visible
        expect(page.get_by_role("heading", name="Zaloguj się do systemu")).to_be_visible(timeout=10000)

        # Step 2: Fill in and submit the login form
        # Based on registration logic, first user is admin. Let's assume common credentials.
        page.get_by_label("Nazwa użytkownika").fill("admin")
        page.get_by_label("Hasło").fill("password")
        page.get_by_role("button", name="Zaloguj się").click()

        # Handle potential login errors by trying another common password
        try:
            expect(page.get_by_role("heading", name="Panel Główny")).to_be_visible(timeout=5000)
            print("Login successful with 'admin'/'password'.")
        except Exception:
            print("Login with 'password' failed. Trying 'admin'...")
            page.get_by_label("Hasło").fill("admin")
            page.get_by_role("button", name="Zaloguj się").click()
            # Final check for successful login
            expect(page.get_by_role("heading", name="Panel Główny")).to_be_visible(timeout=10000)
            print("Login successful with 'admin'/'admin'.")


        # Step 3: Navigate to the main admin page
        # The sidebar might take a moment to become fully available
        admin_link = page.get_by_role("link", name="Panel Admina")
        expect(admin_link).to_be_visible(timeout=5000)
        admin_link.click()
        expect(page.get_by_role("heading", name="Panel Administratora")).to_be_visible()

        # Step 4: Verify the new "Notifications" tile and navigate
        notifications_tile = page.get_by_role("heading", name="Zgody na Powiadomienia")
        expect(notifications_tile).to_be_visible()

        # Click the tile to navigate to the notifications management page
        page.locator('div', has_text='Zgody na Powiadomienia').click()

        # Step 5: Verify the content of the notifications management page
        expect(page.get_by_role("heading", name="Zarządzanie Zgodami na Powiadomienia Push")).to_be_visible(timeout=5000)

        # Check for at least one user in the list
        expect(page.locator('.bg-white.dark\\:bg-gray-800.rounded-lg.shadow .font-medium').first).to_be_visible()

        # Take the final screenshot
        page.screenshot(path="jules-scratch/verification/admin_notifications_view.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        # Save a screenshot on failure for debugging
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)