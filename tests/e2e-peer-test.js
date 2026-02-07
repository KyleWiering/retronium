/**
 * Retronium E2E Peer-to-Peer Test
 *
 * This script runs automated browser tests for P2P connectivity.
 * It can run as either HOST or CLIENT role based on environment variables.
 *
 * Results are output as JSON for AI parsing.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration from environment
const ROLE = process.env.ROLE || 'host';
const APP_URL = process.env.APP_URL || 'http://localhost:8080';
const RESULT_FILE = process.env.RESULT_FILE || '/results/test-result.json';
const HOST_RESULT_FILE = process.env.HOST_RESULT_FILE || '/results/host-result.json';

// Test configuration
const TEST_CONFIG = {
    timeout: 60000,
    waitForConnection: 30000,
    username: ROLE === 'host' ? 'TestHost' : 'TestClient',
    testCard: {
        text: `Test card from ${ROLE} - ${Date.now()}`,
        category: 'good'
    }
};

// Result structure
const result = {
    role: ROLE,
    timestamp: new Date().toISOString(),
    success: false,
    steps: [],
    errors: [],
    connectionInfo: null,
    cardsExchanged: false,
    sessionId: null,
    finalState: null
};

function logStep(step, success, details = {}) {
    const entry = {
        step,
        success,
        timestamp: new Date().toISOString(),
        ...details
    };
    result.steps.push(entry);
    console.log(`[${ROLE}] ${success ? '✓' : '✗'} ${step}`, details);
}

function logError(error, context = '') {
    const entry = {
        context,
        message: error.message || String(error),
        timestamp: new Date().toISOString()
    };
    result.errors.push(entry);
    console.error(`[${ROLE}] ERROR (${context}):`, error.message || error);
}

async function saveResult() {
    try {
        // Ensure directory exists
        const dir = path.dirname(RESULT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(RESULT_FILE, JSON.stringify(result, null, 2));
        console.log(`[${ROLE}] Results saved to ${RESULT_FILE}`);
    } catch (err) {
        console.error(`[${ROLE}] Failed to save results:`, err);
    }
}

async function waitForHostSession() {
    // Client waits for host to create session and save session ID
    console.log(`[${ROLE}] Waiting for host session ID...`);
    const startTime = Date.now();

    while (Date.now() - startTime < TEST_CONFIG.waitForConnection) {
        try {
            if (fs.existsSync(HOST_RESULT_FILE)) {
                const hostResult = JSON.parse(fs.readFileSync(HOST_RESULT_FILE, 'utf8'));
                if (hostResult.sessionId) {
                    console.log(`[${ROLE}] Found host session ID: ${hostResult.sessionId}`);
                    return hostResult.sessionId;
                }
            }
        } catch (err) {
            // File might not be ready yet
        }
        await new Promise(r => setTimeout(r, 1000));
    }

    throw new Error('Timeout waiting for host session ID');
}

async function runHostTest(page) {
    // Step 1: Navigate to app
    await page.goto(APP_URL);
    logStep('Navigate to app', true, { url: APP_URL });

    // Wait for app to load
    await page.waitForSelector('#host-btn', { timeout: 10000 });
    logStep('App loaded', true);

    // Step 2: Set username via prompt dialog
    page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
            await dialog.accept(TEST_CONFIG.username);
        } else {
            await dialog.accept();
        }
    });

    // Step 3: Click host button
    await page.click('#host-btn');
    logStep('Clicked host button', true);

    // Step 4: Wait for session ID to appear
    await page.waitForSelector('#session-id', { timeout: 15000 });
    await page.waitForFunction(() => {
        const input = document.getElementById('session-id');
        return input && input.value && input.value.length > 0;
    }, { timeout: 15000 });

    const sessionId = await page.$eval('#session-id', el => el.value);
    result.sessionId = sessionId;
    logStep('Session created', true, { sessionId });

    // Save intermediate result so client can read session ID
    await saveResult();

    // Step 5: Wait for client to connect
    console.log(`[${ROLE}] Waiting for client to connect...`);
    await page.waitForFunction(() => {
        const list = document.getElementById('participants-list');
        return list && list.children.length >= 2;
    }, { timeout: TEST_CONFIG.waitForConnection });
    logStep('Client connected', true);

    // Step 6: Add a test card
    await page.fill('#card-text', TEST_CONFIG.testCard.text);
    await page.selectOption('#card-category', TEST_CONFIG.testCard.category);
    await page.click('#add-card-btn');
    logStep('Added test card', true, { card: TEST_CONFIG.testCard });

    // Step 7: Wait for cards to sync (give time for bidirectional sync)
    await page.waitForTimeout(3000);

    // Step 8: Check for client's card
    const cards = await page.$$eval('.card', cards =>
        cards.map(c => c.textContent)
    );
    const hasClientCard = cards >= 2;
    result.cardsExchanged = hasClientCard;
    logStep('Card sync check', hasClientCard, {
        expectedCards: 2, actualCards: cards, note: 'Phase 1: Cards are encrypted/blurred for non-authors'
        
    });

    // Step 9: Capture final state
    result.connectionInfo = await page.evaluate(() => {
        const statusText = document.getElementById('status-text')?.textContent;
        const participants = Array.from(document.querySelectorAll('#participants-list li'))
            .map(li => li.textContent);
        return { statusText, participants };
    });
    logStep('Captured final state', true, result.connectionInfo);

    // Get debug info if available
    try {
        await page.click('#settings-btn');
        await page.waitForTimeout(500);
        await page.click('#debug-btn');
        await page.waitForTimeout(1000);

        const debugInfo = await page.$eval('#debug-connection-info', el => el.textContent);
        const networkDump = await page.$eval('#debug-network-dump', el => el.textContent);
        result.finalState = { debugInfo, networkDump };
    } catch (err) {
        // Debug modal might not be accessible
    }

    result.success = result.cardsExchanged;
}

async function runClientTest(page) {
    // Step 1: Wait for host session ID
    const sessionId = await waitForHostSession();
    result.sessionId = sessionId;
    logStep('Got host session ID', true, { sessionId });

    // Step 2: Navigate to app
    await page.goto(APP_URL);
    logStep('Navigate to app', true, { url: APP_URL });

    // Wait for app to load
    await page.waitForSelector('#join-btn', { timeout: 10000 });
    logStep('App loaded', true);

    // Step 3: Set username via prompt dialog
    page.on('dialog', async dialog => {
        if (dialog.type() === 'prompt') {
            await dialog.accept(TEST_CONFIG.username);
        } else {
            await dialog.accept();
        }
    });

    // Step 4: Enter session ID and join
    await page.fill('#peer-id-input', sessionId);
    await page.click('#join-btn');
    logStep('Clicked join button', true, { sessionId });

    // Step 5: Wait for connection
    await page.waitForFunction(() => {
        const statusText = document.getElementById('status-text');
        return statusText && statusText.textContent.includes('Connected');
    }, { timeout: TEST_CONFIG.waitForConnection });
    logStep('Connected to host', true);

    // Step 6: Wait for participants list to show both users
    await page.waitForFunction(() => {
        const list = document.getElementById('participants-list');
        return list && list.children.length >= 2;
    }, { timeout: 10000 });
    logStep('Participants synced', true);

    // Step 7: Add a test card
    await page.fill('#card-text', TEST_CONFIG.testCard.text);
    await page.selectOption('#card-category', TEST_CONFIG.testCard.category);
    await page.click('#add-card-btn');
    logStep('Added test card', true, { card: TEST_CONFIG.testCard });

    // Step 8: Wait for cards to sync
    await page.waitForTimeout(3000);

    // Step 9: Check for host's card
    const cards = await page.$$eval('.card', cards =>
        cards.map(c => c.textContent)
    );
    const hasHostCard = cards >= 2;
    result.cardsExchanged = hasHostCard;
    logStep('Card sync check', hasHostCard, {
        expectedCards: 2, actualCards: cards, note: 'Phase 1: Cards are encrypted/blurred for non-authors'
        
    });

    // Step 10: Capture final state
    result.connectionInfo = await page.evaluate(() => {
        const statusText = document.getElementById('status-text')?.textContent;
        const participants = Array.from(document.querySelectorAll('#participants-list li'))
            .map(li => li.textContent);
        return { statusText, participants };
    });
    logStep('Captured final state', true, result.connectionInfo);

    // Get debug info if available
    try {
        await page.click('#settings-btn');
        await page.waitForTimeout(500);
        await page.click('#debug-btn');
        await page.waitForTimeout(1000);

        const debugInfo = await page.$eval('#debug-connection-info', el => el.textContent);
        const networkDump = await page.$eval('#debug-network-dump', el => el.textContent);
        result.finalState = { debugInfo, networkDump };
    } catch (err) {
        // Debug modal might not be accessible
    }

    result.success = result.cardsExchanged;
}

async function main() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`[${ROLE}] Starting Retronium E2E Test`);
    console.log(`[${ROLE}] App URL: ${APP_URL}`);
    console.log(`[${ROLE}] Result File: ${RESULT_FILE}`);
    console.log(`${'='.repeat(60)}\n`);

    let browser = null;

    try {
        // Launch browser with WebRTC enabled
        browser = await chromium.launch({
            headless: true,
            args: [
                '--use-fake-ui-for-media-stream',
                '--use-fake-device-for-media-stream',
                '--allow-running-insecure-content',
                '--disable-web-security',
                '--no-sandbox'
            ]
        });

        const context = await browser.newContext({
            permissions: ['microphone', 'camera'],
            ignoreHTTPSErrors: true
        });

        const page = await context.newPage();

        // Log console messages from the page
        page.on('console', msg => {
            console.log(`[${ROLE}] PAGE:`, msg.text());
        });

        page.on('pageerror', err => {
            logError(err, 'page error');
        });

        // Run the appropriate test based on role
        if (ROLE === 'host') {
            await runHostTest(page);
        } else {
            await runClientTest(page);
        }

    } catch (err) {
        logError(err, 'main');
        result.success = false;
    } finally {
        await saveResult();

        if (browser) {
            await browser.close();
        }

        console.log(`\n${'='.repeat(60)}`);
        console.log(`[${ROLE}] Test ${result.success ? 'PASSED' : 'FAILED'}`);
        console.log(`[${ROLE}] Steps completed: ${result.steps.length}`);
        console.log(`[${ROLE}] Errors: ${result.errors.length}`);
        console.log(`${'='.repeat(60)}\n`);

        // Exit with appropriate code
        process.exit(result.success ? 0 : 1);
    }
}

main();

 
