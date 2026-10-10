const { app, BrowserWindow, screen, ipcMain, powerSaveBlocker, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// === CONFIGURATION ===
const SRC_DIR = 'src_v2';
console.log(`[cueTime] Launching UI from: ${SRC_DIR}`);

const USER_DATA_PATH = app.getPath('userData');
const STATE_FILE = path.join(USER_DATA_PATH, 'session-state.json');
const ANALYTICS_FILE = path.join(USER_DATA_PATH, 'analytics-state.json');

let dashboardWindow = null;
let viewerWindow = null;
let splashWindow = null;
let viewerRetryCount = 0;
const MAX_RETRIES = 5;
// TEST MODE: Set date to yesterday to trigger expiry
// const yesterday = new Date();
// yesterday.setDate(yesterday.getDate() - 1);
// const EXPIRY_DATE = yesterday;
const EXPIRY_DATE = new Date('2027-01-01T23:59:59'); // Hardcoded Expiry
const WARNING_DAYS = 5;

// Expiration Check Helper
function checkExpiry() {
    const now = new Date();
    const timeDiff = EXPIRY_DATE - now;
    const daysLeft = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

    console.log(`[Main] Beta Expiry Check: ${daysLeft} days remaining`);

    if (daysLeft <= 0) {
        return 'expired';
    }
    if (daysLeft <= WARNING_DAYS) {
        return { status: 'warning', days: daysLeft, date: EXPIRY_DATE.toLocaleDateString() };
    }
    return { status: 'valid', days: daysLeft, date: EXPIRY_DATE.toLocaleDateString() };
}

// Prevent sleep
const powerSaveBlockerId = powerSaveBlocker.start('prevent-display-sleep');

function createSplash() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 320,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        backgroundColor: '#00000000',
        resizable: false,
        webPreferences: {
            nodeIntegration: true, // For simple shell usage in splash
            contextIsolation: false
        },
        title: 'cueTime',
        icon: path.join(__dirname, 'icon.png')
    });

    splashWindow.loadFile(path.join(__dirname, 'src_v2', 'splash', 'index.html'));

    // Auto-close splash and launch dashboard after 3 seconds
    setTimeout(() => {
        createDashboard();
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }
        splashWindow = null;
    }, 3000);
}

function createDashboard() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;

    const initWidth = Math.min(900, width);
    const initHeight = Math.min(1000, height);

    dashboardWindow = new BrowserWindow({
        width: initWidth,
        height: initHeight,
        minWidth: 600,
        minHeight: 700,
        x: Math.max(primaryDisplay.bounds.x, primaryDisplay.bounds.x + Math.floor((width - initWidth) / 2)),
        y: Math.max(primaryDisplay.bounds.y, primaryDisplay.bounds.y + Math.floor((height - initHeight) / 2)),
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        title: `cueTime - Dashboard`,
        autoHideMenuBar: true,
        show: false,
        icon: path.join(__dirname, 'icon.png')
    });

    const expiryStatus = checkExpiry();

    if (expiryStatus === 'expired') {
        dashboardWindow.loadFile(path.join(__dirname, SRC_DIR, 'expired', 'index.html'));
    } else {
        dashboardWindow.loadFile(path.join(__dirname, SRC_DIR, 'dashboard', 'index.html'));

        // Send status on every load (fix reload bug)
        dashboardWindow.webContents.on('did-finish-load', () => {
            dashboardWindow.webContents.send('beta-status', expiryStatus);

            // Handle Auto-Launch for Secondary Display
            if (global.autoLaunchViewer) {
                console.log('[Main] Dashboard loaded. Executing queued Viewer launch...');
                const displays = screen.getAllDisplays();
                if (displays.length > 1 && !viewerWindow) {
                    createViewer(displays[1].id);
                }
                global.autoLaunchViewer = false; // Reset flag
            }
        });
    }

    dashboardWindow.once('ready-to-show', () => {
        dashboardWindow.show();
    });

    // ROBUST CLOSE HANDLING
    dashboardWindow.on('close', async (e) => {
        // Check if we should warn (need to ask Renderer if running, or just check shared state if we had it).
        // Since strict Main/Renderer isolation, asking renderer is best.
        // But to be "Enforced", we can use a simpler approach if we don't want IPC race conditions:
        // Just always confirm if the user tries to close? No, annoying.

        // Better: We send a synchronous IPC check or we just use the renderer's logic but ensure it works.
        // Actually, the previous 'onbeforeunload' in renderer failed because 'confirm' UI can be blocked.
        // Let's use `dialog.showMessageBox` trigger from the Renderer?
        // NO, user said "windows x button doesnt seem to close". 
        // This implies the previous logic `e.returnValue = false` worked TOO well (prevented close) but didn't show the prompt?
        // Or the prompt blocked.

        // Let's rely on the Renderer sending an IPC "can-i-close" message? No, 'close' event happens first.

        // STRATEGY: 
        // 1. Let `close` proceed normally.
        // 2. In Renderer `onbeforeunload`, use `ipcRenderer.invoke('confirm-close')` (SYNC/Blocking if possible, or preventDefault -> Async -> Close).
        // The standard customized pattern:
        /*
           window.onbeforeunload = (e) => {
               e.returnValue = false; // Cancel close immediately
               window.electronAPI.confirmExit().then(shouldClose => {
                   if (shouldClose) window.electronAPI.forceClose();
               });
           }
        */
        // But wait, `main.js` handles the force close.

        // Let's implement the `close` handler HERE to send a message to renderer?
        // Let's try the `e.preventDefault()` in Main Process approach.
        /*
        if (!app.isQuiting) {
            e.preventDefault();
            dashboardWindow.webContents.send('app-closing');
        }
        */
    });

    dashboardWindow.on('closed', () => {
        dashboardWindow = null;
        if (viewerWindow) {
            viewerWindow.close();
        }
        app.quit();
    });
}

