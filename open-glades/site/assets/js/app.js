/*
 * Open Glades — UI/state glue (replaces the DCLogic React component).
 * Starts the canvas scene and wires the scene panel, mood picker, mobile product
 * cards, and the SendGrid-backed contact form. All markup already exists in index.html;
 * this only toggles state and talks to the scene module.
 */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var CARD_MAP = {
    sprout: { name: 'Sprout Track', tag: 'Baby & family tracking, self-hosted.', url: 'https://sprout-track.com' },
    astryk: { name: 'Astryk', tag: 'Collaborative workspaces, in real time.', url: 'https://astryk.com' },
    parallax: { name: 'Parallax', tag: 'Demand-response transit, made clear.', url: 'https://jroverton.com/parallax' }
  };

  function fmtHour(h) {
    var hr = Math.floor(h) % 24; var mn = Math.floor((h - Math.floor(h)) * 60);
    var ap = hr < 12 ? 'AM' : 'PM'; var hh = hr % 12; if (hh === 0) hh = 12;
    return hh + ':' + ('0' + mn).slice(-2) + ' ' + ap;
  }

  function init() {
    var state = { panelOpen: false, hour: 0.39583, mood: 'Serene', openCard: null, contactOpen: false };

    var canvas = $('#og-canvas');
    var bubbleA = $('#og-bubble-a');
    var bubbleB = $('#og-bubble-b');

    // time-of-day UI (declared before the scene so onHourChange can drive them)
    var time = $('#og-time');
    var hourLabel = $('#og-hour-label');
    var scrubbing = false; // true while the user is dragging the slider — pause UI auto-sync
    function updateHourUI(h) {
      state.hour = h;
      if (!scrubbing) time.value = String(h);
      hourLabel.textContent = fmtHour(h * 24);
    }

    var scene = window.OG.scene.start({
      canvas: canvas, bubbleA: bubbleA, bubbleB: bubbleB,
      initialHour: state.hour, initialMood: state.mood,
      dayLengthSec: 120,          // a full day/night cycle every ~2 minutes
      onHourChange: updateHourUI  // keep the slider + label in step with the moving clock
    });

    // ---- scene panel -------------------------------------------------------
    var panel = $('#og-panel');
    var sceneBtn = $('#og-scene-btn');
    function syncPanel() {
      panel.style.display = state.panelOpen ? 'block' : 'none';
      sceneBtn.style.display = state.panelOpen ? 'none' : 'inline-flex';
    }
    sceneBtn.addEventListener('click', function () { state.panelOpen = true; syncPanel(); });
    $('#og-panel-close').addEventListener('click', function () { state.panelOpen = false; syncPanel(); });
    syncPanel();

    // ---- time of day (auto-advances; the slider scrubs to a moment, then it resumes) ---
    time.value = String(state.hour);
    hourLabel.textContent = fmtHour(state.hour * 24);
    ['pointerdown', 'mousedown', 'touchstart'].forEach(function (ev) {
      time.addEventListener(ev, function () { scrubbing = true; }, { passive: true });
    });
    ['pointerup', 'mouseup', 'touchend', 'blur', 'change'].forEach(function (ev) {
      time.addEventListener(ev, function () { scrubbing = false; });
    });
    time.addEventListener('input', function (e) {
      var v = parseFloat(e.target.value);
      state.hour = v;
      hourLabel.textContent = fmtHour(v * 24);
      if (scene.setHour) scene.setHour(v);
    });

    // ---- pause / resume the day-night cycle --------------------------------
    var pauseBtn = $('#og-pause');
    var paused = false;
    pauseBtn.addEventListener('click', function () {
      paused = !paused;
      if (scene.setPaused) scene.setPaused(paused);
      pauseBtn.classList.toggle('is-paused', paused);
      pauseBtn.setAttribute('aria-pressed', String(paused));
      pauseBtn.innerHTML = paused ? '▶ RESUME TIME' : '⏸ PAUSE TIME';
    });

    // ---- mood --------------------------------------------------------------
    $$('.og-mood').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.mood = btn.getAttribute('data-mood');
        $$('.og-mood').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
        if (scene.setMood) scene.setMood(state.mood);
      });
    });

    // ---- mobile product cards ---------------------------------------------
    var card = $('#og-card');
    var cardName = $('#og-card-name');
    var cardTag = $('#og-card-tag');
    var cardLink = $('#og-card-link');
    function syncCard() {
      var data = state.openCard ? CARD_MAP[state.openCard] : null;
      if (!data) { card.hidden = true; return; }
      cardName.textContent = data.name;
      cardTag.textContent = data.tag;
      cardLink.href = data.url;
      card.hidden = false;
    }
    $$('.og-tap').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = btn.getAttribute('data-card');
        state.openCard = state.openCard === id ? null : id;
        syncCard();
      });
    });
    $('#og-card-close').addEventListener('click', function () { state.openCard = null; syncCard(); });
    syncCard();

    // ---- contact modal -----------------------------------------------------
    var overlay = $('#og-contact');
    var pending = $('#og-contact-pending');
    var sent = $('#og-contact-sent');
    var errBox = $('#og-contact-error');
    var form = $('#og-contact-form');
    var submitBtn = $('#og-contact-submit');

    function openContact() {
      state.contactOpen = true;
      overlay.hidden = false;
      pending.hidden = false;
      sent.hidden = true;
      errBox.hidden = true;
      if (form) form.reset();
    }
    function closeContact() { state.contactOpen = false; overlay.hidden = true; }

    $('#og-contact-btn').addEventListener('click', openContact);
    $$('[data-contact-close]').forEach(function (el) { el.addEventListener('click', closeContact); });
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeContact(); });
    $('#og-contact-dialog').addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.contactOpen) closeContact(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.hidden = true;
      var endpoint = (window.OG_CONFIG && window.OG_CONFIG.contactEndpoint) || '/api/contact';
      var fd = new FormData(form);
      var payload = {
        name: (fd.get('name') || '').toString().trim(),
        company: (fd.get('company') || '').toString().trim(),
        phone: (fd.get('phone') || '').toString().trim(),
        email: (fd.get('email') || '').toString().trim(),
        message: (fd.get('message') || '').toString().trim(),
        // honeypot — real users never fill this hidden field
        website: (fd.get('website') || '').toString().trim()
      };
      submitBtn.disabled = true;
      var oldLabel = submitBtn.textContent;
      submitBtn.textContent = 'SENDING…';

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('status ' + res.status);
        pending.hidden = true;
        sent.hidden = false;
      }).catch(function () {
        errBox.hidden = false;
      }).then(function () {
        submitBtn.disabled = false;
        submitBtn.textContent = oldLabel;
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
