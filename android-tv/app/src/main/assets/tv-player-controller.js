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

  var style = document.createElement('style');
  style.id = 'daitign-tv-player-focus';
  style.textContent = '.daitign-tv-player-selected{outline:0!important;filter:brightness(1.13) drop-shadow(0 5px 11px rgba(255,255,255,.28))!important;transform:scale(1.08)!important;transition:filter 120ms ease,transform 120ms ease!important}.daitign-tv-player-menu-selected{outline:0!important;filter:brightness(1.12) drop-shadow(0 4px 9px rgba(255,255,255,.22))!important;transform:scale(1.035)!important;transition:filter 100ms ease,transform 100ms ease!important}.daitign-tv-player-timeline{outline:0!important;filter:brightness(1.16) drop-shadow(0 3px 7px rgba(255,255,255,.18))!important;transform:scaleY(1.28)!important;transition:filter 120ms ease,transform 120ms ease!important}';
  document.head.appendChild(style);

  function notify(next) {
    if (state === next) return;
    state = next;
    console.log('[DAITIGN TV Player] state = ' + next);
    try { window.AndroidTVBridge && window.AndroidTVBridge.setPlayerState(next); } catch (_) {}
  }

  function visible(element) {
    if (!element || !element.isConnected) return false;
    var rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) return false;
    if (rect.bottom < 0 || rect.top > innerHeight || rect.right < 0 || rect.left > innerWidth) return false;
    var computed = getComputedStyle(element);
    return computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0';
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
      candidateCache = candidateCache.filter(function (element) { return visible(element) && enabled(element); });
      return candidateCache.slice();
    }
    var selector = 'button,a[href],input,select,[role="button"],[role="menuitem"],[role="option"],[role="slider"],[aria-valuenow],[tabindex]:not([tabindex="-1"]),[aria-label],[title]';
    candidateCache = Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (element) {
      if (!visible(element) || !enabled(element) || element.matches('video,iframe')) return false;
      var rect = element.getBoundingClientRect();
      return !(rect.width > innerWidth * .82 && rect.height > innerHeight * .82);
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
    console.log('[DAITIGN TV Player] menu items discovered = ' + menuCandidateCache.length + ': ' + menuCandidateCache.map(label).join(' | '));
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
    selected = visible(element) ? element : null;
    if (!selected) return;
    var resolvedState = nextState || (isTimeline(selected) ? TIMELINE : CONTROLS);
    if (resolvedState === MENU) selected.classList.add('daitign-tv-player-menu-selected');
    else selected.classList.add(isTimeline(selected) ? 'daitign-tv-player-timeline' : 'daitign-tv-player-selected');
    try { selected.focus({ preventScroll: true }); } catch (_) {}
    preferredX = center(selected).x;
    console.log('[DAITIGN TV Player] selected', resolvedState === MENU ? 'menu-option' : controlKind(selected), label(selected));
    notify(resolvedState);
  }

  function showControls() {
    var target = document.querySelector('video') || document.body;
    [window, document, document.body, target].forEach(function (node) {
      node.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight * .86 }));
      if (typeof PointerEvent === 'function') node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight * .86, pointerType: 'mouse' }));
    });
  }

  function hideControls() {
    clearSelection();
    document.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    notify(HIDDEN);
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
    if (logResults) result.forEach(function (control) { console.log('[DAITIGN TV Player] control', JSON.stringify(control)); });
    return result;
  }

  function focusDefault(attempt) {
    attempt = attempt || 0;
    showControls();
    window.setTimeout(function () {
      var all = candidates(true);
      if (attempt === 0 || all.length) inventory(true);
      var control = defaultControl(all);
      if (control) setSelected(control, CONTROLS);
      else if (attempt < 12) focusDefault(attempt + 1);
      else console.warn('[DAITIGN TV Player] no visible controls discovered after reveal attempts');
    }, attempt === 0 ? 90 : 120);
  }

  function syncMenu(attempt) {
    attempt = attempt || 0;
    window.clearTimeout(menuSyncTimer);
    menuSyncTimer = window.setTimeout(function () {
      var popup = detectPopup();
      if (!popup) {
        if (attempt < 8) syncMenu(attempt + 1);
        return;
      }
      activePopup = popup;
      menuCandidatesDirty = true;
      var items = discoverMenuItems(popup, true);
      if (!items.length) {
        if (attempt < 8) syncMenu(attempt + 1);
        return;
      }
      var chosen = items.find(function (item) {
        return item.getAttribute('aria-selected') === 'true' || item.getAttribute('aria-checked') === 'true';
      }) || items[0];
      console.log('[DAITIGN TV Player] popup open; entering PLAYER_MENU');
      setSelected(chosen, MENU);
    }, attempt === 0 ? 90 : 120);
  }

  function dispatchKey(element, key) {
    ['keydown', 'keyup'].forEach(function (type) {
      element.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: key, code: key }));
    });
  }

  function moveControl(direction) {
    var all = candidates(false);
    if (!selected || !visible(selected) || all.indexOf(selected) < 0) { focusDefault(0); return; }
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
    if (target) setSelected(target);
  }

  function moveMenu(direction) {
    if (!activePopup || !visible(activePopup)) { syncMenu(0); return; }
    var items = discoverMenuItems(activePopup, false);
    if (!items.length) { syncMenu(0); return; }
    var index = items.indexOf(selected);
    if (index < 0) index = 0;
    var next = Math.max(0, Math.min(items.length - 1, index + (direction === 'DOWN' ? 1 : -1)));
    setSelected(items[next], MENU);
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
    console.log('[DAITIGN TV Player] menu activation pointer fallback:', label(element));
  }

  function selectionSignature(element) {
    return [element.className, element.getAttribute('aria-selected'), element.getAttribute('aria-checked'), element.getAttribute('data-state')].join('|');
  }

  function activateMenuItem() {
    if (!selected || !activePopup || !activePopup.contains(selected) || !visible(selected)) { syncMenu(0); return; }
    var item = selected;
    var popupBefore = activePopup;
    var before = selectionSignature(item);
    try { item.focus({ preventScroll: true }); } catch (_) {}
    item.click();
    console.log('[DAITIGN TV Player] menu option click:', label(item));
    window.setTimeout(function () {
      if (visible(popupBefore) && popupBefore.contains(item) && selectionSignature(item) === before) pointerFallback(item);
      menuCandidatesDirty = true;
      window.setTimeout(function () {
        if (visible(popupBefore)) {
          activePopup = popupBefore;
          var items = discoverMenuItems(popupBefore, true);
          var chosen = items.find(function (option) {
            return option.getAttribute('aria-selected') === 'true' || option.getAttribute('aria-checked') === 'true';
          }) || (visible(item) ? item : items[0]);
          if (chosen) setSelected(chosen, MENU);
        } else {
          activePopup = null;
          menuCandidateCache = [];
          if (visible(menuOpener)) setSelected(menuOpener, CONTROLS);
          else focusDefault(0);
        }
      }, 100);
    }, 140);
  }

  function activateControl() {
    if (!selected || !visible(selected)) { focusDefault(0); return; }
    menuOpener = selected;
    var openerKind = controlKind(selected);
    try { selected.focus({ preventScroll: true }); } catch (_) {}
    selected.click();
    candidatesDirty = true;
    menuCandidatesDirty = true;
    if (/subtitle|quality|server|settings|fit|volume/.test(openerKind)) syncMenu(0);
    else window.setTimeout(function () {
      if (visible(menuOpener)) setSelected(menuOpener, CONTROLS);
    }, 90);
  }

  function closeMenu() {
    if (!activePopup || !visible(activePopup)) return false;
    var popupBefore = activePopup;
    var close = discoverMenuItems(activePopup, false).find(function (element) { return /close|back|done/.test(label(element)); });
    if (close) close.click();
    else {
      if (selected) dispatchKey(selected, 'Escape');
      dispatchKey(document.body, 'Escape');
    }
    window.setTimeout(function () {
      if (visible(popupBefore) && visible(menuOpener)) menuOpener.click();
      activePopup = null;
      menuCandidateCache = [];
      menuCandidatesDirty = true;
      if (visible(menuOpener)) setSelected(menuOpener, CONTROLS);
      else focusDefault(0);
    }, 100);
    return true;
  }

  var observer = new MutationObserver(function () {
    candidatesDirty = true;
    menuCandidatesDirty = true;
    if (state === MENU && activePopup && visible(activePopup)) {
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
    attributeFilter: ['style', 'hidden', 'disabled', 'aria-hidden', 'aria-label', 'aria-selected', 'aria-checked', 'title', 'role']
  });

  window.DAITIGN_TV_PLAYER = {
    getState: function () { return state; },
    wake: function () { focusDefault(0); return true; },
    handle: function (key) {
      if (key === 'BACK') {
        if (state === MENU && closeMenu()) return true;
        if (state !== HIDDEN) { hideControls(); return true; }
        return false;
      }
      showControls();
      if (state === MENU) {
        if (!activePopup || !visible(activePopup)) { activePopup = null; focusDefault(0); return true; }
        if (key === 'UP' || key === 'DOWN') { moveMenu(key); return true; }
        if ((key === 'LEFT' || key === 'RIGHT') && selected && isTimeline(selected)) { dispatchKey(selected, key === 'LEFT' ? 'ArrowLeft' : 'ArrowRight'); return true; }
        if (key === 'OK') { activateMenuItem(); return true; }
        return true;
      }
      if (state === HIDDEN || !selected || !visible(selected)) { focusDefault(0); return true; }
      if ((key === 'LEFT' || key === 'RIGHT') && state === TIMELINE) { dispatchKey(selected, key === 'LEFT' ? 'ArrowLeft' : 'ArrowRight'); return true; }
      if (key === 'LEFT' || key === 'RIGHT' || key === 'UP' || key === 'DOWN') { moveControl(key); return true; }
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
  console.log('[DAITIGN TV Player] controller ready; document visibility=' + document.visibilityState);
  notify(HIDDEN);
}());
