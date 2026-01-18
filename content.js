// content.js

// Time to wait for video to start before giving up (milliseconds)
const LOAD_TIMEOUT = 6000;

function handleVideoEnd() {
  if (!chrome.runtime?.id) return;
  console.log('Video finished. Requesting close...');
  try {
    chrome.runtime.sendMessage({ action: 'videoEnded' });
  } catch (e) {}
}

function reportNotAVideo() {
  if (!chrome.runtime?.id) return;
  console.log('Not a video or failed to play. Requesting move to next tab...');
  try {
    // We send a DIFFERENT action here so background knows NOT to close this tab
    chrome.runtime.sendMessage({ action: 'notAVideo' });
  } catch (e) {}
}

function monitorVideo() {
  const video = document.querySelector('video');

  // 1. Check if we are on a valid Watch page
  if (!window.location.href.includes('/watch')) {
    console.log('Not a watch page.');
    reportNotAVideo();
    return;
  }

  // 2. If video element is missing
  if (!video) {
    setTimeout(() => {
        if(!document.querySelector('video')) reportNotAVideo();
    }, 2000);
    return;
  }

  // 3. Attach Ended Listener
  video.removeEventListener('ended', handleVideoEnd);
  video.addEventListener('ended', handleVideoEnd);

  // 4. Check if playing
  setTimeout(() => {
    if (video.paused) {
      // Try to force play
      video.play().then(() => {
        console.log('Force play successful.');
      }).catch(() => {
        console.log('Autoplay failed. Moving to next tab.');
        reportNotAVideo();
      });
    } else {
      console.log('Video is playing.');
    }
  }, LOAD_TIMEOUT);
}

// Initialize
setTimeout(monitorVideo, 1000);

// Observer for navigation changes
const observer = new MutationObserver(() => {
  const video = document.querySelector('video');
  if (video && !video.getAttribute('data-monitor-attached')) {
    video.setAttribute('data-monitor-attached', 'true');
    monitorVideo();
  }
});
observer.observe(document.body, { childList: true, subtree: true });