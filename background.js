let storageInitPromise = null;

async function initializeStorage() {
  const current = await browser.storage.local.get(null);
  const allowMissingSchema = Object.keys(current).length === 0;
  const { settings, resetReason } = await globalThis.YachexpSettingsUpdate.normalizeSettings(
    current,
    { allowMissingSchema }
  );

  if (resetReason) {
    console.warn(`Resetting storage to defaults: ${resetReason}`);
  }

  if (settings === current) {
    return;
  }

  await globalThis.YachexpSettingsUpdate.replaceStorage(settings, current);
}

function ensureStorageInitialized() {
  if (!storageInitPromise) {
    storageInitPromise = initializeStorage().catch((err) => {
      console.error('Storage initialization failed:', err);
      throw err;
    });
  }
  return storageInitPromise;
}

ensureStorageInitialized();

browser.action.onClicked.addListener((tab) => {
  if (!tab || !tab.id) {
    return;
  }
  browser.tabs.sendMessage(tab.id, { type: 'yachexp-export' }).catch(() => {
    // Ignore errors when the active tab does not have the content script
  });
});
