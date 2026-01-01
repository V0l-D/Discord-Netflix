module.exports = function () {
  const pathname = document.location.pathname;
  let avatar = '';
  let userName = '';

  // Try to get Netflix user profile avatar and name
  if (typeof netflix !== 'undefined') {
    try {
      const { userGuid, name } = netflix.reactContext.models.userInfo.data;
      avatar = netflix.falcorCache.profiles[userGuid].summary.value.avatarName.split('R|').pop().split('|')[0];
      userName = name;
    } catch {
      console.warn('[Netflix RPC] User info not found');
    }
  }

  // === Browsing ===
  if (pathname.includes('/browse')) {
    return {
      name: 'Browsing',
      title: 'Browsing',
      state: 'In the Catalogs',
      avatar,
      userName,
    };
  }

  // === Title Page ===
  if (pathname.includes('/title')) {
    const title =
      document.querySelector('h1.title-title')?.textContent?.trim() ||
      document.querySelector('.title-info h3')?.textContent?.trim() ||
      document.title.replace(' - Netflix', '').trim();

    const subtitle = document.querySelector('.episodeTitle')?.textContent?.trim() || '';

    return {
      name: 'Checking a title',
      title,
      state: subtitle,
      avatar,
      userName,
      buttons: [],
    };
  }

  // === Watching Page ===
  if (pathname.includes('/watch')) {
    try {
      const videoEl = document.querySelector(".VideoContainer video") ||
                      document.querySelector(".watch-video--player-view video");
      if (!videoEl) return;

      const { duration, currentTime, paused } = videoEl;

      const titleContainer = document.querySelector('[data-uia="video-title"]');
      if (!titleContainer) return;

      const spans = Array.from(titleContainer.querySelectorAll('span'));
      const h4s = Array.from(titleContainer.querySelectorAll('h4'));

      let episodeNumber = '';
      let episodeTitle = '';
      let seriesTitle = '';

      // Parse episode and title info based on Netflix's DOM layout
      if (spans.length >= 3) {
        // Typical episode: S1:E1, Title, Show Name
        seriesTitle = h4s[0]?.textContent?.trim() || '';
        episodeNumber = spans[0]?.textContent?.trim() || '';
        episodeTitle = spans[1]?.textContent?.trim() || '';
      } else if (spans.length === 2) {
        // Fallback for episodes with fewer spans
        episodeNumber = spans[0]?.textContent?.trim() || '';
        episodeTitle = spans[1]?.textContent?.trim() || '';
        seriesTitle = h4s[0]?.textContent?.trim() || '';
      } else {
        // Movie fallback
        const movieName = titleContainer.textContent?.trim() || '';
        seriesTitle = 'Netflix';
        episodeTitle = movieName;
      }

      const fullState = (episodeNumber && episodeTitle)
        ? `${episodeNumber}: ${episodeTitle}`
        : episodeTitle || episodeNumber || '';

// Get video ID from DOM
const playerDiv = document.querySelector('[data-uia="player"]');
const id = playerDiv?.dataset?.videoid || '';


      return {
        title: seriesTitle || document.title.replace(' - Netflix', '').trim(),
        state: fullState,
        duration,
        currentTime,
        paused,
        avatar,
        userName,
        buttons: id ? [{
          label: 'Watch on Netflix',
          url: `https://www.netflix.com/watch/${id}`
        }] : [],
      };
    } catch (e) {
      console.error('[Netflix RPC] Failed to parse watching data:', e);
    }
  }
console.log(id)
  return null;
};
