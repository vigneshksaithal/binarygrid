from playwright.sync_api import sync_playwright, expect

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for console messages
        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

        page.goto("http://localhost:5173")

        # Wait for the loader to be visible, with a longer timeout
        loader = page.locator('[aria-label="Loading"]')
        try:
            expect(loader).to_be_visible(timeout=10000)
            # Give the animation some time to run
            page.wait_for_timeout(1000)
            page.screenshot(path="jules-scratch/verification/verification.png")
        except Exception as e:
            print(f"Loader not found or other error: {e}")
            # If loader is not found, maybe the page is already loaded.
            # Let's take a screenshot anyway to see what's there.
            page.screenshot(path="jules-scratch/verification/verification-error.png")

        browser.close()

if __name__ == "__main__":
    run()