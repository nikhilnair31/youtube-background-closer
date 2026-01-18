// background.js

// Function to handle moving to the next tab without closing the current one
async function activateNextTab(currentTabId, windowId) {
  try {
    const tabs = await chrome.tabs.query({ windowId: windowId });
    tabs.sort((a, b) => a.index - b.index);

    // If we are skipping (keeping tab open), find the next index
    if (currentTabId) {
       const currentIndex = tabs.findIndex(t => t.id === currentTabId);
       let nextTab = null;

       // If not at the end, go right
       if (currentIndex !== -1 && currentIndex < tabs.length - 1) {
         nextTab = tabs[currentIndex + 1];
       } 
       // If at the end, go to 0
       else if (tabs.length > 0) {
         nextTab = tabs[0];
       }

       if (nextTab) {
         await chrome.tabs.update(nextTab.id, { active: true });
         setTimeout(() => chrome.tabs.reload(nextTab.id), 200);
         console.log(`Switched to and refreshing: ${nextTab.title}`);
       }
    }
  } catch (error) {
    console.error('Error activating next tab:', error);
  }
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (!sender.tab) return;

  const tabId = sender.tab.id;
  const windowId = sender.tab.windowId;

  try {
    const tab = await chrome.tabs.get(tabId);
    const window = await chrome.windows.get(windowId);

    // --- SAFETY CHECK (UPDATED) ---
    
    // We only care if the window is Minimized or if the Tab is Hidden (background tab).
    // We DO NOT check window.focused. This allows the window to be visible 
    // on a second monitor (or behind another small window) without triggering the close.
    
    const isWindowVisible = window.state !== 'minimized';
    const isTabActive = tab.active;

    // If the window is on screen (not minimized) AND this is the tab currently showing:
    // ABORT. Let YouTube autoplay handle it.
    if (isWindowVisible && isTabActive) {
      console.log('Window visible & tab active. Ignoring script. Letting Autoplay work.');
      return;
    }

    // --- EXECUTION LOGIC ---

    if (message.action === 'videoEnded') {
      // 1. Determine who is next BEFORE closing
      const tabs = await chrome.tabs.query({ windowId: windowId });
      tabs.sort((a, b) => a.index - b.index);
      const currentIndex = tabs.findIndex(t => t.id === tabId);
      
      let nextTabId = null;
      
      // Calculate next tab ID
      if (currentIndex !== -1 && currentIndex < tabs.length - 1) {
        nextTabId = tabs[currentIndex + 1].id;
      } else if (tabs.length > 0) {
        nextTabId = tabs[0].id;
      }

      // 2. Close the completed video tab (only if we have more than 1 tab)
      if (tabs.length > 1) {
        await chrome.tabs.remove(tabId);
        console.log('Video ended (Background/Minimized). Tab closed.');
      }

      // 3. Activate and reload the next tab
      if (nextTabId) {
        await chrome.tabs.update(nextTabId, { active: true });
        // Small delay to ensure the close action settled
        setTimeout(() => chrome.tabs.reload(nextTabId), 300);
      }

    } else if (message.action === 'notAVideo') {
      console.log('Not a video. Keeping tab open, moving to next.');
      await activateNextTab(tabId, windowId);
    }

  } catch (error) {
    console.error('Error in background script:', error);
  }
});