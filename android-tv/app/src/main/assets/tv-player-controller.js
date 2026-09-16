(function () {
  'use strict';
  if (window.DAITIGN_TV_PLAYER) return;

  var HIDDEN = 'PLAYER_HIDDEN';
  var CONTROLS = 'PLAYER_CONTROLS';
  var TIMELINE = 'PLAYER_TIMELINE';
  var MENU = 'PLAYER_MENU';
  var state = HIDDEN;
  var selected = null;
  var previousControl = null;
  var preferredX = null;

  var style = document.createElement('style');
  style.id = 'daitign-tv-player-focus';
  style.textContent = '.daitign-tv-player-selected{outline:0!important;filter:brightness(1.1) drop-shadow(0 4px 9px rgba(255,255,255,.22))!important;transform:scale(1.04)!important;transition:filter 120ms ease,transform 120ms ease!important}.daitign-tv-player-timeline{outline:0!important;filter:brightness(1.16) drop-shadow(0 3px 7px rgba(255,255,255,.18))!important;transform:scaleY(1.28)!important;transition:filter 120ms ease,transform 120ms ease!important}';
  document.head.appendChild(style);

  function notify(next) {
    state = next;
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

  function label(element) {
    return [element.getAttribute('aria-label'), element.getAttribute('title'), element.getAttribute('name'), element.getAttribute('data-testid'), element.getAttribute('role'), element.textContent, typeof element.className === 'string' ? element.className : ''].filter(Boolean).join(' ').trim().toLowerCase();
  }

  function isTimeline(element) {
    return element.matches('input[type="range"], [role="slider"], [aria-valuenow]') || /timeline|progress|scrub|seek/.test(label(element));
  }

  function controlKind(element) {
    var semantic = label(element);
    if (isTimeline(element)) return 'timeline';
    if (/play|pause/.test(semantic)) return 'play-pause';
    if (/next|episode/.test(semantic)) return 'next';
    if (/volume|mute|sound/.test(semantic)) return 'volume';
    if (/aspect|fit|ratio/.test(semantic)) return 'fit';
    if (/subtitle|caption|cc/.test(semantic)) return 'subtitle';
    if (/quality|auto|1080|720|480/.test(semantic)) return 'quality';
    if (/server|source/.test(semantic)) return 'server';
    if (/setting/.test(semantic)) return 'settings';
    if (/fullscreen|full screen/.test(semantic)) return 'fullscreen';
    return 'control';
  }

  function candidates() {
    var selector = 'button,a[href],input,select,[role="button"],[role="menuitem"],[role="option"],[role="slider"],[aria-valuenow],[tabindex]:not([tabindex="-1"]),[aria-label],[title]';
    return Array.prototype.slice.call(document.querySelectorAll(selector)).filter(function (element) {
      if (!visible(element) || element.matches('video,iframe,:disabled,[aria-disabled="true"]')) return false;
      var rect = element.getBoundingClientRect();
      return !(rect.width > innerWidth * .82 && rect.height > innerHeight * .82);
    });
  }

  function inventory(logResults) {
    var all = candidates();
    var grouped = rows(all);
    var result = all.map(function (element) {
      var rect = element.getBoundingClientRect();
      var group = grouped.findIndex(function (row) { return row.elements.indexOf(element) >= 0; });
      return {
        kind: controlKind(element),
        label: label(element),
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute('role') || '',
        group: group,
        rect: {
          left: Math.round(rect.left), top: Math.round(rect.top),
          width: Math.round(rect.width), height: Math.round(rect.height)
        }
      };
    });
    if (logResults) result.forEach(function (control) {
      console.log('[DAITIGN TV Player] control', JSON.stringify(control));
    });
    return result;
  }

  function popup() {
    var containers = Array.prototype.slice.call(document.querySelectorAll('[role="dialog"],[role="menu"],[role="listbox"],[aria-modal="true"]'));
    var semanticPopup = containers.reverse().find(visible);
    if (semanticPopup) return semanticPopup;
    var positional = Array.prototype.slice.call(document.body.querySelectorAll('div')).filter(function (element) {
      if (!visible(element)) return false;
      var rect = element.getBoundingClientRect();
      var style = getComputedStyle(element);
      if (style.position !== 'fixed' && style.position !== 'absolute') return false;
      if (rect.width > innerWidth * .8 || rect.height > innerHeight * .85) return false;
      if (rect.width < innerWidth * .12 || rect.height < innerHeight * .12) return false;
      return candidates().filter(function (item) { return element.contains(item); }).length >= 2;
    });
    positional.sort(function (a, b) {
      var ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return ar.width * ar.height - br.width * br.height;
    });
    return positional[0] || null;
  }

  function center(element) {
    var rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }

  function rows(elements) {
    var result = [];
    elements.sort(function (a, b) { return center(a).y - center(b).y || center(a).x - center(b).x; });
    elements.forEach(function (element) {
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

  function setSelected(element) {
    if (selected) selected.classList.remove('daitign-tv-player-selected', 'daitign-tv-player-timeline');
    selected = visible(element) ? element : null;
    if (!selected) return;
    selected.classList.add(isTimeline(selected) ? 'daitign-tv-player-timeline' : 'daitign-tv-player-selected');
    try { selected.focus({ preventScroll: true }); } catch (_) {}
    preferredX = center(selected).x;
    console.log('[DAITIGN TV Player] selected', controlKind(selected), label(selected));
    notify(popup() ? MENU : (isTimeline(selected) ? TIMELINE : CONTROLS));
  }

  function showControls() {
    var target = document.querySelector('video') || document.body;
    [window, document, document.body, target].forEach(function (node) {
      node.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight - 36 }));
      if (typeof PointerEvent === 'function') {
        node.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, cancelable: true, clientX: innerWidth / 2, clientY: innerHeight - 36, pointerType: 'mouse' }));
      }
    });
  }

  function hideControls() {
    if (selected) selected.classList.remove('daitign-tv-player-selected', 'daitign-tv-player-timeline');
    selected = null;
    document.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
    notify(HIDDEN);
  }

  function focusDefault(attempt) {
    attempt = attempt || 0;
    showControls();
    window.setTimeout(function () {
      var all = candidates();
      if (attempt === 0 || all.length) inventory(true);
      var control = all.find(function (element) { return /play|pause/.test(label(element)) && !isTimeline(element); }) || all.find(function (element) { return !isTimeline(element); });
      if (control) {
        setSelected(control);
      } else if (attempt < 10) {
        focusDefault(attempt + 1);
      } else {
        console.warn('[DAITIGN TV Player] no visible controls discovered after reveal attempts');
      }
    }, attempt === 0 ? 120 : 180);
  }

  function dispatchSeek(key) {
    if (!selected) return;
    ['keydown', 'keyup'].forEach(function (type) { selected.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, key: key, code: key })); });
  }

  function move(direction) {
    var activePopup = popup();
    var all = activePopup ? candidates().filter(function (item) { return activePopup.contains(item); }) : candidates();
    if (!selected || !visible(selected)) { focusDefault(); return; }
    var grouped = rows(all);
    var rowIndex = grouped.findIndex(function (row) { return row.elements.indexOf(selected) >= 0; });
    if (rowIndex < 0) { focusDefault(); return; }
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

  function activate() {
    if (!selected || !visible(selected)) { focusDefault(); return; }
    // Preserve the control that opened a popup. Activating a menu option must
    // return to that originating control instead of remembering the option
    // that disappears when the popup closes.
    if (state !== MENU) previousControl = selected;
    selected.click();
    window.setTimeout(function () {
      var activePopup = popup();
      if (activePopup) setSelected(candidates().find(function (item) { return activePopup.contains(item); }));
      else if (visible(previousControl)) setSelected(previousControl);
      else focusDefault(0);
    }, 160);
  }

  function closeMenu() {
    var activePopup = popup();
    if (!activePopup) return false;
    var close = candidates().find(function (element) { return activePopup.contains(element) && /close|back|done/.test(label(element)); });
    if (close) close.click();
    else document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Escape', code: 'Escape' }));
    window.setTimeout(function () { setSelected(visible(previousControl) ? previousControl : null); }, 100);
    notify(CONTROLS);
    return true;
  }

  window.DAITIGN_TV_PLAYER = {
    getState: function () { return state; },
    handle: function (key) {
      if (key === 'BACK') {
        if (state === MENU && closeMenu()) return true;
        if (state !== HIDDEN) { hideControls(); return true; }
        return false;
      }
      if (state === HIDDEN) {
        if (key === 'OK') { focusDefault(0); return true; }
        return true;
      }
      showControls();
      if ((key === 'LEFT' || key === 'RIGHT') && state === TIMELINE) { dispatchSeek(key === 'LEFT' ? 'ArrowLeft' : 'ArrowRight'); return true; }
      if (key === 'LEFT' || key === 'RIGHT' || key === 'UP' || key === 'DOWN') { move(key); return true; }
      if (key === 'OK') { activate(); return true; }
      return false;
    },
    inventory: function () { return inventory(true); },
    snapshot: function () {
      return {
        state: state,
        selected: selected ? { kind: controlKind(selected), label: label(selected) } : null,
        controls: inventory(false)
      };
    }
  };
  console.log('[DAITIGN TV Player] controller ready; document visibility=' + document.visibilityState);
  notify(HIDDEN);
}());