function createViewer(displayId = null) {
    // If viewer exists, close it first so we can move it/re-create on new display
    if (viewerWindow && !viewerWindow.isDestroyed()) {
        // CRITICAL: Remove listeners to prevent 'closed' handler from nulling the NEW viewerWindow
        viewerWindow.removeAllListeners('closed');
        viewerWindow.removeAllListeners('render-process-gone');
        viewerWindow.close();
        viewerWindow = null;
    }

    const displays = screen.getAllDisplays();
    console.log(`[Main] createViewer: Requested ID: ${displayId} (Type: ${typeof displayId})`);
    console.log(`[Main] Available Displays: ${displays.map(d => `${d.id} (${d.bounds.x},${d.bounds.y})`).join(', ')}`);

    let targetDisplay;

    if (displayId) {
        targetDisplay = displays.find(d => d.id == displayId);
    }

    if (!targetDisplay) {
        // Prefer secondary display, fallback to primary if only 1 exists
        const externalDisplay = displays.find((display) => display.bounds.x !== 0 || display.bounds.y !== 0);
        targetDisplay = externalDisplay || screen.getPrimaryDisplay();
    }

    viewerWindow = new BrowserWindow({
        x: targetDisplay.bounds.x,
        y: targetDisplay.bounds.y,
        width: 800,
        height: 600, // Will be maximized/fullscreen
        fullscreen: true,
        frame: false,
        skipTaskbar: true,
        alwaysOnTop: true, // Ensure it stays on top of notifications
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: '#000000',
        title: 'cueTime - Viewer',
        icon: path.join(__dirname, 'icon.png')
    });

    viewerWindow.loadFile(path.join(__dirname, SRC_DIR, 'viewer', 'index.html'));

    // Viewer Silent Recovery
    viewerWindow.webContents.on('render-process-gone', (event, details) => {
        console.log('Viewer render process gone:', details.reason);
        viewerWindow = null;
        if (viewerRetryCount < MAX_RETRIES) {
            viewerRetryCount++;
            // Silent relaunch
            setTimeout(() => {
                createViewer();
                // Re-send current state from Dashboard to new Viewer
                if (dashboardWindow) {
                    dashboardWindow.webContents.send('request-state-sync');
                }
            }, 500);
        }
    });

    // Immediate State Sync Request upon load
    viewerWindow.webContents.once('did-finish-load', () => {
        if (dashboardWindow) {
            dashboardWindow.webContents.send('request-state-sync');
        }
    });

    viewerWindow.on('closed', () => {
        viewerWindow = null;
    });
}

// IPC Handlers
ipcMain.handle('get-screens', () => {
    return screen.getAllDisplays().map(d => ({
        id: d.id,
        label: d.label,
        bounds: d.bounds
    }));
});

ipcMain.on('update-timer', (event, data) => {
    if (viewerWindow && !viewerWindow.isDestroyed()) {
        viewerWindow.webContents.send('update-timer', data);
    }
});

ipcMain.on('broadcast-warning', (event, data) => {
    if (viewerWindow && !viewerWindow.isDestroyed()) {
        viewerWindow.webContents.send('update-warning', data);
    }
});

ipcMain.on('launch-viewer', (event, displayId) => {
    createViewer(displayId);
});

// IPC: Viewer Escape
ipcMain.on('viewer-escape', () => {
    if (viewerWindow && !viewerWindow.isDestroyed()) {
        viewerWindow.close();
        viewerWindow = null;
    }
});

// IPC: Open External Link
ipcMain.on('open-external', (event, url) => {
    require('electron').shell.openExternal(url);
});

// Z-Order Restoration
ipcMain.on('restore-z-order', () => {
    if (dashboardWindow && !dashboardWindow.isDestroyed()) {
        dashboardWindow.setAlwaysOnTop(false);
    }
    if (viewerWindow && !viewerWindow.isDestroyed()) {
        viewerWindow.setAlwaysOnTop(true);
    }
});

