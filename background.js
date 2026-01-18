// background.js

async function getNextTab(currentTabId, windowId) {
  const tabs = await chrome.tabs.query({ windowId });
  tabs.sort((a, b) => a.index - b.index);

  const currentIndex = tabs.findIndex((t) => t.id === currentTabId);
  if (currentIndex === -1) return tabs[0];

  return currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : tabs[0];
}

async function activateAndRefreshTab(tabId) {
  if (!tabId) return;

  try {
    // 1. Activate the tab first
    await chrome.tabs.update(tabId, { active: true });
    
    // Give a tiny moment for focus to shift
    await new Promise((r) => setTimeout(r, 100));

    // 2. Get current state
    const tab = await chrome.tabs.get(tabId);
    console.log(`Checking tab: ${tab.url}`);

    // 3. Check for Marvelous Suspender (or generic suspension)
    if (tab.url.includes('chrome-extension://') && tab.url.includes('uri=')) {
      console.log('Tab is Suspended. Extracting real URL...');

      // Extract the 'uri' parameter from the suspended URL
      const urlParams = new URLSearchParams(tab.url.split('#')[1]); // usually after hash
      let originalUrl = urlParams.get('uri');
      
      if (!originalUrl) {
         // Fallback if params are in search instead of hash
         const searchParams = new URL(tab.url).searchParams;
         originalUrl = searchParams.get('uri');
      }

      if (originalUrl) {
        console.log(`Restoring to original URL: ${originalUrl}`);
        await chrome.tabs.update(tabId, { url: originalUrl });
        return; // We don't need to reload, updating URL does it
      }
    }

    // 4. Standard Reload (for non-suspended or native discarded tabs)
    // We force bypass cache to ensure the content script runs fresh
    console.log('Standard reload triggered.');
    await chrome.tabs.reload(tabId, { bypassCache: true });

  } catch (error) {
    console.error('Failed to activate/reload tab:', error);
  }
}

chrome.runtime.onMessage.addListener(async (message, sender) => {
  if (!sender.tab) return;

  const tabId = sender.tab.id;
  const windowId = sender.tab.windowId;

  try {
    const [tab, window] = await Promise.all([
      chrome.tabs.get(tabId),
      chrome.windows.get(windowId),
    ]);

    const isWindowVisible = window.state !== 'minimized';
    const isTabActive = tab.active;

    // Safety Check: If visible and active, let YouTube handle it
    if (isWindowVisible && isTabActive) {
      console.log('Window visible & tab active. Letting autoplay work.');
      return;
    }

    if (message.action === 'videoEnded') {
      const nextTab = await getNextTab(tabId, windowId);
      const allTabs = await chrome.tabs.query({ windowId });

      if (allTabs.length > 1) {
        // Close current tab
        await chrome.tabs.remove(tabId);
        console.log('Video ended. Tab closed.');
      }

      if (nextTab) {
        // Pass the ID to our logic
        await activateAndRefreshTab(nextTab.id);
      }
    } else if (message.action === 'notAVideo') {
      const nextTab = await getNextTab(tabId, windowId);
      if (nextTab) {
        await activateAndRefreshTab(nextTab.id);
      }
    }
  } catch (error) {
    console.error('Error in background script:', error);
  }
});