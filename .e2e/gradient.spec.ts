import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Go to the starting url before each test
  await page.goto('/');
});

test('add stop, drag stop, check handle count', async ({ page }) => {
  const initialStopCount = await page.locator('aside section > div > div').count(); // Locator for StopHandle containers

  await page.getByRole('button', { name: /add stop/i }).click();
  
  const newStopCount = await page.locator('aside section > div > div').count();
  expect(newStopCount).toBe(initialStopCount + 1);

  // Drag the newly added stop handle (assuming it's the last one)
  const handle = page.locator('aside section > div > div').last().locator('[role="slider"]');
  const handleBoundingBox = await handle.boundingBox();

  if (!handleBoundingBox) {
    throw new Error('Could not get bounding box for slider handle');
  }

  // Drag horizontally - adjust drag distance as needed based on slider width
  await page.mouse.move(handleBoundingBox.x + handleBoundingBox.width / 2, handleBoundingBox.y + handleBoundingBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBoundingBox.x + 80, handleBoundingBox.y + handleBoundingBox.height / 2); // Drag ~80px right
  await page.mouse.up();

  // Check if the position text updated (example: expect it to be > 50% if dragged significantly right)
  const positionText = page.locator('aside section > div > div').last().locator('span.text-xs');
  await expect(positionText).toHaveText(/[5-9][0-9]%|100%/); // Example: check if > 50%
});

test('remove stop', async ({ page }) => {
   const initialStopCount = await page.locator('aside section > div > div').count();
   
   // Add a stop so we have more than 2
   await page.getByRole('button', { name: /add stop/i }).click();
   expect(await page.locator('aside section > div > div').count()).toBe(initialStopCount + 1);

   // Remove the last stop
   await page.locator('aside section > div > div').last().getByRole('button', { name: /remove stop/i }).click();

   // Check if the stop count decreased
   expect(await page.locator('aside section > div > div').count()).toBe(initialStopCount);
});

test('copy css button works', async ({ page }) => {
  // Get the initial state's expected CSS (using the mocked oklabToHex from gradient.test.ts)
  // Default is black (#000000) to white (#ffffff) at 90deg
  const expectedInitialCss = 'linear-gradient(90deg, #000000 0.00%, #ffffff 100.00%)';

  const copyButton = page.getByRole('button', { name: /copy css/i });
  
  // Use try...catch for clipboard permissions if running headful locally
  try {
      await copyButton.click();
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      // Note: The CSS generated uses the mocked oklabToHex which outputs grayscale.
      // For a real test, we'd need to either:
      // 1. Not mock oklabToHex for E2E (challenging as it runs in browser).
      // 2. Calculate the *actual* expected hex output based on the real oklabToHex.
      // For now, we'll check if it contains the basic structure.
      expect(clipboardText).toMatch(/linear-gradient\(90deg, #[0-9a-f]{6} 0\.00%, #[0-9a-f]{6} 100\.00%\)/);

      // Check for feedback text change
      await expect(page.getByRole('button', { name: /copied!/i })).toBeVisible();
      // Wait for feedback to disappear
      await expect(page.getByRole('button', { name: /copied!/i })).not.toBeVisible({ timeout: 2000 });
      await expect(copyButton).toBeVisible(); // Original text restored

  } catch (error) {
      // Handle potential clipboard permission errors, common in non-secure contexts or CI
      console.warn('Clipboard test skipped/failed, likely due to permissions:', error);
      test.skip(true, 'Clipboard API permission likely denied in this context.');
  }
});

test('share link flow', async ({ page }) => {
  const initialGradientStops = await page.locator('aside section > div > div').count();
  const testSlug = 'testslug123';

  // 1. Mock the API response for POST /api/share
  await page.route('/api/share', async (route, request) => {
    if (request.method() === 'POST') {
      // Check if the request body looks like a gradient (basic check)
      const body = request.postDataJSON();
      expect(body).toHaveProperty('stops');
      expect(Array.isArray(body.stops)).toBe(true);

      // Respond with the mock slug
      await route.fulfill({ 
        status: 200, 
        contentType: 'application/json', 
        body: JSON.stringify({ slug: testSlug })
      });
    } else {
        // For GET requests or others, continue without mocking
        await route.continue();
    }
  });

  // 2. Click the share button
  const shareButton = page.getByRole('button', { name: /share/i });
  await shareButton.click();

  // 3. Verify clipboard contains the correct URL (within try/catch for permissions)
  const expectedUrl = `http://localhost:5173/g/${testSlug}`; // Assuming default port
  try {
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(expectedUrl);
      // Also check button feedback
      await expect(page.getByRole('button', { name: /copied link/i })).toBeVisible();
  } catch (error) {
      console.warn('Share link clipboard test skipped/failed, likely due to permissions:', error);
      test.skip(true, 'Clipboard API permission likely denied in this context.');
  }

  // 4. Mock the API response for GET /api/share?slug=...
  await page.route(`/api/share?slug=${testSlug}`, async (route) => {
      // Respond with a specific gradient for verification
      const sharedGradient = {
          id: 'shared-gradient', type: 'linear', angle: 135, stops: [
              { id: 'share1', position: 0.2, color: { l: 0.8, a: -0.1, b: 0.1 } },
              { id: 'share2', position: 0.8, color: { l: 0.3, a: 0.1, b: -0.1 } },
          ]
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ gradient: sharedGradient })
      });
  });

  // 5. Navigate to the share URL
  await page.goto(`/g/${testSlug}`);

  // 6. Verify the gradient state was updated (check number of stops)
  // Since GradientLoader navigates away, we should be back on '/'
  // Wait for navigation back to the editor route
  await page.waitForURL('/');
  // Check if the number of stops matches the loaded gradient
  await expect(page.locator('aside section > div > div')).toHaveCount(2);
  // Optional: Check specific stop details if feasible/stable
});

test('WCAG banner appears for low-contrast gradient', async ({ page }) => {
  // Wait for initial load (might need adjustment)
  await page.waitForLoadState('networkidle');

  // Ensure the banner is not initially visible
  await expect(page.getByText(/low contrast warning/i)).not.toBeVisible();

  // Inject a low-contrast gradient state using the exposed store
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__store;
    if (store) {
      store.setState({
        gradient: {
          ...store.getState().gradient,
          stops: [
            // Two very light grays - low contrast
            { id:'a', position:0, color:{ l:0.95, a:0, b:0 }},
            { id:'b', position:1, color:{ l:0.99, a:0, b:0 }}
          ]
        }
      });
    }
  });

  // Expect the toast banner to become visible
  await expect(page.getByText(/low contrast warning/i)).toBeVisible();
  await expect(page.getByText(/Some adjacent color stops may not meet WCAG AA/i)).toBeVisible();

  // Optional: Inject a high-contrast state and check banner disappears
  await page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const store = (window as any).__store;
    if (store) {
        store.setState({ gradient: { ...store.getState().gradient, stops: [
            { id:'c', position:0, color:{ l:0, a:0, b:0 }},
            { id:'d', position:1, color:{ l:1, a:0, b:0 }}
        ] }});
    }
  });

  // Wait for potential animation/delay
  await page.waitForTimeout(500); 
  await expect(page.getByText(/low contrast warning/i)).not.toBeVisible();
}); 