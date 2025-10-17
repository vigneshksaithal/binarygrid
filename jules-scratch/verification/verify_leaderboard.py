import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    def mock_leaderboard_api(route):
        route.fulfill(json={
            "scores": [
                {"member": "Player1", "score": 10},
                {"member": "Player2", "score": 20},
                {"member": "Player3", "score": 30},
                {"member": "Player4", "score": 40},
                {"member": "Player5", "score": 50},
                {"member": "Player6", "score": 60},
                {"member": "Player7", "score": 70},
                {"member": "Player8", "score": 80},
                {"member": "Player9", "score": 90},
                {"member": "Player10", "score": 100}
            ],
            "nextCursor": 10
        })

    page.route("**/api/leaderboard**", mock_leaderboard_api)

    page.goto("http://localhost:5173")

    # Wait for the stores to be available
    page.wait_for_function("window.stores")

    # Manually trigger the solved state and open the success modal
    page.evaluate("""() => {
        const { game, ui } = window.stores;
        game.update(s => ({...s, status: 'solved'}));
        ui.openSuccessModal();
    }""")

    # Wait for the success modal to be visible
    expect(page.get_by_role("dialog")).to_be_visible()

    # Take a screenshot of the success modal
    page.screenshot(path="jules-scratch/verification/leaderboard.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)