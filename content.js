// content.js

// Function to check video state
function monitorVideo() {
  const video = document.querySelector('video');

  if (!video) return;

  // Add an event listener for when the video ends
  video.addEventListener('ended', () => {
    // Send a message to the background script indicating the video ended
    chrome.runtime.sendMessage({ action: 'videoEnded' });
  });
}

// YouTube is a Single Page Application (SPA), so we need to observe navigation
// or just re-run the check periodically to attach the listener to the video element.
const observer = new MutationObserver(() => {
  const video = document.querySelector('video');
  if (video && !video.getAttribute('data-monitor-attached')) {
    video.setAttribute('data-monitor-attached', 'true');
    monitorVideo();
  }
});

observer.observe(document.body, { childList: true, subtree: true });