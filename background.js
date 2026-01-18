// background.js

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action === 'videoEnded' && sender.tab) {
    const tabId = sender.tab.id;
    const windowId = sender.tab.windowId;

    try {
      const tab = await chrome.tabs.get(tabId);
      const window = await chrome.windows.get(windowId);

      // --- LOGIC UPDATE ---
      
      const isWindowMinimized = window.state === 'minimized';
      const isTabHidden = !tab.active; // True if you are in a different tab

      // Debugging log to see exactly what Chrome sees
      console.log(`Video Ended. State -> Minimized: ${isWindowMinimized}, Tab Hidden: ${isTabHidden}, Window Focused: ${window.focused}`);

      // CONDITION:
      // We only CLOSE if the window is minimized OR the tab is hidden.
      // If the window is visible (normal/maximized) and the tab is active, we leave it alone.
      if (!isWindowMinimized && !isTabHidden) {
        console.log('Tab is visible on screen. Letting autoplay work.');
        return;
      }

      // --- CLOSE & REFRESH LOGIC ---

      // 1. Get all tabs in this window
      const tabs = await chrome.tabs.query({ windowId: windowId });

      // Sort tabs by index to ensure correct order
      tabs.sort((a, b) => a.index - b.index);

      // Find current tab index
      const currentTabIndex = tabs.findIndex((t) => t.id === tabId);

      // Calculate next tab
      let nextTab = null;

      if (currentTabIndex !== -1 && currentTabIndex < tabs.length - 1) {
        nextTab = tabs[currentTabIndex + 1];
      } else if (tabs.length > 1) {
        // If last tab, wrap around to first
        nextTab = tabs[0];
      }

      // 2. Close the YouTube tab
      await chrome.tabs.remove(tabId);
      console.log('Action taken: YouTube tab closed.');

      // 3. Refresh the next tab if it exists
      if (nextTab) {
        setTimeout(() => {
          chrome.tabs.reload(nextTab.id);
          console.log(`Refreshed tab: ${nextTab.title}`);
        }, 200);
      }
    } catch (error) {
      console.error('Error handling video end:', error);
    }
  }
});