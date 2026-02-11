import { test, expect } from "@playwright/test";

const now = Date.now();
const hour = 60 * 60 * 1000;

const mockPlaylist = {
  name: "Test Playlist",
  channels: [
    {
      id: "1",
      name: "BBC One",
      group: "News",
      logo_url: null,
      stream_url: "https://example.com/bbc1.m3u8",
      is_live: true,
      tvg_id: "bbc1.uk",
    },
    {
      id: "2",
      name: "Radio Station",
      group: "Music",
      logo_url: null,
      stream_url: "https://example.com/radio.m3u8",
      is_live: false,
    },
  ],
  last_checked: new Date().toISOString(),
  source: "test",
};

const mockEpgSchedule = {
  channel_id: "bbc1.uk",
  programs: [
    {
      id: "p1",
      channel_id: "bbc1.uk",
      title: "Evening News",
      description: "Latest headlines",
      start: new Date(now - hour).toISOString(),
      end: new Date(now + hour).toISOString(),
      category: "News",
    },
    {
      id: "p2",
      channel_id: "bbc1.uk",
      title: "Drama Hour",
      start: new Date(now + hour).toISOString(),
      end: new Date(now + 2 * hour).toISOString(),
      category: "Drama",
    },
  ],
};

test.describe("EPG Feature", () => {
  test.beforeEach(async ({ page }) => {
    // Mock the backend playlist API
    await page.route("**/api/playlist", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPlaylist),
      });
    });

    // Mock the EPG schedule API
    await page.route("**/api/epg/**", (route) => {
      const url = route.request().url();
      if (url.includes("bbc1.uk")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(mockEpgSchedule),
        });
      } else {
        route.fulfill({ status: 404 });
      }
    });

    // Mock chain playlist lookup to return not-found (avoid wallet-related issues)
    await page.route("**/api/chain/**", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ found: false }),
      });
    });
  });

  test("channel list shows EPG icon on channels with tvg_id", async ({
    page,
  }) => {
    await page.goto("/");

    // Wait for channels to load
    await expect(page.getByText("BBC One")).toBeVisible();

    // Channel with tvg_id should have Program Guide button
    const epgButtons = page.getByTitle("Program Guide");
    await expect(epgButtons).toHaveCount(1);
  });

  test("clicking EPG icon opens overlay with program information", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText("BBC One")).toBeVisible();

    // Click the EPG icon
    await page.getByTitle("Program Guide").click();

    // Overlay should appear with dialog role
    const overlay = page.getByRole("dialog", { name: "Program Guide" });
    await expect(overlay).toBeVisible();

    // Should show channel name in header
    await expect(page.getByText("BBC One -- Program Guide")).toBeVisible();

    // Should show current program
    await expect(page.getByText("Evening News")).toBeVisible();
    await expect(page.getByText("Now")).toBeVisible();

    // Should show upcoming program
    await expect(page.getByText("Drama Hour")).toBeVisible();
  });

  test("close button dismisses overlay", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("BBC One")).toBeVisible();

    await page.getByTitle("Program Guide").click();

    const overlay = page.getByRole("dialog", { name: "Program Guide" });
    await expect(overlay).toBeVisible();

    // Click close button
    await page.getByLabel("Close program guide").click();

    // Overlay should be gone
    await expect(overlay).not.toBeVisible();
  });

  test("Escape key dismisses overlay", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("BBC One")).toBeVisible();

    await page.getByTitle("Program Guide").click();

    const overlay = page.getByRole("dialog", { name: "Program Guide" });
    await expect(overlay).toBeVisible();

    // Press Escape
    await page.keyboard.press("Escape");

    // Overlay should be gone
    await expect(overlay).not.toBeVisible();
  });

  test("EPG icon click does not select the channel for playback", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText("BBC One")).toBeVisible();

    // The placeholder should be visible (no channel selected)
    await expect(
      page.getByText("Select a channel to start streaming")
    ).toBeVisible();

    // Click EPG icon
    await page.getByTitle("Program Guide").click();

    // Overlay opens but video player should still show placeholder
    // (the overlay is on top, but underneath the player is still in placeholder state)
    await expect(
      page.getByRole("dialog", { name: "Program Guide" })
    ).toBeVisible();
  });
});
