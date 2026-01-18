// content.js

// Time to wait for video to start (milliseconds)
const LOAD_TIMEOUT = 6000;
// How close to the end (in seconds) counts as "finished"
const END_THRESHOLD = 1.0; 

let videoEndHandlerAttached = false;
let monitorInterval = null;

function handleVideoEnd() {
  if (!chrome.runtime?.id) return;
  
  // Stop checking once we've triggered
  if (monitorInterval) clearInterval(monitorInterval);
  
  console.log('Video finished (or skipped to end). Requesting close...');
  try {
    chrome.runtime.sendMessage({ action: 'videoEnded' });
  } catch (e) {
    console.error('Failed to send message:', e);
  }
}

function reportNotAVideo() {
  if (!chrome.runtime?.id) return;
  if (monitorInterval) clearInterval(monitorInterval);

  console.log('Not a video or failed to play. Requesting move to next tab...');
  try {
    chrome.runtime.sendMessage({ action: 'notAVideo' });
  } catch (e) {}
}

function monitorVideo() {
  if (!window.location.href.includes('/watch')) {
    reportNotAVideo();
    return;
  }

  const video = document.querySelector('video');
  if (!video) {
    setTimeout(() => {
      if (!document.querySelector('video')) reportNotAVideo();
    }, 2000);
    return;
  }

  // 1. Native 'ended' listener (Standard behavior)
  if (!videoEndHandlerAttached) {
    video.addEventListener('ended', handleVideoEnd);
    videoEndHandlerAttached = true;
  }

  // 2. Poll for SponsorBlock/Skip behavior
  // SponsorBlock often skips the last few seconds, preventing 'ended' from firing.
  if (monitorInterval) clearInterval(monitorInterval);
  monitorInterval = setInterval(() => {
    if (!video) return;

    // Check if we are extremely close to the duration (SponsorBlock skip)
    // or if the video element thinks it has ended but didn't fire the event
    if (video.duration > 0) {
      const remaining = video.duration - video.currentTime;
      
      // If remaining time is less than 1 second, or video.ended is true
      if (remaining <= END_THRESHOLD || video.ended) {
        handleVideoEnd();
      }
    }
  }, 1000);

  // 3. Ensure playing
  setTimeout(() => {
    if (video.paused && video.readyState >= 2) {
      video.play().catch(() => {
        console.log('Autoplay failed.');
        // Don't report failure immediately, give the user/SponsorBlock a moment
      });
    }
  }, LOAD_TIMEOUT);
}

// Initialize
setTimeout(monitorVideo, 1000);

// Observer for navigation/SPA changes
const observer = new MutationObserver(() => {
  if (window.location.href.includes('/watch')) {
    const video = document.querySelector('video');
    // If we have a video but haven't attached our logic to this specific element
    if (video && !video.getAttribute('data-monitor-attached')) {
      video.setAttribute('data-monitor-attached', 'true');
      monitorVideo();
    }
  }
});
observer.observe(document.body, { childList: true, subtree: true });