// ipcMain.handle('show-exit-confirm') removed (Main Loop Logic used instead)

ipcMain.on('force-quit', () => {
    app.quit();
});

// Persistence Handlers
ipcMain.on('save-state', (event, state) => {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state));
    } catch (err) {
        console.error('Failed to save state:', err);
    }
});

ipcMain.handle('load-state', async () => {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Failed to load state:', err);
    }
    return null;
});

// Analytics Persistence
ipcMain.on('save-analytics', (event, state) => {
    try {
        fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(state));
    } catch (err) {
        console.error('Failed to save analytics state:', err);
    }
});

ipcMain.handle('load-analytics', async () => {
    try {
        if (fs.existsSync(ANALYTICS_FILE)) {
            const data = fs.readFileSync(ANALYTICS_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('Failed to load analytics state:', err);
    }
    return null;
});

ipcMain.handle('purge-analytics', async () => {
    try {
        if (fs.existsSync(ANALYTICS_FILE)) {
            fs.unlinkSync(ANALYTICS_FILE);
            return true;
        }
    } catch (err) {
        console.error('Failed to purge analytics:', err);
    }
    return false;
});

ipcMain.handle('export-csv-report', async (event, data, rows) => {
    try {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Export Session Report',
            defaultPath: `Show_Report_${new Date().toISOString().split('T')[0]}.csv`,
            filters: [
                { name: 'CSV File', extensions: ['csv'] }
            ]
        });

        if (!filePath) return { success: false, cancelled: true };

        // Simple CSV construction
        let csvContent = "";

        // Add metadata
        csvContent += `Event:,${data.eventTitle || 'cueTime Session'}\n`;
        csvContent += `Operator:,${data.operatorName || 'Operator'}\n`;
        csvContent += `Date:,${new Date().toLocaleDateString()}\n`;
        csvContent += `Total Variance:,${data.totalVariance}\n\n`;

        // Add headers
        // Event Schedule uses: '#', 'Title', 'Planned', 'Actual', 'Variance', 'Notes'
        csvContent += `No.,Segment Title,Planned Duration,Actual Duration,Variance\n`;

        // Add rows
        rows.forEach(r => {
            // Escape potential commas in title by quoting
            const escapedTitle = r.title.replace(/"/g, '""');
            csvContent += `${r.index},"${escapedTitle}",${r.plannedDuration},${r.actualDuration},${r.variance}\n`;
        });

        fs.writeFileSync(filePath, csvContent);
        return { success: true, filePath };

    } catch (err) {
        console.error('Failed to export CSV:', err);
        return { success: false, error: err.message };
    }
});

app.whenReady().then(() => {
    // Fresh Start: Delete previous state if exists
    try {
        if (fs.existsSync(STATE_FILE)) {
            fs.unlinkSync(STATE_FILE);
            console.log('Previous session state cleared (Fresh Start).');
        }
        if (fs.existsSync(ANALYTICS_FILE)) {
            fs.unlinkSync(ANALYTICS_FILE);
            console.log('Previous analytics state cleared (Fresh Start).');
        }
    } catch (err) {
        console.error('Failed to clear previous state:', err);
    }

    createSplash();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createSplash();
        }
    });

    // Initial Screen Check for Auto-Viewer (Startup)
    // Only auto-launch if >1 screen detected on app start
    const displays = screen.getAllDisplays();
    console.log('[Main] Startup Display Count:', displays.length);

    if (displays.length > 1) {
        console.log('[Main] Multi-screen detected on startup. Queuing viewer launch...');
        // Set flag to launch viewer once Dashboard is ready
        global.autoLaunchViewer = true;
    }

    // Dynamic Screen Detection (Runtime)
    screen.on('display-added', (event, newDisplay) => {
        console.log('[Main] EVENT: display-added', newDisplay.id, newDisplay.label);

        // If viewer is blocking primary screen, bring dashboard up
        if (viewerWindow && !viewerWindow.isDestroyed()) {
            viewerWindow.setAlwaysOnTop(false);
            if (dashboardWindow && !dashboardWindow.isDestroyed()) {
                dashboardWindow.setAlwaysOnTop(true);
                dashboardWindow.focus();
            }
        }

        if (dashboardWindow && !dashboardWindow.isDestroyed()) {
            console.log('[Main] Sending display-detected to Dashboard');
            dashboardWindow.webContents.send('display-detected', {
                id: newDisplay.id,
                label: newDisplay.label
            });
        }
    });

});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Clean up wake lock on exit
app.on('will-quit', () => {
    if (powerSaveBlocker.isStarted(powerSaveBlockerId)) {
        powerSaveBlocker.stop(powerSaveBlockerId);
    }
});
