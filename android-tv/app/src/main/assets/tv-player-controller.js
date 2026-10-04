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
  var watchdogTimer = 0;
  var keepAliveHeartbeatTimer = 0;
  var WATCHDOG_INTERVAL_MS = 180;
  var replacementObserver = null;
  var observedAncestor = null;
  var lastControlRevealAt = 0;
  var wasPlayingBeforeSuspend = false;
  var CONTROLS_IDLE_MS = 6000;
  var DEBUG = new URLSearchParams(window.location.search).get('tvDebug') === '1';

  function debugLog() {
    if (DEBUG) console.log.apply(console, arguments);
  }

  var style = document.createElement('style');
  style.id = 'daitign-tv-player-focus';
  style.textContent = '.daitign-tv-player-selected{outline:0!important;filter:brightness(1.13) drop-shadow(0 5px 11px rgba(255,255,255,.28))!important;transform:scale(1.08)!important;transition:filter 120ms ease,transform 120ms ease!important}.daitign-tv-player-menu-selected{outline:0!important;background:rgba(255,255,255,.19)!important;border-radius:10px!important;color:#fff!important;box-shadow:none!important;filter:none!important;transform:none!important;transition:background-color 90ms ease!important}.daitign-tv-player-timeline{outline:0!important;filter:brightness(1.16) drop-shadow(0 3px 7px rgba(255,255,255,.18))!important;transform:scaleY(1.28)!important;transition:filter 120ms ease,transform 120ms ease!important}.daitign-tv-controls-locked .art-controls,.daitign-tv-controls-locked .art-control,.daitign-tv-controls-locked .art-bottom,.daitign-tv-controls-locked .art-top,.daitign-tv-controls-locked .art-progress,.daitign-tv-controls-locked .art-layers,.daitign-tv-controls-locked .z-30,.daitign-tv-controls-locked .z-30 > div,.daitign-tv-controls-locked [class*="controls"],.daitign-tv-controls-locked [class*="player-bottom"],.daitign-tv-controls-locked [role="dialog"],.daitign-tv-controls-locked [role="menu"],.daitign-tv-controls-locked [role="listbox"],.daitign-tv-controls-locked [data-radix-popper-content-wrapper],.daitign-tv-controls-locked .art-settings,.daitign-tv-controls-locked .art-selector{opacity:1!important;visibility:visible!important;pointer-events:auto!important}.daitign-tv-controls-locked.art-hide-cursor,.daitign-tv-controls-locked .art-hide-cursor,.daitign-tv-controls-locked.cursor-none,.daitign-tv-controls-locked .cursor-none{cursor:auto!important}[role="dialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper],[data-radix-popper-content-wrapper] > div,.art-settings,.art-setting,.art-selector,.art-layer-selector,[class*="popup"],[class*="modal"]{max-height:min(78vh,calc(100vh - 120px))!important;max-width:min(72vw,680px)!important;box-sizing:border-box!important;overflow-y:auto!important;bottom:clamp(70px,12vh,120px)!important;margin-bottom:0!important}[role="dialog"]::-webkit-scrollbar,[role="menu"]::-webkit-scrollbar,.art-settings::-webkit-scrollbar,[class*="popup"]::-webkit-scrollbar{width:6px!important}[role="dialog"]::-webkit-scrollbar-thumb,.art-settings::-webkit-scrollbar-thumb{background:rgba(255,255,255,.3)!important;border-radius:4px!important}';
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

  function controlKind(element) {
    var semantic = label(element);
    if (isTimeline(element)) return 'timeline';
    if (/play|pause/.test(semantic)) return 'play-pause';
    if (/next|episode/.test(semantic)) return 'next';
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
    var selector = 'button,a[href],input,select,[role="button"],[role="menuitem"],[role="option"],[role="slider"],[aria-valuenow],[tabindex]:not([tabindex="-1"]),[aria-label],[title],[class*="timeline"],[class*="progress"],[class*="scrub"],[class*="seek"]';
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

  function isMenuItem(element, container) {
    if (!element || element === container || !visible(element) || !enabled(element)) return false;
    var rect = element.getBoundingClientRect();
    var parentRect = container.getBoundingClientRect();
    if (rect.top < parentRect.top - 2 || rect.bottom > parentRect.bottom + 2) return false;
    if (rect.height < 12 || rect.height > Math.min(160, parentRect.height * .7)) return false;
    var semantic = element.matches('[role="menuitem"],[role="option"],button,a[href],input,select,li,[aria-selected],[aria-checked],[tabindex]:not([tabindex="-1"])');
    var computed = getComputedStyle(element);
    return semantic || typeof element.onclick === 'function' || computed.cursor === 'pointer';
  }

  function discoverMenuItems(container, force) {
    if (!container || !visible(container)) return [];
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

  function detectPopup() {
    var semantic = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"],[aria-modal="true"]')).filter(visible);
    if (semantic.length) return semantic[semantic.length - 1];

    var selector = '[class*="menu"],[class*="popup"],[class*="popover"],[class*="setting"],[class*="server"],[class*="subtitle"],[class*="quality"],[class*="source"],body > div';
    var possible = Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (element) {
      if (!visible(element) || element === document.body) return false;
      var rect = element.getBoundingClientRect();
      if (rect.width < innerWidth * .10 || rect.height < innerHeight * .10) return false;
      if (rect.width > innerWidth * .88 || rect.height > innerHeight * .9) return false;
      var computed = getComputedStyle(element);
      if (computed.position !== 'fixed' && computed.position !== 'absolute' && element.parentElement !== document.body) return false;
      return discoverMenuItems(element, true).length > 0;
    });
    possible.sort(function (a, b) {
      var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
    return possible[0] || null;
  }

  function clearSelection() {
    if (selected) selected.classList.remove('daitign-tv-player-selected', 'daitign-tv-player-menu-selected', 'daitign-tv-player-timeline');
    selected = null;
  }

  function setSelected(element, nextState) {
    clearSelection();
    selected = controlVisible(element) ? element : null;
    if (!selected) return;
    var resolvedState = nextState || (isTimeline(selected) ? TIMELINE : CONTROLS);
    if (resolvedState === MENU) selected.classList.add('daitign-tv-player-menu-selected');
    else selected.classList.add(isTimeline(selected) ? 'daitign-tv-player-timeline' : 'daitign-tv-player-selected');
    try { selected.focus({ preventScroll: true }); } catch (_) {}
    preferredX = center(selected).x;
    debugLog('[DAITIGN TV Player] selected', resolvedState === MENU ? 'menu-option' : controlKind(selected), label(selected));
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
    var previousKind = selected ? controlKind(selected) : null;
    var previousLabel = selected ? label(selected) : null;
    candidatesDirty = true;
    var currentCandidates = candidates(true);
    var matched = null;
    if (previousLabel) {
      matched = currentCandidates.find(function (c) { return label(c) === previousLabel; });
    }
    if (!matched && previousKind) {
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

  function registerUserActivity() {
    ensureControlsVisible();
    installReplacementObserver();
    // Zero hide timers in TV mode.
    // Controls stay visible continuously until the user explicitly presses Back.
  }

  function scheduleControlsIdle() {
    registerUserActivity();
  }

  function showControls() {
    registerUserActivity();
  }

  function hideControls() {
    // Never hide if a menu or submenu popup is open
    if (isMenuOpen()) return;
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

  function wakeAndFocusControls() {
    dispatchWakeEvents();
    notify(CONTROLS);
    ensureControlsVisible();

    candidatesDirty = true;
    var all = candidates(true);
    var playPause = all.find(function (el) { return controlKind(el) === 'play-pause'; });
    var target = playPause || defaultControl(all);

    if (target && controlVisible(target)) {
      setSelected(target, CONTROLS);
      ensureControlsVisible();
      return true;
    }

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function () {
        ensureControlsVisible();
        candidatesDirty = true;
        var rAll = candidates(true);
        var rPlay = rAll.find(function (el) { return controlKind(el) === 'play-pause'; }) || defaultControl(rAll);
        if (rPlay) {
          setSelected(rPlay, CONTROLS);
          ensureControlsVisible();
        } else {
          window.setTimeout(function () {
            ensureControlsVisible();
            candidatesDirty = true;
            var tAll = candidates(true);
            var tPlay = tAll.find(function (el) { return controlKind(el) === 'play-pause'; }) || defaultControl(tAll);
            if (tPlay) setSelected(tPlay, CONTROLS);
          }, 30);
        }
      });
    }

    return true;
  }

  function focusDefault(attempt) {
    return wakeAndFocusControls();
  }

  function syncMenu(attempt) {
    attempt = attempt || 0;
    window.clearTimeout(menuSyncTimer);
    window.clearTimeout(controlsIdleTimer);
    controlsIdleTimer = 0;
    menuSyncTimer = window.setTimeout(function () {
      var popup = detectPopup();
      if (!popup) {
        if (attempt < 8) syncMenu(attempt + 1);
        return;
      }
      activePopup = popup;
      menuCandidatesDirty = false;
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
    if (direction === 'LEFT' || direction === 'RIGHT') target = row.elements[index + (direction === 'RIGHT' ? 1 : -1)] || null;
    else {
      var nextRow = grouped[rowIndex + (direction === 'DOWN' ? 1 : -1)];
      if (nextRow) {
        var x = preferredX == null ? center(selected).x : preferredX;
        target = nextRow.elements.reduce(function (best, item) { return !best || Math.abs(center(item).x - x) < Math.abs(center(best).x - x) ? item : best; }, null);
      }
    }
    if (target) {
      setSelected(target);
      registerUserActivity();
    }
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
    var closeBtn = discoverMenuItems(popup, false).find(function (element) {
      return /close|back|done|exit/.test(label(element));
    });
    if (closeBtn) {
      try { closeBtn.click(); pointerFallback(closeBtn); } catch (_) {}
    }
    if (visible(menuOpener)) {
      try { menuOpener.click(); pointerFallback(menuOpener); } catch (_) {}
    }
    var mask = document.querySelector('.art-mask, .art-layers, .art-video-player, #artplayer, video') || document.body;
    if (mask) {
      try { pointerFallback(mask); } catch (_) {}
    }
    dispatchKey(popup, 'Escape');
    dispatchKey(document.body, 'Escape');
    window.setTimeout(function () {
      if (visible(popup)) {
        try {
          popup.style.setProperty('display', 'none', 'important');
          popup.style.setProperty('visibility', 'hidden', 'important');
        } catch (_) {}
      }
    }, 50);
  }

  function activateMenuItem() {
    registerUserActivity();
    if (!selected || !activePopup || !activePopup.contains(selected) || !visible(selected)) { syncMenu(0); return; }
    var item = selected;
    var popupBefore = activePopup;
    var itemText = label(item);
    var isSubmenuNavigation = /style|delay|speed|audio|font|color/.test(itemText);
    var singleChoiceMenu = !isSubmenuNavigation && /subtitle|caption|quality|server|source|fit|aspect/.test(
      controlKind(menuOpener) + ' ' + controlKind(popupBefore) + ' ' + label(popupBefore)
    );
    var before = selectionSignature(item);
    try { item.focus({ preventScroll: true }); } catch (_) {}
    item.click();
    pointerFallback(item);
    debugLog('[DAITIGN TV Player] menu option click:', label(item));
    window.setTimeout(function () {
      if (visible(popupBefore) && popupBefore.contains(item) && selectionSignature(item) === before) pointerFallback(item);
      menuCandidatesDirty = true;
      window.setTimeout(function () {
        if (singleChoiceMenu) {
          debugLog('[DAITIGN TV Player] single-choice option activated; closing popup');
          dismissPopup(popupBefore);
          window.setTimeout(function () {
            finishMenuClose();
          }, 60);
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
    candidatesDirty = true;
    menuCandidatesDirty = true;
    if (/subtitle|quality|server|settings|fit|volume/.test(openerKind)) {
      clearIdleTimer();
      notify(MENU);
      startMenuKeepAlive();
      syncMenu(0);
    } else {
      window.setTimeout(function () {
        if (visible(menuOpener)) setSelected(menuOpener, CONTROLS);
        registerUserActivity();
      }, 90);
    }
  }

  function finishMenuClose() {
    stopMenuKeepAlive();
    activePopup = null;
    menuCandidateCache = [];
    menuCandidatesDirty = true;
    window.clearTimeout(menuSyncTimer);
    if (visible(menuOpener)) setSelected(menuOpener, CONTROLS);
    else focusDefault(0);
    registerUserActivity();
  }

  function closeMenu() {
    if (state !== MENU) return false;
    var popupBefore = activePopup;
    if (!popupBefore || !visible(popupBefore)) {
      finishMenuClose();
      return true;
    }

    var close = discoverMenuItems(popupBefore, false).find(function (element) { return /close|back|done/.test(label(element)); });
    if (close) close.click();
    if (selected) dispatchKey(selected, 'Escape');
    dispatchKey(popupBefore, 'Escape');
    dispatchKey(document.body, 'Escape');
    window.setTimeout(function () {
      if (!visible(popupBefore)) {
        finishMenuClose();
        return;
      }
      // Some VIDSTUCK builds ignore Escape and use the opener as a toggle.
      if (visible(menuOpener)) menuOpener.click();
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
          // Keep PLAYER_MENU active when closing genuinely failed so Back can
          // retry instead of accidentally hiding controls or exiting playback.
          activePopup = popupBefore;
          clearIdleTimer();
          startMenuKeepAlive();
          menuCandidatesDirty = true;
          var items = discoverMenuItems(popupBefore, true);
          if (items[0]) setSelected(items[0], MENU);
          console.warn('[DAITIGN TV Player] popup remains open; Back will retry close');
        }, 60);
      }, 90);
    }, 90);
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
    getState: function () { return state; },
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
        if (state === MENU) { closeMenu(); return true; }
        if (state === TIMELINE) {
          var control = defaultControl(candidates(true));
          if (control) setSelected(control, CONTROLS);
          else notify(CONTROLS);
          return true;
        }
        if (state !== HIDDEN) { hideControls(); return true; }
        return false;
      }
      if (state === HIDDEN || !selected || !controlVisible(selected)) {
        wakeAndFocusControls();
        return true;
      }
      ensureControlsVisible();
      registerUserActivity();
      if (key === 'PLAY_PAUSE' || key === 'PLAY' || key === 'PAUSE') return setPlayback(key);
      if (key === 'SEEK_BACKWARD' || key === 'SEEK_FORWARD') return seekPlayback(key, false);
      if (key === 'SEEK_BACKWARD_REPEAT' || key === 'SEEK_FORWARD_REPEAT') return seekPlayback(key, true);
      if (state === MENU) {
        if (!activePopup || !visible(activePopup)) { finishMenuClose(); return true; }
        if (key === 'UP' || key === 'DOWN') { moveMenu(key); return true; }
        if ((key === 'LEFT' || key === 'RIGHT') && selected && isTimeline(selected)) {
          dispatchKey(selected, key === 'LEFT' ? 'ArrowLeft' : 'ArrowRight');
          registerUserActivity();
          return true;
        }
        if (key === 'OK') { activateMenuItem(); return true; }
        return true;
      }
      if (state === HIDDEN || !selected || !controlVisible(selected)) { focusDefault(0); return true; }
      if ((key === 'LEFT' || key === 'RIGHT') && state === TIMELINE) {
        return seekPlayback(key === 'RIGHT' ? 'SEEK_FORWARD' : 'SEEK_BACKWARD', false);
      }
      if (key === 'LEFT' || key === 'RIGHT' || key === 'UP' || key === 'DOWN') { moveControl(key); return true; }
      if (key === 'OK' && state === TIMELINE) return true;
      if (key === 'OK') { activateControl(); return true; }
      return false;
    },
    inventory: function () { return inventory(true); },
    snapshot: function () {
      return {
        state: state,
        selected: selected ? { kind: state === MENU ? 'menu-option' : controlKind(selected), label: label(selected) } : null,
        controls: inventory(false),
        menu: activePopup && visible(activePopup) ? discoverMenuItems(activePopup, false).map(label) : []
      };
    }
  };
  debugLog('[DAITIGN TV Player] controller ready; document visibility=' + document.visibilityState);
  notify(HIDDEN);
}());
