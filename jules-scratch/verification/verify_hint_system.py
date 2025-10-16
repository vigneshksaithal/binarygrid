from playwright.sync_api import sync_playwright, expect
import json

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        page.on("console", lambda msg: print(f"PAGE LOG: {msg.text}"))

        # Mock the API response
        mock_puzzle = {
            "puzzle": {
                "id": "test-puzzle",
                "size": 6,
                "difficulty": "easy",
                "initial": [
                    [None, 1, 0, None, 1, 0],
                    [None, None, 1, 0, None, None],
                    [0, 1, None, None, 1, 0],
                    [1, 0, None, None, 0, 1],
                    [None, None, 0, 1, None, None],
                    [1, 0, 1, None, 0, None]
                ],
                "solution": [
                    [0, 1, 0, 1, 1, 0],
                    [0, 1, 1, 0, 0, 1],
                    [0, 1, 0, 1, 1, 0],
                    [1, 0, 1, 0, 0, 1],
                    [1, 0, 0, 1, 1, 0],
                    [1, 0, 1, 0, 0, 1]
                ],
                "fixed": []
            }
        }

        def handle_route(route):
            print(f"Intercepted request to {route.request.url}")
            route.fulfill(
                status=200,
                content_type="application/json",
                body=json.dumps(mock_puzzle),
            )

        page.route("**/api/puzzle**", handle_route)

        page.goto("http://127.0.0.1:5173")

        # Wait for the grid to be loaded
        expect(page.locator('.cell')).to_have_count(36)

        # Take a screenshot before clicking the hint button
        page.screenshot(path="jules-scratch/verification/before_hint.png")

        # Click the hint button
        hint_button = page.get_by_role("button", name="Hint")
        hint_button.click()

        # Wait for the hint to be applied
        page.wait_for_timeout(500)

        # Take a screenshot after clicking the hint button
        page.screenshot(path="jules-scratch/verification/after_hint.png")

        browser.close()

if __name__ == "__main__":
    run_verification()