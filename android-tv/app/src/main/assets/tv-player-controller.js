(function () {
  'use strict';
  if (window.DAITIGN_TV_PLAYER) return;

  var HIDDEN = 'PLAYER_HIDDEN';
  var CONTROLS = 'PLAYER_CONTROLS';
  var TIMELINE = 'PLAYER_TIMELINE';
  var MENU = 'PLAYER_MENU';
  var state = HIDDEN;
  var selected = null;
  var menuOpener = null;
  var activePopup = null;
  var preferredX = null;
  var candidateCache = [];
  var candidatesDirty = true;
  var menuCandidateCache = [];
  var menuCandidatesDirty = true;
  var menuSyncTimer = 0;
  var controlsIdleTimer = 0;
  var idleGeneration = 0;
  var lastFocusedControlKind = null;
  var lastFocusedControlLabel = null;
  var lastStableControlKind = 'play-pause';
  var lastStableControlLabel = null;
  var watchdogTimer = 0;
  var keepAliveHeartbeatTimer = 0;
  var WATCHDOG_INTERVAL_MS = 180;
  var replacementObserver = null;
  var observedAncestor = null;
  var lastControlRevealAt = 0;
  var wasPlayingBeforeSuspend = false;
  var PLAYER_CONTROLS_IDLE_MS = 5000;
  var CONTROLS_IDLE_MS = 6000;
  var DEBUG = new URLSearchParams(window.location.search).get('tvDebug') === '1';

  function debugLog() {
    if (DEBUG) console.log.apply(console, arguments);
  }

  var style = document.createElement('style');
  style.id = 'daitign-tv-player-focus';
  style.textContent = '.daitign-tv-player-selected{outline:0!important;filter:brightness(1.13) drop-shadow(0 5px 11px rgba(255,255,255,.28))!important;transform:scale(1.08)!important;transition:filter 120ms ease,transform 120ms ease!important}.daitign-tv-player-menu-selected{outline:2px solid rgba(255,255,255,.55)!important;outline-offset:1px!important;background:rgba(255,255,255,.19)!important;border-radius:10px!important;color:#fff!important;box-shadow:none!important;filter:none!important;transform:none!important;transition:background-color 90ms ease!important}.daitign-tv-episode-selected{outline:3px solid #ffffff!important;outline-offset:3px!important;border-radius:8px!important;box-shadow:0 0 16px rgba(255,255,255,.45)!important;transform:scale(1.02)!important;transition:transform 120ms ease,box-shadow 120ms ease!important;z-index:10!important}.daitign-tv-player-timeline{outline:0!important;filter:brightness(1.16) drop-shadow(0 3px 7px rgba(255,255,255,.18))!important;transform:scaleY(1.28)!important;transition:filter 120ms ease,transform 120ms ease!important}.daitign-tv-controls-locked .art-controls,.daitign-tv-controls-locked .art-control,.daitign-tv-controls-locked .art-bottom,.daitign-tv-controls-locked .art-top,.daitign-tv-controls-locked .art-progress,.daitign-tv-controls-locked .art-layers,.daitign-tv-controls-locked .z-30,.daitign-tv-controls-locked .z-30 > div,.daitign-tv-controls-locked [class*="controls"],.daitign-tv-controls-locked [class*="player-bottom"],.daitign-tv-controls-locked [role="dialog"],.daitign-tv-controls-locked [role="menu"],.daitign-tv-controls-locked [role="listbox"],.daitign-tv-controls-locked [data-radix-popper-content-wrapper],.daitign-tv-controls-locked .art-settings,.daitign-tv-controls-locked .art-selector{opacity:1!important;visibility:visible!important;pointer-events:auto!important}.daitign-tv-controls-locked.art-hide-cursor,.daitign-tv-controls-locked .art-hide-cursor,.daitign-tv-controls-locked.cursor-none,.daitign-tv-controls-locked .cursor-none{cursor:auto!important}[role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper],[data-radix-popper-content-wrapper] > div,.art-settings,.art-setting,.art-selector,.art-layer-selector,[class*="popup"],[class*="modal"]{max-height:min(72vh,680px)!important;max-width:min(42vw,560px)!important;box-sizing:border-box!important;overflow-y:auto!important;overflow-x:hidden!important;bottom:clamp(70px,12vh,120px)!important;margin-bottom:0!important}.daitign-tv-episodes-popup,[data-slot*="drawer"].daitign-tv-episodes-popup,[data-vaul-drawer].daitign-tv-episodes-popup,.daitign-tv-episodes-popup [data-slot*="drawer-content"],.daitign-tv-episodes-popup.max-w-5xl{max-width:min(94vw,1200px)!important;max-height:88vh!important;bottom:auto!important}.daitign-tv-settings-popup,[data-slot*="drawer-content"]:not(.daitign-tv-episodes-popup):not(.daitign-tv-subtitles-popup),[data-vaul-drawer]:not(.daitign-tv-episodes-popup):not(.daitign-tv-subtitles-popup),[data-slot*="drawer"]:not(.daitign-tv-episodes-popup):not(.daitign-tv-subtitles-popup),.max-w-5xl:not(.daitign-tv-episodes-popup){width:min(620px,42vw)!important;max-width:min(620px,42vw)!important;max-height:min(680px,72vh)!important;position:fixed!important;top:50%!important;left:50%!important;right:auto!important;bottom:auto!important;transform:translate(-50%,-50%)!important;box-sizing:border-box!important;overflow-y:auto!important;overflow-x:hidden!important;margin:0!important}.daitign-tv-subtitles-popup{width:min(560px,40vw)!important;max-width:min(560px,40vw)!important;max-height:min(680px,72vh)!important;box-sizing:border-box!important;overflow-y:auto!important;overflow-x:hidden!important}[role="dialog"]::-webkit-scrollbar,[role="menu"]::-webkit-scrollbar,.art-settings::-webkit-scrollbar,[class*="popup"]::-webkit-scrollbar,.daitign-tv-settings-popup::-webkit-scrollbar,.daitign-tv-subtitles-popup::-webkit-scrollbar,[data-slot*="drawer-content"]::-webkit-scrollbar{width:6px!important}[role="dialog"]::-webkit-scrollbar-thumb,.art-settings::-webkit-scrollbar-thumb,.daitign-tv-settings-popup::-webkit-scrollbar-thumb,.daitign-tv-subtitles-popup::-webkit-scrollbar-thumb,[data-slot*="drawer-content"]::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3)!important;border-radius:4px!important}';
  document.head.appendChild(style);

  function notify(next) {
    if (state === next) return;
    state = next;
    debugLog('[DAITIGN TV Player] state = ' + next);
    if (state === CONTROLS || state === TIMELINE || state === MENU) {
      ensureControlsVisible();
      installReplacementObserver();
      startVisibilityWatchdog();
      startKeepAliveHeartbeat();
    } else if (state === HIDDEN) {
      removeVisibilityLock();
      stopVisibilityWatchdog();
      stopKeepAliveHeartbeat();
      if (replacementObserver) {
        try { replacementObserver.disconnect(); } catch (_) {}
        replacementObserver = null;
        observedAncestor = null;
      }
    }
    try { window.AndroidTVBridge && window.AndroidTVBridge.setPlayerState(next); } catch (_) {}
  }

  function rendered(element) {
    if (!element || !element.isConnected) return false;
    var rect = element.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return false;
    var computed = getComputedStyle(element);
    return computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0';
  }

  function visible(element) {
    if (!rendered(element)) return false;
    var rect = element.getBoundingClientRect();
    return rect.width >= 4 && rect.height >= 4;
  }

  function enabled(element) {
    return !element.matches(':disabled,[disabled],[aria-disabled="true"]');
  }

  function label(element) {
    if (!element) return '';
    return [
      element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('name'),
      element.getAttribute('data-testid'), element.getAttribute('role'), element.textContent,
      typeof element.className === 'string' ? element.className : ''
    ].filter(Boolean).join(' ').trim().toLowerCase();
  }

  function isTimeline(element) {
    return element.matches('input[type="range"],[role="slider"],[aria-valuenow]') || /timeline|progress|scrub|seek/.test(label(element));
  }

  function controlVisible(element) {
    if (!rendered(element)) return false;
    var rect = element.getBoundingClientRect();
    return (rect.width >= 4 && rect.height >= 4) || (isTimeline(element) && rect.width >= 40 && rect.height >= 1);
  }

  function timelinePriority(element) {
    if (element.matches('input[type="range"],[role="slider"],[aria-valuenow]')) return 2;
    return isTimeline(element) ? 1 : 0;
  }

  function isSkipIntro(element) {
    if (!element || isTimeline(element)) return false;
    if (element.matches && element.matches('video, iframe, body, html')) return false;
    var rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
    if (rect && (rect.width > innerWidth * 0.7 && rect.height > innerHeight * 0.7)) return false;

    var text = (element.textContent || '').trim().toLowerCase();
    var aria = (element.getAttribute('aria-label') || '').trim().toLowerCase();
    var title = (element.getAttribute('title') || '').trim().toLowerCase();

    var isDirectMatch = function (val) {
      return (
        val === 'skip intro' ||
        val === 'skip intro.' ||
        val === 'skip opening' ||
        val === 'intro' ||
        val === 'skip' ||
        val === 'skip recap' ||
        val === 'skip credits'
      );
    };

    if (isDirectMatch(text) || isDirectMatch(aria) || isDirectMatch(title)) {
      return true;
    }

    var semantic = label(element);
    if (/skip\s*(back|forward|\d+\s*s|\d+\s*sec)/i.test(semantic)) return false;
    if (/next\s*(episode|track)/i.test(semantic)) return false;

    if (/\b(skip\s*intro|skip\s*opening|skip\s*recap|skip\s*credits)\b/i.test(semantic)) {
      return true;
    }

    if (element.matches && (
      element.matches('[class*="skip-intro"], [class*="skip_intro"], [class*="skipIntro"], [class*="art-skip"], [class*="art-control-skip"], [id*="skip-intro"], [id*="skipIntro"], [data-action*="skip"]')
    )) {
      return true;
    }

    return false;
  }

  function controlKind(element) {
    if (!element) return 'control';
    if (isSkipIntro(element)) return 'skip-intro';
    var semantic = label(element);
    if (isTimeline(element)) return 'timeline';
    if (/play|pause/.test(semantic)) return 'play-pause';
    if (/episode/.test(semantic)) return 'episodes';
    if (/next/.test(semantic)) return 'next';
    if (/volume|mute|sound/.test(semantic)) return 'volume';
    if (/aspect|fit|ratio/.test(semantic)) return 'fit';
    if (/subtitle|caption|\bcc\b|english\s*\d*/.test(semantic)) return 'subtitle';
    if (/quality|\bauto\b|1080|720|480/.test(semantic)) return 'quality';
    if (/server|source/.test(semantic)) return 'server';
    if (/setting/.test(semantic)) return 'settings';
    if (/fullscreen|full screen/.test(semantic)) return 'fullscreen';
    if (/cast|airplay|chromecast/.test(semantic)) return 'cast';
    if (/back|return/.test(semantic)) return 'back';
    return 'control';
  }

  function candidates(force) {
    if (!force && !candidatesDirty) {
      candidateCache = candidateCache.filter(function (element) { return controlVisible(element) && enabled(element); });
      return candidateCache.slice();
    }
    var selector = 'button,a[href],input,select,[role="button"],[role="menuitem"],[role="option"],[role="slider"],[aria-valuenow],[tabindex]:not([tabindex="-1"]),[aria-label],[title],[class*="timeline"],[class*="progress"],[class*="scrub"],[class*="seek"],[class*="skip"],[class*="intro"],[id*="skip"]';
    candidateCache = Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (element) {
      if (!controlVisible(element) || !enabled(element) || element.matches('video,iframe')) return false;
      var rect = element.getBoundingClientRect();
      return !(rect.width > innerWidth * .82 && rect.height > innerHeight * .82);
    }).filter(function (element, index, all) {
      if (!isTimeline(element)) return true;
      return !all.some(function (other, otherIndex) {
        if (other === element || !isTimeline(other) || (!other.contains(element) && !element.contains(other))) return false;
        var priorityDifference = timelinePriority(other) - timelinePriority(element);
        return priorityDifference > 0 || (priorityDifference === 0 && otherIndex < index);
      });
    });

    Array.prototype.slice.call(document.querySelectorAll('div, span, p')).forEach(function (el) {
      if (!isSkipIntro(el) || !controlVisible(el) || !enabled(el)) return;
      var clickable = (typeof el.closest === 'function' ? el.closest('button, [role="button"], [tabindex]') : null) || el;
      if (candidateCache.indexOf(clickable) < 0 && controlVisible(clickable) && enabled(clickable)) {
        var rect = clickable.getBoundingClientRect();
        if (!(rect.width > innerWidth * .82 && rect.height > innerHeight * .82)) {
          candidateCache.push(clickable);
        }
      }
    });

    candidateCache = candidateCache.filter(function (element, index, all) {
      if (!isSkipIntro(element)) return true;
      var hasInner = all.some(function (other) {
        return other !== element && isSkipIntro(other) && typeof element.contains === 'function' && element.contains(other);
      });
      return !hasInner;
    });

    if (candidateCache.length < 12) {
      Array.prototype.slice.call(document.querySelectorAll('svg')).forEach(function (icon) {
        if (!visible(icon)) return;
        var wrapper = icon.closest('button,[role="button"],[tabindex]') || icon.parentElement;
        if (!wrapper || !visible(wrapper) || !enabled(wrapper) || candidateCache.indexOf(wrapper) >= 0) return;
        var rect = wrapper.getBoundingClientRect();
        if (rect.width < 12 || rect.height < 12 || rect.width > 180 || rect.height > 180) return;
        candidateCache.push(wrapper);
      });
    }
    candidatesDirty = false;
    return candidateCache.slice();
  }

  function center(element) {
    var rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function rows(elements) {
    var result = [];
    elements.slice().sort(function (a, b) { return center(a).y - center(b).y || center(a).x - center(b).x; }).forEach(function (element) {
      var point = center(element);
      var row = result.find(function (entry) { return Math.abs(entry.y - point.y) < Math.max(24, element.getBoundingClientRect().height * .6); });
      if (!row) result.push({ y: point.y, elements: [element] });
      else {
        row.elements.push(element);
        row.elements.sort(function (a, b) { return center(a).x - center(b).x; });
        row.y = row.elements.reduce(function (sum, item) { return sum + center(item).y; }, 0) / row.elements.length;
      }
    });
    return result.sort(function (a, b) { return a.y - b.y; });
  }

  function isEpisodesPopup(element) {
    if (!element) return false;
    var text = (element.textContent || '').toLowerCase();
    var hasEpisodeLinks = false;
    var hasEpisodeCards = false;
    var hasEpisodeGrid = false;
    if (typeof element.querySelectorAll === 'function') {
      try {
        hasEpisodeLinks = element.querySelectorAll('a[href*="/tv/"], a[href*="/embed/tv/"]').length > 0;
        hasEpisodeCards = element.querySelectorAll('.daitign-tv-episode-card, [class*="episode-card"]').length > 0;
        hasEpisodeGrid = element.querySelectorAll('[class*="grid"]').length > 0 && (/episode/i.test(text) || /season\s*\d+/i.test(text));
      } catch (_) {}
    }
    var hasEpisodeText = /select an episode/i.test(text) || (/episodes/i.test(text) && (/season\s*\d+/i.test(text) || /episode\s*\d+/i.test(text)));
    return hasEpisodeLinks || hasEpisodeCards || hasEpisodeGrid || hasEpisodeText;
  }

  function isEpisodeCard(element) {
    if (!element) return false;
    if (element.matches && (element.matches('a[href*="/tv/"], a[href*="/embed/tv/"]') || element.matches('.daitign-tv-episode-card, [class*="episode-card"]'))) return true;
    if (element.closest && !!element.closest('[class*="grid"]') && /^\s*\d+\.\s+/m.test(element.textContent || '')) return true;
    return false;
  }

  function findEpisodeCards(popup) {
    if (!popup || typeof popup.querySelectorAll !== 'function') return [];
    var links = Array.prototype.slice.call(popup.querySelectorAll('a[href*="/tv/"], a[href*="/embed/tv/"], a.group.block, .daitign-tv-episode-card, [class*="episode-card"]')).filter(visible);
    if (links.length) return links;

    var grid = typeof popup.querySelector === 'function' ? popup.querySelector('[class*="grid"]') : null;
    if (grid) {
      var gridChildren = Array.prototype.slice.call(grid.children).filter(visible);
      var cards = [];
      gridChildren.forEach(function (child) {
        var a = child.tagName === 'A' ? child : (typeof child.querySelector === 'function' ? child.querySelector('a') : null);
        cards.push(a || child);
      });
      if (cards.length) return cards;
    }

    var headings = Array.prototype.slice.call(popup.querySelectorAll('h3, h4, [class*="font-semibold"]')).filter(function (h) {
      return visible(h) && /^\s*\d+\.\s+/.test(h.textContent || '');
    });
    if (headings.length) {
      return headings.map(function (h) {
        return (typeof h.closest === 'function' && h.closest('a, [role="button"], [class*="group"]')) || h.parentElement;
      }).filter(function (el, idx, arr) {
        return el && visible(el) && arr.indexOf(el) === idx;
      });
    }
    return [];
  }

  function findCurrentEpisodeCard(cards) {
    return cards.find(function (card) {
      if (!card) return false;
      if (typeof card.getAttribute === 'function' && (card.getAttribute('aria-current') === 'true' || card.getAttribute('aria-selected') === 'true')) return true;
      if (card.classList && (card.classList.contains('active') || card.classList.contains('selected') || card.classList.contains('current'))) return true;
      var borderEl = typeof card.querySelector === 'function' ? card.querySelector('.border-2, [class*="border-red"], [style*="border-color"], [style*="outline-color"]') : null;
      if (borderEl) return true;
      if (card.style && (card.style.borderColor || card.style.borderWidth)) return true;
      return false;
    }) || null;
  }

  function findSeasonSelector(popup) {
    if (!popup || typeof popup.querySelectorAll !== 'function') return null;
    var buttons = Array.prototype.slice.call(popup.querySelectorAll('button, [role="button"]')).filter(visible);
    return buttons.find(function (b) {
      return /season\s*\d+/i.test(b.textContent || '');
    }) || null;
  }

  function findShowMoreButton(popup) {
    if (!popup || typeof popup.querySelectorAll !== 'function') return null;
    var buttons = Array.prototype.slice.call(popup.querySelectorAll('button, [role="button"]')).filter(visible);
    return buttons.find(function (b) {
      return /show\s*(more|less)/i.test(b.textContent || '');
    }) || null;
  }

  function findCloseButton(popup) {
    if (!popup || typeof popup.querySelectorAll !== 'function') return null;
    var buttons = Array.prototype.slice.call(popup.querySelectorAll('button, [role="button"]')).filter(visible);
    return buttons.find(function (b) {
      return /close|done|exit/i.test((b.textContent || '').trim());
    }) || null;
  }

  function detectSeasonDropdown() {
    var candidates = Array.prototype.slice.call(document.querySelectorAll(
      '[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"], [data-slot*="popover"], div.w-32, [class*="popover"]'
    )).filter(visible);
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var buttons = Array.prototype.slice.call(c.querySelectorAll('button, [role="menuitem"], [role="option"]')).filter(function (b) {
        return visible(b) && /season\s*\d+/i.test(b.textContent || '');
      });
      if (buttons.length > 0) return c;
    }
    var allDivs = Array.prototype.slice.call(document.querySelectorAll('div, ul')).filter(visible);
    for (var j = 0; j < allDivs.length; j++) {
      var div = allDivs[j];
      if (div.getBoundingClientRect().height > 500) continue;
      var seasonBtns = Array.prototype.slice.call(div.querySelectorAll('button')).filter(function (b) {
        return visible(b) && /^season\s*\d+$/i.test((b.textContent || '').trim());
      });
      if (seasonBtns.length >= 2) return div;
    }
    return null;
  }

  function discoverSeasonItems(dropdown) {
    if (!dropdown) return [];
    return Array.prototype.slice.call(dropdown.querySelectorAll('button, [role="menuitem"], [role="option"]')).filter(function (b) {
      return visible(b) && /season\s*\d+/i.test(b.textContent || '');
    });
  }

  function scrollCardIntoView(element) {
    if (!element || typeof element.scrollIntoView !== 'function') return;
    try {
      element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    } catch (_) {}
  }

  function isMenuItem(element, container) {
    if (!element || element === container || !visible(element) || !enabled(element)) return false;
    var isEpisodes = isEpisodesPopup(container);
    var rect = element.getBoundingClientRect();
    var parentRect = container.getBoundingClientRect();
    if (!isEpisodes && (rect.top < parentRect.top - 2 || rect.bottom > parentRect.bottom + 2)) return false;
    var maxHeight = isEpisodes ? parentRect.height * 1.5 : Math.min(160, parentRect.height * .7);
    if (rect.height < 12 || rect.height > maxHeight) return false;
    var semantic = element.matches('[role="menuitem"],[role="option"],button,a[href],input,select,li,[aria-selected],[aria-checked],[tabindex]:not([tabindex="-1"])');
    var computed = getComputedStyle(element);
    return semantic || typeof element.onclick === 'function' || computed.cursor === 'pointer';
  }

  function discoverMenuItems(container, force) {
    if (!container || !visible(container)) return [];
    if (isEpisodesPopup(container)) {
      var cards = findEpisodeCards(container);
      var seasonBtn = findSeasonSelector(container);
      var showMore = findShowMoreButton(container);
      var closeBtn = findCloseButton(container);
      var allEpisodesItems = [];
      if (seasonBtn) allEpisodesItems.push(seasonBtn);
      cards.forEach(function (card) { allEpisodesItems.push(card); });
      if (showMore) allEpisodesItems.push(showMore);
      if (closeBtn) allEpisodesItems.push(closeBtn);
      return allEpisodesItems;
    }
    if (!force && !menuCandidatesDirty && activePopup === container) {
      menuCandidateCache = menuCandidateCache.filter(function (item) { return container.contains(item) && isMenuItem(item, container); });
      return menuCandidateCache.slice();
    }
    var selector = '[role="menuitem"],[role="option"],button,a[href],input,select,[tabindex]:not([tabindex="-1"]),li,[aria-selected],[aria-checked],div';
    var raw = Array.prototype.slice.call(container.querySelectorAll(selector)).filter(function (element) {
      return isMenuItem(element, container);
    });
    menuCandidateCache = raw.filter(function (element) {
      return !raw.some(function (other) {
        return other !== element && element.contains(other) && other.getBoundingClientRect().height <= element.getBoundingClientRect().height;
      });
    }).filter(function (element, index, all) {
      var point = center(element);
      return all.findIndex(function (other) {
        var otherPoint = center(other);
        return Math.abs(otherPoint.x - point.x) < 3 && Math.abs(otherPoint.y - point.y) < 3;
      }) === index;
    }).sort(function (a, b) {
      return center(a).y - center(b).y || center(a).x - center(b).x;
    });
    menuCandidatesDirty = false;
    debugLog('[DAITIGN TV Player] menu items discovered = ' + menuCandidateCache.length + ': ' + menuCandidateCache.map(label).join(' | '));
    return menuCandidateCache.slice();
  }

  function classifyPopup(popup) {
    if (!popup) return 'generic';
    if (isEpisodesPopup(popup)) {
      if (popup.classList) popup.classList.add('daitign-tv-episodes-popup');
      return 'episodes';
    }
    var text = (popup.textContent || '').toLowerCase();
    var openerText = (controlKind(menuOpener) + ' ' + label(menuOpener)).toLowerCase();
    if (/player\s*settings|customize\s*your\s*playback/i.test(text) || (/settings/i.test(openerText) && !/subtitle/i.test(text))) {
      if (popup.classList) popup.classList.add('daitign-tv-settings-popup');
      var drawerContent = (typeof popup.querySelector === 'function' ? popup.querySelector('[data-slot*="drawer-content"], [data-vaul-drawer]') : null) ||
                          (typeof popup.closest === 'function' ? popup.closest('[data-slot*="drawer-content"], [data-vaul-drawer]') : null);
      if (drawerContent && drawerContent.classList) drawerContent.classList.add('daitign-tv-settings-popup');
      return 'settings';
    }
    if (/subtitles|upload\s*subtitle|off\s+english/i.test(text) || /subtitle|caption/i.test(openerText)) {
      if (popup.classList) popup.classList.add('daitign-tv-subtitles-popup');
      var drawerContentSub = (typeof popup.querySelector === 'function' ? popup.querySelector('[data-slot*="drawer-content"], [data-vaul-drawer]') : null) ||
                             (typeof popup.closest === 'function' ? popup.closest('[data-slot*="drawer-content"], [data-vaul-drawer]') : null);
      if (drawerContentSub && drawerContentSub.classList) drawerContentSub.classList.add('daitign-tv-subtitles-popup');
      return 'subtitles';
    }
    return 'generic';
  }

  function findSubmenuBackButton(popup) {
    if (!popup || typeof popup.querySelectorAll !== 'function') return null;
    var candidates = Array.prototype.slice.call(popup.querySelectorAll('button, [role="button"], [class*="back"], [aria-label*="Back"], [aria-label*="back"]')).filter(visible);
    return candidates.find(function (b) {
      var l = label(b);
      return /\b(back|return|previous|go\s*back)\b/i.test(l) || b.getAttribute('aria-label') === 'Back' || (b.classList && (b.classList.contains('art-icon-back') || b.classList.contains('art-setting-item-back')));
    }) || null;
  }

  function isSingleChoiceOption(item, popup, opener) {
    if (!item || !popup) return false;
    if (isEpisodeCard(item)) return false;

    var itemText = label(item).trim();

    // Explicit close, back, show more/less buttons
    if (/^(close|back|done|exit|show\s*more|show\s*less)$/i.test(itemText)) return false;

    // Season selector button
    if (/season\s*\d+/i.test(itemText) && !/episode/i.test(itemText)) {
      var seasonBtn = findSeasonSelector(popup);
      if (item === seasonBtn) return false;
    }

    // Multi-step configuration actions
    if (/^(upload\s*subtitle|style|subtitle\s*style|delay|subtitle\s*delay)/i.test(itemText)) return false;
    if ((item.matches && item.matches('input[type="range"], [role="slider"]')) || isTimeline(item)) return false;

    // Check if inside a multi-step configuration panel (Style, Delay, Font, Brightness, Mirror)
    var headerEl = typeof popup.querySelector === 'function' ? popup.querySelector('h1, h2, h3, [class*="title"], [class*="header"]') : null;
    var popupHeader = headerEl ? (headerEl.textContent || '').trim() : '';
    if (/subtitle\s*style|subtitle\s*delay|delay|font|brightness|mirror/i.test(popupHeader)) {
      return false; // Multi-step configuration: do NOT auto-close
    }

    // Check if in main Player Settings panel
    var popupAllText = (popup.textContent || '').trim();
    var isMainSettings = /player\s*settings|customize\s*your\s*playback/i.test(popupAllText);
    if (isMainSettings) {
      // In main settings, category rows open submenus
      if (item.getAttribute('aria-haspopup') === 'true' ||
          item.getAttribute('aria-expanded') !== null ||
          />|›|→/.test(item.textContent || '') ||
          /^(quality|audio|subtitles?|aspect\s*ratio|brightness|mirror)/i.test(itemText)) {
        return false;
      }
    }

    var openerText = (opener ? (controlKind(opener) + ' ' + label(opener)) : '').toLowerCase();

    // 1) Subtitles single choice:
    var isSubtitlesContext = /subtitle|caption/i.test(openerText) || /subtitles/i.test(popupHeader) || (popup.classList && popup.classList.contains('daitign-tv-subtitles-popup'));
    if (isSubtitlesContext) {
      if (!/upload\s*subtitle|style|delay/i.test(itemText)) {
        return true;
      }
    }

    // 2) Quality single choice:
    if (/^(auto|original|source|1080p?|720p?|480p?|360p?|4k|2160p|high|medium|low)$/i.test(itemText) ||
        /quality/i.test(openerText) || /quality/i.test(popupHeader)) {
      return true;
    }

    // 3) Server / Source single choice:
    if (/^(server\s*\d+|vidcloud|upcloud|megacloud|streamtape|doodstream)/i.test(itemText) ||
        /server|source/i.test(openerText) || /server|source/i.test(popupHeader)) {
      return true;
    }

    // 4) Audio single choice:
    if (/audio/i.test(openerText) || /audio\s*track|audio\s*language/i.test(popupHeader)) {
      return true;
    }

    // 5) Aspect ratio single choice:
    if (/^(fit|16:9|4:3|cover|contain|fill|stretch|default)$/i.test(itemText) ||
        /aspect\s*ratio/i.test(openerText) || /aspect\s*ratio/i.test(popupHeader)) {
      return true;
    }

    // 6) Generic language / quality / track item:
    if (/^(off|none|auto|english|spanish|french|german|japanese|korean|chinese|italian|portuguese|russian|arabic|thai|vietnamese|indonesian|malay|hindi|filipino|tagalog|bulgarian)(\s*\d+)?$/i.test(itemText)) {
      return true;
    }

    return false;
  }

  function detectPopup() {
    var semantic = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"],[aria-modal="true"],[data-slot*="drawer"],[data-vaul-drawer]')).filter(visible);
    var found = null;
    if (semantic.length) {
      found = semantic[semantic.length - 1];
    } else {
      var selector = '[class*="menu"],[class*="popup"],[class*="popover"],[class*="setting"],[class*="server"],[class*="subtitle"],[class*="quality"],[class*="source"],[class*="drawer"],body > div';
      var possible = Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (element) {
        if (!visible(element) || element === document.body) return false;
        var rect = element.getBoundingClientRect();
        if (rect.width < innerWidth * .10 || rect.height < innerHeight * .10) return false;
        if (rect.width > innerWidth * .98 || rect.height > innerHeight * .98) return false;
        var computed = getComputedStyle(element);
        if (computed.position !== 'fixed' && computed.position !== 'absolute' && element.parentElement !== document.body) return false;
        return isEpisodesPopup(element) || discoverMenuItems(element, true).length > 0;
      });
      possible.sort(function (a, b) {
        var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
        return ar.width * ar.height - br.width * br.height;
      });
      found = possible[0] || null;
    }
    if (found) classifyPopup(found);
    return found;
  }

  function clearSelection() {
    if (selected) {
      selected.classList.remove(
        'daitign-tv-player-selected',
        'daitign-tv-player-menu-selected',
        'daitign-tv-player-timeline',
        'daitign-tv-episode-selected'
      );
    }
    selected = null;
  }

  function setSelected(element, nextState) {
    clearSelection();
    selected = controlVisible(element) ? element : null;
    if (!selected) return;
    var resolvedState = nextState || (isTimeline(selected) ? TIMELINE : CONTROLS);
    if (resolvedState === MENU) {
      if (isEpisodeCard(selected)) {
        selected.classList.add('daitign-tv-episode-selected');
      } else {
        selected.classList.add('daitign-tv-player-menu-selected');
      }
      scrollCardIntoView(selected);
    } else {
      selected.classList.add(isTimeline(selected) ? 'daitign-tv-player-timeline' : 'daitign-tv-player-selected');
    }
    try { selected.focus({ preventScroll: true }); } catch (_) {}
    preferredX = center(selected).x;
    if (resolvedState !== MENU) {
      var kind = controlKind(selected);
      lastFocusedControlKind = kind;
      lastFocusedControlLabel = label(selected);
      if (kind !== 'skip-intro') {
        lastStableControlKind = kind;
        lastStableControlLabel = label(selected);
      }
    }
    debugLog('[DAITIGN TV Player] selected', resolvedState === MENU ? (isEpisodeCard(selected) ? 'episode-card' : 'menu-option') : controlKind(selected), label(selected));
    notify(resolvedState);
  }

  function isMenuOpen() {
    return state === MENU || !!(activePopup && visible(activePopup));
  }

  function clearIdleTimer() {
    if (controlsIdleTimer) {
      window.clearTimeout(controlsIdleTimer);
      controlsIdleTimer = 0;
    }
  }

  function getPlayerRoot() {
    return document.querySelector('.art-video-player') ||
           document.querySelector('.relative.h-dvh') ||
           document.querySelector('.h-dvh') ||
           (document.querySelector('video') ? document.querySelector('video').closest('.relative') || document.querySelector('video').parentElement : null) ||
           document.body;
  }

  var hasLoggedSelectors = false;
  function auditPlayerSelectorsOnce() {
    if (hasLoggedSelectors) return;
    var selectors = {
      root: document.querySelector('.art-video-player') ? '.art-video-player' :
            document.querySelector('.relative.h-dvh') ? '.relative.h-dvh' :
            document.querySelector('.h-dvh') ? '.h-dvh' :
            document.querySelector('video') ? 'video.parentElement' : 'none',
      bottomControls: document.querySelector('.art-bottom') ? '.art-bottom' :
                      document.querySelector('.art-controls') ? '.art-controls' :
                      document.querySelector('.z-30 > div:last-child') ? '.z-30 > div:last-child' :
                      document.querySelector('[class*="player-bottom"]') ? '[class*="player-bottom"]' : 'none',
      topControls: document.querySelector('.art-top') ? '.art-top' :
                   document.querySelector('.z-30 > div:first-child') ? '.z-30 > div:first-child' :
                   document.querySelector('button[aria-label="Back"]') ? 'button[aria-label="Back"]' : 'none',
      popupMenu: document.querySelector('.art-settings') ? '.art-settings' :
                 document.querySelector('.art-selector') ? '.art-selector' :
                 document.querySelector('[role="dialog"]') ? '[role="dialog"]' :
                 document.querySelector('[role="menu"]') ? '[role="menu"]' :
                 document.querySelector('[data-radix-popper-content-wrapper]') ? '[data-radix-popper-content-wrapper]' : 'none',
      timeline: document.querySelector('.art-progress') ? '.art-progress' :
                document.querySelector('input[type="range"]') ? 'input[type="range"]' :
                document.querySelector('[role="slider"]') ? '[role="slider"]' :
                document.querySelector('[class*="timeline"]') ? '[class*="timeline"]' : 'none'
    };
    console.log('TV_CONTROL_DISCOVERED: root=' + selectors.root +
                ' bottom=' + selectors.bottomControls +
                ' top=' + selectors.topControls +
                ' popup=' + selectors.popupMenu +
                ' timeline=' + selectors.timeline);
    hasLoggedSelectors = true;
  }

  var targetedObserver = null;
  var observedRoot = null;

  function getLiveElements() {
    var root = getPlayerRoot();
    var overlays = Array.prototype.slice.call(document.querySelectorAll(
      '.z-30, .art-controls, .art-bottom, .art-top, .art-layers, [class*="controls"], [class*="player-bottom"]'
    ));
    var popups = Array.prototype.slice.call(document.querySelectorAll(
      '[role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], .art-settings, .art-selector, .z-50'
    ));
    var targets = [root, document.querySelector('.art-video-player'), document.body, document.documentElement].filter(Boolean);
    return {
      root: root,
      targets: targets,
      overlays: overlays,
      popups: popups
    };
  }

  function ensureControlsVisible() {
    auditPlayerSelectorsOnce();
    hookVideoEvents();
    var live = getLiveElements();
    live.targets.forEach(function (el) {
      el.classList.add('daitign-tv-controls-locked');
    });

    var artPlayer = document.querySelector('.art-video-player');
    if (artPlayer) {
      artPlayer.classList.add('art-hover');
      artPlayer.classList.remove('art-hide-cursor');
    }
    if (live.root && live.root.classList) {
      live.root.classList.remove('cursor-none');
    }

    var controlElements = document.querySelectorAll(
      '.art-controls, .art-control, .art-bottom, .art-top, .art-progress, .art-layers, .z-30, .z-30 > div, [class*="controls"], [class*="player-bottom"], [role="dialog"], [role="menu"], [role="listbox"], [data-radix-popper-content-wrapper], .art-settings, .art-selector'
    );
    controlElements.forEach(function (el) {
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      if (el.style.display === 'none') el.style.removeProperty('display');
    });

    dispatchWakeEvents();
  }

  function dispatchWakeEvents() {
    var targets = [
      document.querySelector('video'),
      getPlayerRoot(),
      document.querySelector('.relative.h-dvh'),
      document.querySelector('.h-dvh'),
      document.querySelector('div:has(> video)'),
      document.querySelector('.art-video-player'),
      document.body,
      document.documentElement,
      document,
      window
    ].filter(Boolean);

    var insets = document.querySelectorAll('div.absolute.inset-0, div.inset-0, [class*="absolute"][class*="inset-0"]');
    for (var k = 0; k < insets.length; k++) {
      if (targets.indexOf(insets[k]) < 0) targets.push(insets[k]);
    }

    var rect = (targets[0] && typeof targets[0].getBoundingClientRect === 'function')
      ? targets[0].getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth || 1920, height: window.innerHeight || 1080 };
    var cx = Math.round(rect.left + rect.width / 2);
    var cy = Math.round(rect.top + rect.height * 0.82);

    var mouseOpts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy,
      buttons: 0
    };

    var pointerOpts = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: cx,
      clientY: cy,
      screenX: cx,
      screenY: cy,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      buttons: 0
    };

    for (var i = 0; i < targets.length; i++) {
      var t = targets[i];
      try {
        if (typeof PointerEvent === 'function') {
          t.dispatchEvent(new PointerEvent('pointerenter', pointerOpts));
          t.dispatchEvent(new PointerEvent('pointermove', pointerOpts));
        }
        t.dispatchEvent(new MouseEvent('mouseenter', mouseOpts));
        t.dispatchEvent(new MouseEvent('mousemove', mouseOpts));
      } catch (_) {}
    }
  }

  function pokePlayerActive() {
    dispatchWakeEvents();
  }

  function applyVisibilityLock() {
    ensureControlsVisible();
  }

  function removeVisibilityLock() {
    var live = getLiveElements();
    live.targets.forEach(function (el) {
      el.classList.remove('daitign-tv-controls-locked');
    });
    var artPlayer = document.querySelector('.art-video-player');
    if (artPlayer) {
      artPlayer.classList.remove('art-hover');
    }
    var controlElements = document.querySelectorAll(
      '.art-controls, .art-control, .art-bottom, .art-top, .art-progress, .art-layers, .z-30, .z-30 > div, [class*="controls"], [class*="player-bottom"]'
    );
    controlElements.forEach(function (el) {
      el.style.removeProperty('opacity');
      el.style.removeProperty('visibility');
      el.style.removeProperty('pointer-events');
    });
  }

  function installReplacementObserver() {
    var ancestor = getPlayerRoot() || document.body;
    if (!ancestor) return;
    if (replacementObserver && observedAncestor === ancestor) return;
    if (replacementObserver) {
      try { replacementObserver.disconnect(); } catch (_) {}
    }
    observedAncestor = ancestor;
    replacementObserver = new MutationObserver(function (mutations) {
      candidatesDirty = true;
      menuCandidatesDirty = true;
      if (state === HIDDEN) return;

      var hasChildChanges = false;
      var needsRestore = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.type === 'childList') {
          hasChildChanges = true;
        } else if (m.type === 'attributes') {
          var el = m.target;
          if (el.classList && (el.classList.contains('art-hide-cursor') || el.classList.contains('cursor-none') || !ancestor.classList.contains('daitign-tv-controls-locked'))) {
            needsRestore = true;
          } else if (m.attributeName === 'style') {
            var s = el.style;
            if (s && (s.opacity === '0' || s.visibility === 'hidden' || s.display === 'none')) {
              needsRestore = true;
            }
          }
        }
      }

      if (hasChildChanges || needsRestore || !document.documentElement.classList.contains('daitign-tv-controls-locked')) {
        ensureControlsVisible();
        if (selected && (!selected.isConnected || !controlVisible(selected))) {
          relinkSelection();
        }
      }
    });

    replacementObserver.observe(ancestor, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'aria-hidden']
    });
  }

  function ensureTargetedObserver() {
    installReplacementObserver();
  }

  function relinkSelection() {
    var previousKind = selected ? controlKind(selected) : lastFocusedControlKind;
    var previousLabel = selected ? label(selected) : lastFocusedControlLabel;
    candidatesDirty = true;
    var currentCandidates = candidates(true);
    var matched = null;
    if (previousLabel && previousKind !== 'skip-intro') {
      matched = currentCandidates.find(function (c) { return label(c) === previousLabel; });
    }
    if (!matched && previousKind && previousKind !== 'skip-intro') {
      matched = currentCandidates.find(function (c) { return controlKind(c) === previousKind; });
    }
    if (matched && controlVisible(matched)) {
      setSelected(matched, state === MENU ? MENU : (isTimeline(matched) ? TIMELINE : CONTROLS));
    } else {
      focusDefault(0);
    }
  }

  function startVisibilityWatchdog() {
    stopVisibilityWatchdog();
    watchdogTimer = window.setInterval(function () {
      if (state === HIDDEN) {
        stopVisibilityWatchdog();
        return;
      }
      var live = getLiveElements();
      var needsEnforce = !document.documentElement.classList.contains('daitign-tv-controls-locked') ||
                         (live.root && !live.root.classList.contains('daitign-tv-controls-locked'));
      if (!needsEnforce) {
        for (var i = 0; i < live.overlays.length; i++) {
          var ov = live.overlays[i];
          if (ov.style.opacity === '0' || ov.style.visibility === 'hidden' || ov.style.display === 'none') {
            needsEnforce = true;
            break;
          }
        }
      }
      if (needsEnforce || live.overlays.length === 0) {
        ensureControlsVisible();
      }
      if (selected && (!selected.isConnected || !controlVisible(selected))) {
        relinkSelection();
      }
      pokePlayerActive();
    }, WATCHDOG_INTERVAL_MS);
  }

  function stopVisibilityWatchdog() {
    if (watchdogTimer) {
      window.clearInterval(watchdogTimer);
      watchdogTimer = 0;
    }
  }

  function startKeepAliveHeartbeat() {
    stopKeepAliveHeartbeat();
    keepAliveHeartbeatTimer = window.setInterval(function () {
      if (state === HIDDEN) {
        stopKeepAliveHeartbeat();
        return;
      }
      dispatchWakeEvents();
      ensureControlsVisible();
    }, 500);
  }

  function stopKeepAliveHeartbeat() {
    if (keepAliveHeartbeatTimer) {
      window.clearInterval(keepAliveHeartbeatTimer);
      keepAliveHeartbeatTimer = 0;
    }
  }

  function startMenuKeepAlive() {}
  function stopMenuKeepAlive() {}

  function revealControlsUI() {
    lastControlRevealAt = Date.now();
    ensureControlsVisible();
  }

  function isVideoPaused() {
    var video = primaryVideo();
    return !!(video && video.paused && !video.ended);
  }

  function hookVideoEvents() {
    var videos = Array.prototype.slice.call(document.querySelectorAll('video'));
    videos.forEach(function (v) {
      if (v._tvHooked) return;
      v._tvHooked = true;
      v.addEventListener('play', function () {
        if (state === CONTROLS) {
          resetControlsIdleTimer();
        }
      });
      v.addEventListener('pause', function () {
        clearIdleTimer();
      });
    });
  }

  function resetControlsIdleTimer() {
    clearIdleTimer();
    idleGeneration++;
    var currentGen = idleGeneration;

    // Never auto-hide during menu selection (Section 3)
    if (state === MENU || isMenuOpen() || detectPopup()) {
      return;
    }
    // Never auto-hide during timeline interaction (Section 4, 11)
    if (state === TIMELINE) {
      return;
    }
    // Never auto-hide if already hidden
    if (state === HIDDEN) {
      return;
    }
    // Video paused: keep controls visible (Section 14)
    if (isVideoPaused()) {
      return;
    }

    controlsIdleTimer = window.setTimeout(function () {
      controlsIdleTimer = 0;
      // Stale timer verification (Section 11)
      if (currentGen !== idleGeneration) return;
      // Must still be in CONTROLS state
      if (state !== CONTROLS) return;
      // Re-verify no menu or popup is open (Section 3, 11, 12)
      if (isMenuOpen() || detectPopup()) return;
      // Re-verify not paused (Section 14)
      if (isVideoPaused()) return;

      hideControls();
    }, PLAYER_CONTROLS_IDLE_MS);
  }

  function registerUserActivity() {
    ensureControlsVisible();
    installReplacementObserver();
    resetControlsIdleTimer();
  }

  function scheduleControlsIdle() {
    registerUserActivity();
  }

  function showControls() {
    registerUserActivity();
  }

  function hideControls() {
    // Never hide if a menu or submenu popup is open
    if (isMenuOpen() || detectPopup()) return;
    if (state === TIMELINE) return;
    if (isVideoPaused()) return;

    if (selected && state !== MENU) {
      var k = controlKind(selected);
      lastFocusedControlKind = k;
      lastFocusedControlLabel = label(selected);
      if (k !== 'skip-intro') {
        lastStableControlKind = k;
        lastStableControlLabel = label(selected);
      }
    }
    clearIdleTimer();
    stopKeepAliveHeartbeat();
    stopVisibilityWatchdog();
    var focused = document.activeElement;
    if (focused && focused !== document.body && typeof focused.blur === 'function') focused.blur();
    clearSelection();
    notify(HIDDEN);
  }

  function primaryVideo() {
    return Array.prototype.slice.call(document.querySelectorAll('video')).find(visible) || document.querySelector('video');
  }

  function playPauseControl() {
    return candidates(true).find(function (element) { return controlKind(element) === 'play-pause'; }) || null;
  }

  function setPlayback(command) {
    registerUserActivity();
    var video = primaryVideo();
    if (video) {
      if (command === 'PLAY' || (command === 'PLAY_PAUSE' && video.paused)) {
        var promise = video.play();
        if (promise && typeof promise.catch === 'function') promise.catch(function () {});
      } else if (command === 'PAUSE' || command === 'PLAY_PAUSE') video.pause();
      debugLog('[DAITIGN TV Player] media command ' + command + ' handled by video');
      registerUserActivity();
      return true;
    }
    var control = playPauseControl();
    if (!control) return false;
    control.click();
    debugLog('[DAITIGN TV Player] media command ' + command + ' handled by play control');
    registerUserActivity();
    return true;
  }

  function seekPlayback(direction, repeated) {
    registerUserActivity();
    var forward = direction === 'SEEK_FORWARD' || direction === 'SEEK_FORWARD_REPEAT';
    var seconds = (repeated ? 5 : 10) * (forward ? 1 : -1);
    var video = primaryVideo();
    if (video && isFinite(video.duration)) {
      video.currentTime = Math.max(0, Math.min(video.duration || Infinity, video.currentTime + seconds));
      debugLog('[DAITIGN TV Player] media seek ' + seconds + ' seconds');
      registerUserActivity();
      return true;
    }
    var timeline = candidates(true).find(isTimeline);
    if (!timeline) return false;
    dispatchKey(timeline, seconds > 0 ? 'ArrowRight' : 'ArrowLeft');
    registerUserActivity();
    return true;
  }

  function suspendPlayback() {
    var video = primaryVideo();
    wasPlayingBeforeSuspend = !!(video && !video.paused && !video.ended);
    if (video) video.pause();
    hideControls();
    debugLog('[DAITIGN TV Player] suspended; wasPlaying=' + wasPlayingBeforeSuspend);
    return true;
  }

  function resumePlayback() {
    // Resume with playback paused. The next Select or Play/Pause action is an
    // intentional user gesture and avoids surprise audio after Fire TV wake.
    showControls();
    debugLog('[DAITIGN TV Player] resumed; playback remains paused');
    return true;
  }

  function defaultControl(all) {
    var semantic = all.find(function (element) { return controlKind(element) === 'play-pause'; });
    if (semantic) return semantic;
    var controlRows = rows(all.filter(function (element) { return !isTimeline(element); }));
    var bottomRow = controlRows[controlRows.length - 1];
    return bottomRow ? bottomRow.elements[0] : null;
  }

  function inventory(logResults) {
    var all = candidates(true);
    var grouped = rows(all);
    var result = all.map(function (element) {
      var rect = element.getBoundingClientRect();
      return {
        kind: controlKind(element), label: label(element), tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || '',
        group: grouped.findIndex(function (row) { return row.elements.indexOf(element) >= 0; }),
        rect: { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }
      };
    });
    result.forEach(function (control) {
      console.log('TV_CONTROL_DISCOVERED: kind=' + control.kind + ' label=' + control.label);
    });
    if (logResults) result.forEach(function (control) { debugLog('[DAITIGN TV Player] control', JSON.stringify(control)); });
    return result;
  }

  function findRememberedOrFallbackControl(all) {
    var target = null;
    if (lastFocusedControlLabel && lastFocusedControlKind !== 'skip-intro') {
      target = all.find(function (el) { return label(el) === lastFocusedControlLabel && controlVisible(el); });
    }
    if (!target && lastFocusedControlKind && lastFocusedControlKind !== 'skip-intro') {
      target = all.find(function (el) { return controlKind(el) === lastFocusedControlKind && controlVisible(el); });
    }
    if (!target && lastStableControlLabel) {
      target = all.find(function (el) { return label(el) === lastStableControlLabel && controlVisible(el); });
    }
    if (!target && lastStableControlKind) {
      target = all.find(function (el) { return controlKind(el) === lastStableControlKind && controlVisible(el); });
    }
    if (!target) {
      target = all.find(function (el) { return controlKind(el) === 'play-pause' && controlVisible(el); }) || defaultControl(all);
    }
    return target;
  }

  function wakeAndFocusControls() {
    dispatchWakeEvents();
    notify(CONTROLS);
    ensureControlsVisible();

    candidatesDirty = true;
    var all = candidates(true);
    var target = findRememberedOrFallbackControl(all);

    if (target && controlVisible(target)) {
      setSelected(target, CONTROLS);
      ensureControlsVisible();
      resetControlsIdleTimer();
      return true;
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        ensureControlsVisible();
        candidatesDirty = true;
        var rAll = candidates(true);
        var rTarget = findRememberedOrFallbackControl(rAll);
        if (rTarget) {
          setSelected(rTarget, CONTROLS);
          ensureControlsVisible();
          resetControlsIdleTimer();
        } else {
          window.setTimeout(function () {
            ensureControlsVisible();
            candidatesDirty = true;
            var tAll = candidates(true);
            var tTarget = findRememberedOrFallbackControl(tAll);
            if (tTarget) {
              setSelected(tTarget, CONTROLS);
              ensureControlsVisible();
              resetControlsIdleTimer();
            }
          }, 30);
        }
      });
    }

    resetControlsIdleTimer();
    return true;
  }

  function focusDefault(attempt) {
    return wakeAndFocusControls();
  }

  function syncEpisodesMenu(popup) {
    var cards = findEpisodeCards(popup);
    if (!cards.length) {
      var fallbackItem = findSeasonSelector(popup) || findCloseButton(popup);
      if (fallbackItem) setSelected(fallbackItem, MENU);
      return;
    }
    var currentCard = findCurrentEpisodeCard(cards);
    var target = currentCard || cards[0];
    setSelected(target, MENU);
    scrollCardIntoView(target);
  }

  function syncMenu(attempt) {
    attempt = attempt || 0;
    window.clearTimeout(menuSyncTimer);
    window.clearTimeout(controlsIdleTimer);
    controlsIdleTimer = 0;
    menuSyncTimer = window.setTimeout(function () {
      var seasonDropdown = detectSeasonDropdown();
      if (seasonDropdown && visible(seasonDropdown)) {
        activePopup = seasonDropdown;
        var seasonItems = discoverSeasonItems(seasonDropdown);
        if (seasonItems.length) {
          var currentSeason = seasonItems.find(function (item) {
            return item.getAttribute('aria-selected') === 'true' || item.getAttribute('aria-checked') === 'true' || item.classList.contains('active');
          }) || seasonItems[0];
          setSelected(currentSeason, MENU);
          return;
        }
      }

      var popup = detectPopup();
      if (!popup) {
        if (attempt < 8) syncMenu(attempt + 1);
        return;
      }
      activePopup = popup;
      menuCandidatesDirty = false;

      if (isEpisodesPopup(popup)) {
        syncEpisodesMenu(popup);
        return;
      }

      var items = discoverMenuItems(popup, true);
      if (!items.length) {
        if (attempt < 8) syncMenu(attempt + 1);
        return;
      }
      var chosen = items.find(function (item) {
        return item.getAttribute('aria-selected') === 'true' || item.getAttribute('aria-checked') === 'true';
      }) || items[0];
      debugLog('[DAITIGN TV Player] popup open; entering PLAYER_MENU');
      setSelected(chosen, MENU);
    }, attempt === 0 ? 40 : 80);
  }

  function dispatchKey(element, key) {
    ['keydown', 'keyup'].forEach(function (type) {
      element.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: key, code: key }));
    });
  }

  function findGeometricTarget(current, direction, candidateList) {
    if (!current || !candidateList || !candidateList.length) return null;
    var curRect = current.getBoundingClientRect();
    var curCenter = center(current);
    var best = null;
    var bestDist = Infinity;

    for (var i = 0; i < candidateList.length; i++) {
      var item = candidateList[i];
      if (item === current || !controlVisible(item)) continue;
      if (!isTimeline(current) && (direction === 'LEFT' || direction === 'RIGHT') && isTimeline(item)) continue;
      var itemRect = item.getBoundingClientRect();
      var itemCenter = center(item);

      var dx = itemCenter.x - curCenter.x;
      var dy = itemCenter.y - curCenter.y;

      var isValid = false;
      var primary = 0;
      var secondary = 0;

      if (direction === 'LEFT') {
        if (itemCenter.x < curCenter.x - 2 || itemRect.right <= curRect.left + 5) {
          isValid = true;
          primary = curCenter.x - itemCenter.x;
          secondary = Math.abs(dy);
        }
      } else if (direction === 'RIGHT') {
        if (itemCenter.x > curCenter.x + 2 || itemRect.left >= curRect.right - 5) {
          isValid = true;
          primary = itemCenter.x - curCenter.x;
          secondary = Math.abs(dy);
        }
      } else if (direction === 'UP') {
        if (itemCenter.y < curCenter.y - 2 || itemRect.bottom <= curRect.top + 5) {
          isValid = true;
          primary = curCenter.y - itemCenter.y;
          secondary = Math.abs(dx);
        }
      } else if (direction === 'DOWN') {
        if (itemCenter.y > curCenter.y + 2 || itemRect.top >= curRect.bottom - 5) {
          isValid = true;
          primary = itemCenter.y - curCenter.y;
          secondary = Math.abs(dx);
        }
      }

      if (isValid && primary > 0) {
        var dist = primary + secondary * 1.5;
        if (dist < bestDist) {
          bestDist = dist;
          best = item;
        }
      }
    }
    return best;
  }

  function moveControl(direction) {
    registerUserActivity();
    var all = candidates(false);
    if (!selected || !controlVisible(selected) || all.indexOf(selected) < 0) { focusDefault(0); return; }
    var grouped = rows(all);
    var rowIndex = grouped.findIndex(function (row) { return row.elements.indexOf(selected) >= 0; });
    if (rowIndex < 0) { focusDefault(0); return; }
    var row = grouped[rowIndex];
    var index = row.elements.indexOf(selected);
    var target = null;
    if (direction === 'LEFT' || direction === 'RIGHT') {
      target = row.elements[index + (direction === 'RIGHT' ? 1 : -1)] || null;
    } else {
      var nextRow = grouped[rowIndex + (direction === 'DOWN' ? 1 : -1)];
      if (nextRow) {
        var x = preferredX == null ? center(selected).x : preferredX;
        target = nextRow.elements.reduce(function (best, item) {
          return !best || Math.abs(center(item).x - x) < Math.abs(center(best).x - x) ? item : best;
        }, null);
      }
    }
    if (!target) {
      target = findGeometricTarget(selected, direction, all);
    }
    if (target) {
      setSelected(target);
      registerUserActivity();
    }
  }

  function findClosestByX(elements, targetX) {
    if (!elements || !elements.length) return null;
    return elements.reduce(function (best, item) {
      if (!best) return item;
      return Math.abs(center(item).x - targetX) < Math.abs(center(best).x - targetX) ? item : best;
    }, null);
  }

  function navigateEpisodes(direction) {
    registerUserActivity();
    var popup = activePopup || detectPopup();
    if (!popup || !visible(popup)) { syncMenu(0); return; }
    activePopup = popup;

    var cards = findEpisodeCards(popup);
    var seasonBtn = findSeasonSelector(popup);
    var showMoreBtn = findShowMoreButton(popup);
    var closeBtn = findCloseButton(popup);

    var gridRows = rows(cards);

    if (selected === seasonBtn) {
      if (direction === 'DOWN') {
        if (gridRows.length > 0) {
          var row0 = gridRows[0].elements;
          var targetCard = findClosestByX(row0, center(seasonBtn).x);
          if (targetCard) {
            setSelected(targetCard, MENU);
            scrollCardIntoView(targetCard);
          }
        }
      }
      return;
    }

    if (selected === showMoreBtn) {
      if (direction === 'UP') {
        if (gridRows.length > 0) {
          var lastRow = gridRows[gridRows.length - 1].elements;
          var targetUp = findClosestByX(lastRow, center(showMoreBtn).x);
          if (targetUp) {
            setSelected(targetUp, MENU);
            scrollCardIntoView(targetUp);
          }
        }
      } else if (direction === 'DOWN') {
        if (closeBtn && visible(closeBtn)) {
          setSelected(closeBtn, MENU);
          scrollCardIntoView(closeBtn);
        }
      }
      return;
    }

    if (selected === closeBtn) {
      if (direction === 'UP') {
        if (showMoreBtn && visible(showMoreBtn)) {
          setSelected(showMoreBtn, MENU);
          scrollCardIntoView(showMoreBtn);
        } else if (gridRows.length > 0) {
          var lastRowElements = gridRows[gridRows.length - 1].elements;
          var targetCardUp = findClosestByX(lastRowElements, center(closeBtn).x);
          if (targetCardUp) {
            setSelected(targetCardUp, MENU);
            scrollCardIntoView(targetCardUp);
          }
        }
      }
      return;
    }

    var curRowIndex = -1;
    var curColIndex = -1;
    for (var r = 0; r < gridRows.length; r++) {
      var cIdx = gridRows[r].elements.indexOf(selected);
      if (cIdx >= 0) {
        curRowIndex = r;
        curColIndex = cIdx;
        break;
      }
    }

    if (curRowIndex < 0) {
      var defaultTarget = (cards.length > 0 ? cards[0] : seasonBtn) || closeBtn;
      if (defaultTarget) {
        setSelected(defaultTarget, MENU);
        scrollCardIntoView(defaultTarget);
      }
      return;
    }

    var currentRow = gridRows[curRowIndex];

    if (direction === 'LEFT') {
      if (curColIndex > 0) {
        var nextLeft = currentRow.elements[curColIndex - 1];
        setSelected(nextLeft, MENU);
        scrollCardIntoView(nextLeft);
      }
    } else if (direction === 'RIGHT') {
      if (curColIndex < currentRow.elements.length - 1) {
        var nextRight = currentRow.elements[curColIndex + 1];
        setSelected(nextRight, MENU);
        scrollCardIntoView(nextRight);
      }
    } else if (direction === 'UP') {
      if (curRowIndex > 0) {
        var prevRow = gridRows[curRowIndex - 1].elements;
        var targetAbove = findClosestByX(prevRow, center(selected).x);
        if (targetAbove) {
          setSelected(targetAbove, MENU);
          scrollCardIntoView(targetAbove);
        }
      } else {
        if (seasonBtn && visible(seasonBtn)) {
          setSelected(seasonBtn, MENU);
          scrollCardIntoView(seasonBtn);
        }
      }
    } else if (direction === 'DOWN') {
      if (curRowIndex < gridRows.length - 1) {
        var nextRow = gridRows[curRowIndex + 1].elements;
        var targetBelow = findClosestByX(nextRow, center(selected).x);
        if (targetBelow) {
          setSelected(targetBelow, MENU);
          scrollCardIntoView(targetBelow);
        }
      } else {
        if (showMoreBtn && visible(showMoreBtn)) {
          setSelected(showMoreBtn, MENU);
          scrollCardIntoView(showMoreBtn);
        } else if (closeBtn && visible(closeBtn)) {
          setSelected(closeBtn, MENU);
          scrollCardIntoView(closeBtn);
        }
      }
    }
  }

  function moveSeasonMenu(direction) {
    registerUserActivity();
    var dropdown = detectSeasonDropdown();
    if (!dropdown || !visible(dropdown)) return;
    var items = discoverSeasonItems(dropdown);
    if (!items.length) return;
    var index = items.indexOf(selected);
    if (index < 0) index = 0;
    var next = Math.max(0, Math.min(items.length - 1, index + (direction === 'DOWN' ? 1 : -1)));
    setSelected(items[next], MENU);
    registerUserActivity();
  }

  function activateSeasonItem() {
    registerUserActivity();
    var item = selected;
    if (!item) return;
    try { item.focus({ preventScroll: true }); } catch (_) {}
    item.click();
    pointerFallback(item);
    window.setTimeout(function () {
      var popup = detectPopup();
      if (popup && isEpisodesPopup(popup)) {
        activePopup = popup;
        syncEpisodesMenu(popup);
      } else {
        finishMenuClose();
      }
    }, 120);
  }

  function closeSeasonDropdown(dropdown) {
    registerUserActivity();
    if (dropdown) {
      dispatchKey(dropdown, 'Escape');
      try { dropdown.style.setProperty('display', 'none', 'important'); } catch (_) {}
    }
    dispatchKey(document.body, 'Escape');
    var popup = detectPopup();
    var seasonBtn = popup ? findSeasonSelector(popup) : null;
    if (seasonBtn) {
      try { seasonBtn.click(); } catch (_) {}
    }
    window.setTimeout(function () {
      if (popup && isEpisodesPopup(popup)) {
        activePopup = popup;
        if (seasonBtn && visible(seasonBtn)) {
          setSelected(seasonBtn, MENU);
        } else {
          syncEpisodesMenu(popup);
        }
      } else {
        finishMenuClose();
      }
    }, 60);
  }

  function moveMenu(direction) {
    registerUserActivity();
    if (!activePopup || !visible(activePopup)) { syncMenu(0); return; }
    var items = discoverMenuItems(activePopup, false);
    if (!items.length) { syncMenu(0); return; }
    var index = items.indexOf(selected);
    if (index < 0) index = 0;
    var next = Math.max(0, Math.min(items.length - 1, index + (direction === 'DOWN' ? 1 : -1)));
    setSelected(items[next], MENU);
    registerUserActivity();
  }

  function pointerFallback(element) {
    var point = center(element);
    var options = { bubbles: true, cancelable: true, clientX: point.x, clientY: point.y, pointerType: 'mouse' };
    if (typeof PointerEvent === 'function') {
      element.dispatchEvent(new PointerEvent('pointerdown', options));
      element.dispatchEvent(new PointerEvent('pointerup', options));
    }
    element.dispatchEvent(new MouseEvent('mousedown', options));
    element.dispatchEvent(new MouseEvent('mouseup', options));
    element.dispatchEvent(new MouseEvent('click', options));
    debugLog('[DAITIGN TV Player] menu activation pointer fallback:', label(element));
  }

  function selectionSignature(element) {
    return [element.className, element.getAttribute('aria-selected'), element.getAttribute('aria-checked'), element.getAttribute('data-state')].join('|');
  }

  function dismissPopup(popup) {
    if (!popup) return;
    var closeBtn = findCloseButton(popup) || discoverMenuItems(popup, false).find(function (element) {
      return /^(close|back|done|exit)$/i.test(label(element));
    });
    if (closeBtn) {
      try { closeBtn.click(); pointerFallback(closeBtn); } catch (_) {}
    }
    dispatchKey(popup, 'Escape');
    if (document.activeElement && document.activeElement !== document.body) {
      try { dispatchKey(document.activeElement, 'Escape'); } catch (_) {}
    }
    dispatchKey(document.body, 'Escape');
    dispatchKey(document.documentElement, 'Escape');
    var overlay = document.querySelector('[data-vaul-overlay], [data-slot*="drawer-overlay"], .art-mask, .art-layers');
    if (overlay && visible(overlay)) {
      try { pointerFallback(overlay); } catch (_) {}
    }
    window.setTimeout(function () {
      if (visible(popup)) {
        try {
          popup.style.setProperty('display', 'none', 'important');
          popup.style.setProperty('visibility', 'hidden', 'important');
          popup.setAttribute('aria-hidden', 'true');
        } catch (_) {}
        var wrapper = typeof popup.closest === 'function' ? popup.closest('[data-slot*="drawer"], [data-vaul-drawer-wrapper], [data-vaul-drawer], [role="dialog"], [aria-modal="true"]') : null;
        if (wrapper && wrapper !== document.body) {
          try {
            wrapper.style.setProperty('display', 'none', 'important');
            wrapper.style.setProperty('visibility', 'hidden', 'important');
          } catch (_) {}
        }
      }
    }, 40);
  }

  function activateMenuItem() {
    registerUserActivity();
    if (!selected || !activePopup || !activePopup.contains(selected) || !visible(selected)) { syncMenu(0); return; }
    var item = selected;
    var popupBefore = activePopup;
    var seasonBtn = findSeasonSelector(popupBefore);
    var showMoreBtn = findShowMoreButton(popupBefore);
    var closeBtn = findCloseButton(popupBefore);

    if (item === seasonBtn) {
      try { item.focus({ preventScroll: true }); } catch (_) {}
      item.click();
      pointerFallback(item);
      window.setTimeout(function () {
        syncMenu(0);
      }, 60);
      return;
    }

    if (item === showMoreBtn) {
      try { item.focus({ preventScroll: true }); } catch (_) {}
      item.click();
      pointerFallback(item);
      window.setTimeout(function () {
        if (isEpisodesPopup(popupBefore)) {
          syncEpisodesMenu(popupBefore);
        }
      }, 100);
      return;
    }

    if (item === closeBtn) {
      dismissPopup(popupBefore);
      window.setTimeout(function () {
        finishMenuClose();
      }, 50);
      return;
    }

    if (isEpisodeCard(item)) {
      try { item.focus({ preventScroll: true }); } catch (_) {}
      item.click();
      pointerFallback(item);
      debugLog('[DAITIGN TV Player] episode card clicked:', label(item));
      window.setTimeout(function () {
        dismissPopup(popupBefore);
        window.setTimeout(function () {
          finishMenuClose();
        }, 50);
      }, 80);
      return;
    }

    var itemText = label(item);
    var openerText = (controlKind(menuOpener) + ' ' + label(menuOpener)).toLowerCase();
    var popupHeader = ((typeof popupBefore.querySelector === 'function' ? popupBefore.querySelector('h1, h2, h3, [class*="title"], [class*="header"]') : null) || {}).textContent || '';
    var isSubmenuNavigation = /style|delay|speed|audio|font|color|custom|subtitle style|subtitle delay|settings/i.test(itemText) ||
                              /subtitle style|subtitle delay|delay|advanced/i.test(popupHeader);
    var singleChoiceMenu = !isSubmenuNavigation && (
      isSingleChoiceOption(item, popupBefore, menuOpener) ||
      /subtitle|caption|quality|server|source|fit|aspect/i.test(openerText) ||
      /english|filipino|tagalog|español|spanish|french|german|japanese|korean|chinese|italian|portuguese|russian|arabic|thai|vietnamese|indonesian|malay|hindi|off|none|auto|1080p?|720p?|480p?|360p?|16:9|4:3|cover|contain/i.test(itemText)
    );
    var before = selectionSignature(item);
    try { item.focus({ preventScroll: true }); } catch (_) {}
    item.click();
    pointerFallback(item);
    debugLog('[DAITIGN TV Player] menu option click:', label(item), 'singleChoice=' + singleChoiceMenu);

    window.setTimeout(function () {
      if (visible(popupBefore) && popupBefore.contains(item) && selectionSignature(item) === before) pointerFallback(item);
      menuCandidatesDirty = true;
      window.setTimeout(function () {
        if (singleChoiceMenu) {
          debugLog('[DAITIGN TV Player] single-choice option activated; closing popup');
          dismissPopup(popupBefore);
          window.setTimeout(function () {
            if (visible(popupBefore)) {
              try {
                popupBefore.style.setProperty('display', 'none', 'important');
                popupBefore.style.setProperty('visibility', 'hidden', 'important');
              } catch (_) {}
            }
            window.setTimeout(function () {
              if (!visible(popupBefore)) {
                finishMenuClose();
              } else {
                syncMenu(0);
              }
            }, 30);
          }, 50);
          return;
        }

        if (visible(popupBefore)) {
          activePopup = popupBefore;
          clearIdleTimer();
          var items = discoverMenuItems(popupBefore, true);
          var chosen = items.find(function (option) {
            return option.getAttribute('aria-selected') === 'true' || option.getAttribute('aria-checked') === 'true';
          }) || (visible(item) ? item : items[0]);
          if (chosen) setSelected(chosen, MENU);
        } else {
          finishMenuClose();
        }
      }, singleChoiceMenu ? 40 : 80);
    }, singleChoiceMenu ? 40 : 80);
  }

  function activateControl() {
    registerUserActivity();
    if (!selected || !visible(selected)) { focusDefault(0); return; }
    menuOpener = selected;
    var openerKind = controlKind(selected);
    try { selected.focus({ preventScroll: true }); } catch (_) {}
    selected.click();
    if (openerKind === 'skip-intro') {
      try { pointerFallback(selected); } catch (_) {}
    }
    candidatesDirty = true;
    menuCandidatesDirty = true;
    if (/subtitle|quality|server|settings|fit|volume|episode/.test(openerKind)) {
      clearIdleTimer();
      notify(MENU);
      startMenuKeepAlive();
      syncMenu(0);
    } else if (openerKind === 'skip-intro') {
      registerUserActivity();
      window.setTimeout(function () {
        candidatesDirty = true;
        var curCandidates = candidates(true);
        if (selected && controlVisible(selected) && curCandidates.indexOf(selected) >= 0) {
          registerUserActivity();
        } else {
          focusDefault(0);
        }
      }, 100);
    } else {
      window.setTimeout(function () {
        var popup = detectPopup();
        if (popup) {
          clearIdleTimer();
          notify(MENU);
          startMenuKeepAlive();
          syncMenu(0);
        } else {
          if (visible(menuOpener)) setSelected(menuOpener, CONTROLS);
          registerUserActivity();
        }
      }, 90);
    }
  }

  function finishMenuClose() {
    stopMenuKeepAlive();
    activePopup = null;
    menuCandidateCache = [];
    menuCandidatesDirty = true;
    window.clearTimeout(menuSyncTimer);
    var openerToFocus = null;
    if (menuOpener && controlVisible(menuOpener)) {
      openerToFocus = menuOpener;
    } else if (menuOpener) {
      var k = controlKind(menuOpener);
      var l = label(menuOpener);
      var currentCandidates = candidates(true);
      openerToFocus = currentCandidates.find(function (c) { return label(c) === l; }) ||
                      currentCandidates.find(function (c) { return controlKind(c) === k; });
    }
    if (openerToFocus && controlVisible(openerToFocus)) {
      setSelected(openerToFocus, CONTROLS);
    } else {
      focusDefault(0);
    }
    registerUserActivity();
  }

  function closeMenu() {
    if (state !== MENU && !detectPopup()) return false;
    var popupBefore = activePopup || detectPopup();
    if (!popupBefore || !visible(popupBefore)) {
      finishMenuClose();
      return true;
    }

    var close = findCloseButton(popupBefore) || discoverMenuItems(popupBefore, false).find(function (element) { return /^(close|back|done)$/i.test(label(element)); });
    if (close) {
      try { close.click(); pointerFallback(close); } catch (_) {}
    }
    if (selected) dispatchKey(selected, 'Escape');
    dispatchKey(popupBefore, 'Escape');
    dispatchKey(document.body, 'Escape');
    dispatchKey(document.documentElement, 'Escape');
    var overlay = document.querySelector('[data-vaul-overlay], [data-slot*="drawer-overlay"], .art-mask, .art-layers');
    if (overlay && visible(overlay)) {
      try { pointerFallback(overlay); } catch (_) {}
    }

    window.setTimeout(function () {
      if (!visible(popupBefore)) {
        finishMenuClose();
        return;
      }
      dismissPopup(popupBefore);
      window.setTimeout(function () {
        if (!visible(popupBefore)) {
          finishMenuClose();
          return;
        }
        try {
          popupBefore.style.setProperty('display', 'none', 'important');
          popupBefore.style.setProperty('visibility', 'hidden', 'important');
          popupBefore.setAttribute('aria-hidden', 'true');
        } catch (_) {}
        window.setTimeout(function () {
          if (!visible(popupBefore)) {
            finishMenuClose();
            return;
          }
          activePopup = popupBefore;
          clearIdleTimer();
          startMenuKeepAlive();
          menuCandidatesDirty = true;
          var items = discoverMenuItems(popupBefore, true);
          if (items[0]) setSelected(items[0], MENU);
          console.warn('[DAITIGN TV Player] popup remains open; Back will retry close');
        }, 40);
      }, 50);
    }, 50);
    return true;
  }

  var observer = new MutationObserver(function () {
    candidatesDirty = true;
    menuCandidatesDirty = true;
    if (state !== MENU) return;
    if (state === MENU && (!activePopup || !visible(activePopup))) {
      finishMenuClose();
      return;
    }
    if (state === MENU && activePopup && visible(activePopup)) {
      clearIdleTimer();
      window.clearTimeout(menuSyncTimer);
      menuSyncTimer = window.setTimeout(function () {
        if (isEpisodesPopup(activePopup)) {
          var cards = findEpisodeCards(activePopup);
          var seasonBtn = findSeasonSelector(activePopup);
          var closeBtn = findCloseButton(activePopup);
          if (selected && (cards.indexOf(selected) >= 0 || selected === seasonBtn || selected === closeBtn)) {
            setSelected(selected, MENU);
          } else {
            syncEpisodesMenu(activePopup);
          }
          return;
        }
        var items = discoverMenuItems(activePopup, true);
        if (selected && items.indexOf(selected) >= 0) setSelected(selected, MENU);
        else if (items[0]) setSelected(items[0], MENU);
      }, 50);
    }
  });
  observer.observe(document.documentElement, {
    subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'hidden', 'disabled', 'aria-hidden', 'aria-selected', 'aria-checked', 'role']
  });

  window.DAITIGN_TV_PLAYER = {
    getState: function () {
      if (state === MENU && (!activePopup || !visible(activePopup))) {
        finishMenuClose();
      }
      return state;
    },
    activity: registerUserActivity,
    ensureVisible: function () {
      if (state === HIDDEN || !selected || !controlVisible(selected)) {
        return wakeAndFocusControls();
      }
      ensureControlsVisible();
      return true;
    },
    resume: resumePlayback,
    suspend: suspendPlayback,
    wake: function () { return wakeAndFocusControls(); },
    handle: function (key) {
      if (key === 'BACK') {
        if (state === MENU) {
          var seasonDropdown = detectSeasonDropdown();
          if (seasonDropdown && visible(seasonDropdown)) {
            closeSeasonDropdown(seasonDropdown);
            return true;
          }
          if (activePopup && visible(activePopup)) {
            var backBtn = findSubmenuBackButton(activePopup);
            if (backBtn && visible(backBtn)) {
              try { backBtn.click(); pointerFallback(backBtn); } catch (_) {}
              window.setTimeout(function () {
                syncMenu(0);
              }, 60);
              return true;
            }
          }
        }
        if (state === MENU) { closeMenu(); return true; }
        if (state === TIMELINE) {
          var control = defaultControl(candidates(true));
          if (control) setSelected(control, CONTROLS);
          else notify(CONTROLS);
          registerUserActivity();
          return true;
        }
        if (state !== HIDDEN) {
          var remainingPopup = detectPopup();
          if (remainingPopup && visible(remainingPopup)) {
            closeMenu();
            return true;
          }
          hideControls();
          return true;
        }
        return false;
      }
      var wasHidden = (state === HIDDEN || !selected || !controlVisible(selected));
      if (wasHidden) {
        wakeAndFocusControls();
      }
      ensureControlsVisible();
      registerUserActivity();
      if (key === 'PLAY_PAUSE' || key === 'PLAY' || key === 'PAUSE') return setPlayback(key);
      if (key === 'SEEK_BACKWARD' || key === 'SEEK_FORWARD') return seekPlayback(key, false);
      if (key === 'SEEK_BACKWARD_REPEAT' || key === 'SEEK_FORWARD_REPEAT') return seekPlayback(key, true);
      if (state === MENU) {
        var seasonDropdown = detectSeasonDropdown();
        if (seasonDropdown && visible(seasonDropdown)) {
          if (key === 'UP' || key === 'DOWN') { moveSeasonMenu(key); return true; }
          if (key === 'OK') { activateSeasonItem(); return true; }
          return true;
        }
        if (!activePopup || !visible(activePopup)) { finishMenuClose(); return true; }
        if (isEpisodesPopup(activePopup)) {
          if (key === 'UP' || key === 'DOWN' || key === 'LEFT' || key === 'RIGHT') {
            navigateEpisodes(key);
            return true;
          }
          if (key === 'OK') { activateMenuItem(); return true; }
          return true;
        }
        if (key === 'UP' || key === 'DOWN') { moveMenu(key); return true; }
        if ((key === 'LEFT' || key === 'RIGHT') && selected && isTimeline(selected)) {
          dispatchKey(selected, key === 'LEFT' ? 'ArrowLeft' : 'ArrowRight');
          registerUserActivity();
          return true;
        }
        if (key === 'RIGHT') {
          if (selected && (selected.getAttribute('aria-haspopup') === 'true' || />|›|→/.test(selected.textContent || ''))) {
            activateMenuItem();
            return true;
          }
        }
        if (key === 'LEFT') {
          var backBtn = findSubmenuBackButton(activePopup);
          if (backBtn && visible(backBtn)) {
            try { backBtn.click(); pointerFallback(backBtn); } catch (_) {}
            dispatchKey(activePopup, 'Escape');
            window.setTimeout(function () { syncMenu(0); }, 60);
            return true;
          }
        }
        if (key === 'OK') { activateMenuItem(); return true; }
        return true;
      }
      if (!selected || !controlVisible(selected)) { focusDefault(0); return true; }
      if ((key === 'LEFT' || key === 'RIGHT') && state === TIMELINE) {
        return seekPlayback(key === 'RIGHT' ? 'SEEK_FORWARD' : 'SEEK_BACKWARD', false);
      }
      if (key === 'OK' && state === TIMELINE) {
        var defaultCtrl = defaultControl(candidates(true));
        if (defaultCtrl) setSelected(defaultCtrl, CONTROLS);
        else notify(CONTROLS);
        registerUserActivity();
        return true;
      }
      if (key === 'LEFT' || key === 'RIGHT' || key === 'UP' || key === 'DOWN') { moveControl(key); return true; }
      if (key === 'OK') { activateControl(); return true; }
      return false;
    },
    inventory: function () { return inventory(true); },
    snapshot: function () {
      return {
        state: state,
        selected: selected ? { kind: state === MENU ? (isEpisodeCard(selected) ? 'episode-card' : 'menu-option') : controlKind(selected), label: label(selected) } : null,
        controls: inventory(false),
        menu: activePopup && visible(activePopup) ? (isEpisodesPopup(activePopup) ? findEpisodeCards(activePopup).map(label) : discoverMenuItems(activePopup, false).map(label)) : [],
        lastFocused: lastFocusedControlLabel ? { kind: lastFocusedControlKind, label: lastFocusedControlLabel } : null,
        idleTimerActive: !!controlsIdleTimer
      };
    }
  };
  debugLog('[DAITIGN TV Player] controller ready; document visibility=' + document.visibilityState);
  notify(HIDDEN);
}());
