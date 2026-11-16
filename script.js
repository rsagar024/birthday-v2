/* =========================================================
   Birthday surprise: all interactions
   Vanilla JS, no libraries. Every effect runs on touch and desktop alike.
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isSmall = () => window.innerWidth < 600;
  const PALETTE = ['#f7d6e0', '#b76e79', '#8b2252', '#f3dfa2', '#c9a24b', '#ff9db0', '#ffffff', '#e9a8b6'];

  // Shared "a drag just happened, ignore the next click" guard
  let suppressClickUntil = 0;
  const suppressClick = () => { suppressClickUntil = performance.now() + 350; };
  const clickAllowed = () => performance.now() > suppressClickUntil;

  // Scroll lock with a counter, since popups can stack
  let lockCount = 0;
  const lockScroll = (on) => {
    lockCount = Math.max(0, lockCount + (on ? 1 : -1));
    document.body.classList.toggle('is-locked', lockCount > 0);
  };

  const centerOf = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  };

  /* -------------------------------------------------------
     CONFETTI: canvas, gravity, drag, rotation, flutter, fade
     ------------------------------------------------------- */
  const Confetti = (() => {
    const cvs = $('#confetti');
    const ctx = cvs.getContext('2d');
    let W = 0, H = 0, parts = [], running = false, last = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cvs.width = W * dpr; cvs.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Counts are trimmed slightly on phones for performance but stay big and joyful
    const scaleCount = (n) => Math.round(n * (reduceMotion ? 0.35 : isSmall() ? 0.7 : 1));
    const speedScale = () => 0.7 + Math.min(W, 1600) / 3200;

    function make(x, y, angle, spread, speed) {
      const a = angle + (Math.random() - 0.5) * spread;
      const v = speed * speedScale() * rand(0.45, 1.15);
      const r = Math.random();
      return {
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        rot: rand(0, Math.PI * 2), vr: rand(-0.25, 0.25),
        tilt: rand(0, Math.PI * 2), vt: rand(0.05, 0.18),
        w: rand(6, 12), h: rand(4, 8),
        color: pick(PALETTE),
        shape: r < 0.16 ? 'heart' : r < 0.58 ? 'rect' : 'circle',
        life: 0, ttl: rand(150, 240),
      };
    }

    function heartPath(s) {
      ctx.beginPath();
      ctx.moveTo(0, s * 0.3);
      ctx.bezierCurveTo(-s, -s * 0.4, -s * 0.45, -s * 1.1, 0, -s * 0.5);
      ctx.bezierCurveTo(s * 0.45, -s * 1.1, s, -s * 0.4, 0, s * 0.3);
      ctx.fill();
    }

    function frame(now) {
      const dt = Math.min(3, (now - last) / 16.67 || 1);
      last = now;
      ctx.clearRect(0, 0, W, H);
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.vy += 0.22 * dt;                // gravity
        p.vx *= Math.pow(0.985, dt);      // air drag
        p.vy *= Math.pow(0.985, dt);
        p.x += p.vx * dt + Math.sin(p.tilt) * 0.6;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        p.tilt += p.vt * dt;
        p.life += dt;
        const alpha = Math.max(0, 1 - Math.pow(p.life / p.ttl, 3));
        if (p.life > p.ttl || p.y > H + 60 || alpha <= 0) { parts.splice(i, 1); continue; }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.tilt)); // paper flutter
        ctx.fillStyle = p.color;
        if (p.shape === 'rect') ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        else if (p.shape === 'circle') { ctx.beginPath(); ctx.arc(0, 0, p.h / 1.6, 0, Math.PI * 2); ctx.fill(); }
        else heartPath(p.w * 0.8);
        ctx.restore();
      }
      if (parts.length) requestAnimationFrame(frame);
      else { running = false; ctx.clearRect(0, 0, W, H); }
    }

    function start() {
      if (running) return;
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }

    function burst({ x = W / 2, y = H / 2, count = 120, angle = -Math.PI / 2, spread = Math.PI * 2, speed = 13 } = {}) {
      const n = scaleCount(count);
      for (let i = 0; i < n; i++) parts.push(make(x, y, angle, spread, speed));
      if (parts.length > 900) parts.splice(0, parts.length - 900);
      start();
    }

    function cannons(volleys = 3) {
      for (let v = 0; v < volleys; v++) {
        setTimeout(() => {
          burst({ x: 0, y: H * 0.95, angle: -Math.PI / 3, spread: 0.55, speed: 24, count: 90 });
          burst({ x: W, y: H * 0.95, angle: -Math.PI * 2 / 3, spread: 0.55, speed: 24, count: 90 });
        }, v * 420);
      }
    }

    function rain(count = 120) {
      const n = scaleCount(count);
      for (let i = 0; i < n; i++) {
        const p = make(rand(0, W), rand(-80, -10), Math.PI / 2, 0.6, 3);
        p.ttl = rand(220, 320);
        parts.push(p);
      }
      start();
    }

    return { burst, cannons, rain };
  })();

  /* -------------------------------------------------------
     AMBIENT LIGHT PARTICLES (background canvas)
     ------------------------------------------------------- */
  (() => {
    const cvs = $('#particles');
    const ctx = cvs.getContext('2d');
    let W, H, dots = [];
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      cvs.width = W * dpr; cvs.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = W < 600 ? 28 : W < 1200 ? 42 : 56;
      dots = Array.from({ length: n }, () => ({
        x: rand(0, W), y: rand(0, H), r: rand(1, 3.2), vy: rand(0.12, 0.45), vx: rand(-0.15, 0.15),
        t: rand(0, Math.PI * 2), c: pick(['255,255,255', '243,223,162', '247,214,224', '183,110,121']),
      }));
    }
    resize();
    window.addEventListener('resize', resize);
    function loop() {
      if (!document.hidden) {
        ctx.clearRect(0, 0, W, H);
        for (const d of dots) {
          d.y -= d.vy; d.x += d.vx + Math.sin(d.t) * 0.15; d.t += 0.02;
          if (d.y < -10) { d.y = H + 10; d.x = rand(0, W); }
          const a = 0.35 + Math.sin(d.t * 2) * 0.3;
          ctx.beginPath();
          ctx.fillStyle = `rgba(${d.c},${Math.max(0.05, a)})`;
          ctx.shadowColor = `rgba(${d.c},0.9)`;
          ctx.shadowBlur = 8;
          ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  })();

  /* -------------------------------------------------------
     BALLOONS: SVG helium balloons drifting up at all times
     ------------------------------------------------------- */
  const Balloons = (() => {
    const layer = $('#balloons');
    const COLORS = [
      ['#ffd6e2', '#e9a8b6'], ['#d48a95', '#8f4d58'], ['#a8326a', '#5e1537'],
      ['#f7e3a8', '#c9a24b'], ['#ffb3c7', '#e0607f'], ['#ffffff', '#e6cfd6'], ['#e5b7c4', '#b76e79'],
    ];
    let uid = 0;
    const maxLive = () => (window.innerWidth < 600 ? 9 : window.innerWidth < 1200 ? 12 : 16);

    function svg([c1, c2]) {
      const id = 'bg' + (++uid);
      return `<svg viewBox="0 0 60 150" xmlns="http://www.w3.org/2000/svg">
        <defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stop-color="#fff" stop-opacity=".9"/>
          <stop offset="25%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
        </radialGradient></defs>
        <path d="M30 2C14 2 3 15 3 31c0 19 17 35 27 41 10-6 27-22 27-41C57 15 46 2 30 2z" fill="url(#${id})"/>
        <path d="M26.5 72h7l-2 5h-3z" fill="${c2}"/>
        <path d="M30 77q-7 17 1 34t-1 37" stroke="rgba(139,34,82,.45)" stroke-width="1.1" fill="none"/>
        <ellipse cx="19" cy="21" rx="4.5" ry="9" fill="#fff" opacity=".5" transform="rotate(-22 19 21)"/>
      </svg>`;
    }

    function spawn({ fast = false } = {}) {
      const small = window.innerWidth < 600;
      const el = document.createElement('div');
      el.className = 'balloon';
      const size = small ? rand(36, 58) : rand(48, 84);
      el.style.left = rand(-2, 96) + '%';
      el.style.setProperty('--bw', size + 'px');
      el.style.setProperty('--dur', (fast ? rand(7, 11) : rand(13, 22)) + 's');
      el.style.setProperty('--sway', rand(2.5, 5) + 's');
      el.style.setProperty('--drift', rand(-80, 80) + 'px');
      el.style.setProperty('--op', rand(0.75, 0.95).toFixed(2));
      el.innerHTML = `<span class="balloon__sway">${svg(pick(COLORS))}</span>`;
      el.addEventListener('animationend', (e) => { if (e.target === el) el.remove(); });
      layer.appendChild(el);
    }

    function ambient() {
      if (!document.hidden && layer.childElementCount < maxLive()) spawn();
    }

    function release(n = 14) {
      const count = reduceMotion ? Math.ceil(n / 3) : n;
      for (let i = 0; i < count; i++) setTimeout(() => { if (layer.childElementCount < 40) spawn({ fast: true }); }, i * 140);
    }

    function startAmbient() {
      for (let i = 0; i < 4; i++) setTimeout(spawn, i * 600);
      setInterval(ambient, 1700);
    }
    return { release, startAmbient };
  })();

  /* -------------------------------------------------------
     MUSIC: plays only after the first tap; pause and mute always available
     ------------------------------------------------------- */
  const Music = (() => {
    const audio = $('#bgMusic');
    const wrap = $('#musicPlayer');
    const toggleBtn = $('#musicToggle');
    const muteBtn = $('#musicMute');
    let fadeRaf;

    function fadeTo(target, ms = 1800) {
      cancelAnimationFrame(fadeRaf);
      const from = audio.volume, t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / ms);
        try { audio.volume = from + (target - from) * k; } catch (_) { /* iOS: volume is read-only */ }
        if (k < 1) fadeRaf = requestAnimationFrame(step);
      };
      fadeRaf = requestAnimationFrame(step);
    }

    function sync() {
      const playing = !audio.paused;
      wrap.classList.toggle('is-playing', playing);
      wrap.classList.toggle('is-muted', audio.muted);
      toggleBtn.setAttribute('aria-pressed', String(playing));
      toggleBtn.setAttribute('aria-label', playing ? 'Pause our song' : 'Play our song');
      muteBtn.setAttribute('aria-pressed', String(audio.muted));
      muteBtn.setAttribute('aria-label', audio.muted ? 'Unmute music' : 'Mute music');
    }

    function play() {
      try { audio.volume = 0; } catch (_) {}
      const p = audio.play();
      if (p && p.then) p.then(() => fadeTo(0.45)).catch(() => sync());
    }
    const pause = () => audio.pause();
    const toggle = () => (audio.paused ? play() : pause());
    const mute = () => { audio.muted = !audio.muted; sync(); };

    toggleBtn.addEventListener('click', toggle);
    muteBtn.addEventListener('click', mute);
    $$('[data-music]').forEach((b) => b.addEventListener('click', () => (b.dataset.music === 'mute' ? mute() : toggle())));
    ['play', 'pause', 'volumechange'].forEach((ev) => audio.addEventListener(ev, sync));
    return { play };
  })();

  /* -------------------------------------------------------
     GENERIC POPUP (modal) and LIGHTBOX
     ------------------------------------------------------- */
  const Modal = (() => {
    const el = $('#modal');
    const body = $('#modalBody');
    const panel = $('.modal__panel', el);
    let lastFocus = null;

    function open(content) {
      if (el.classList.contains('is-open')) close(true);
      lastFocus = document.activeElement;
      body.innerHTML = '';
      if (typeof content === 'string') body.appendChild(document.getElementById(content).content.cloneNode(true));
      else body.appendChild(content);
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      lockScroll(true);
      panel.scrollTop = 0;
      setTimeout(() => panel.focus({ preventScroll: true }), 50);
    }
    function close(silent) {
      if (!el.classList.contains('is-open')) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      lockScroll(false);
      if (!silent && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    }
    el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    return { open, close, isOpen: () => el.classList.contains('is-open') };
  })();

  // Buttons that open a template popup directly
  $$('[data-modal]').forEach((b) => b.addEventListener('click', () => Modal.open(b.dataset.modal)));

  const Lightbox = (() => {
    const el = $('#lightbox');
    const img = $('#lbImg');
    const cap = $('#lbCap');
    const count = $('#lbCount');
    const fig = $('.lightbox__figure', el);
    let list = [], idx = 0;

    function collect() {
      // Every captioned image in the page, deduplicated by src, in document order
      const seen = new Set();
      list = $$('main img[data-caption]').filter((i) => {
        const k = i.getAttribute('src');
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
    }
    function show(i, animate = true) {
      idx = (i + list.length) % list.length;
      const src = list[idx];
      const apply = () => {
        img.src = src.currentSrc || src.src;
        img.alt = src.alt;
        cap.textContent = src.dataset.caption;
        count.textContent = `${idx + 1} / ${list.length}`;
        img.classList.remove('is-swapping');
      };
      if (animate) { img.classList.add('is-swapping'); setTimeout(apply, 180); } else apply();
    }
    function open(target) {
      collect();
      const k = target.getAttribute('src');
      const i = list.findIndex((x) => x.getAttribute('src') === k);
      show(Math.max(0, i), false);
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      lockScroll(true);
      Confetti.burst({ x: window.innerWidth / 2, y: window.innerHeight * 0.3, count: 26, speed: 8 });
    }
    function close() {
      if (!el.classList.contains('is-open')) return;
      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      lockScroll(false);
    }
    el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
    $('.lightbox__nav--prev', el).addEventListener('click', () => show(idx - 1));
    $('.lightbox__nav--next', el).addEventListener('click', () => show(idx + 1));

    // Swipe inside the lightbox
    let sx = 0, sy = 0;
    fig.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
    fig.addEventListener('pointerup', (e) => {
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) show(idx + (dx < 0 ? 1 : -1));
    });
    return { open, close, prev: () => show(idx - 1), next: () => show(idx + 1), isOpen: () => el.classList.contains('is-open') };
  })();

  // Tapping any captioned image opens the lightbox
  $('#site').addEventListener('click', (e) => {
    const target = e.target.closest('img[data-caption]');
    if (!target || !clickAllowed()) return;
    Lightbox.open(target);
  });

  document.addEventListener('keydown', (e) => {
    if (Lightbox.isOpen()) {
      if (e.key === 'Escape') Lightbox.close();
      if (e.key === 'ArrowLeft') Lightbox.prev();
      if (e.key === 'ArrowRight') Lightbox.next();
    } else if (Modal.isOpen() && e.key === 'Escape') Modal.close();
  });

  /* -------------------------------------------------------
     HERO: name reveal, floating hearts, countdown
     ------------------------------------------------------- */
  function splitName() {
    const h = $('#heroName');
    const text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.innerHTML = '';
    let i = 0;
    text.split(/\s+/).forEach((word, w) => {
      if (w > 0) h.appendChild(document.createTextNode(' ')); // real space = natural line-break point
      const wrap = document.createElement('span');
      wrap.className = 'word';
      wrap.setAttribute('aria-hidden', 'true');
      // Split by visible characters so emoji like ❤️ stay in one piece
      const chars = window.Intl && Intl.Segmenter
        ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(word), (g) => g.segment)
        : word.match(/.[️‍]*/gu) || [];
      chars.forEach((ch) => {
        const s = document.createElement('span');
        s.className = 'ch'; s.textContent = ch; s.style.setProperty('--i', i++);
        wrap.appendChild(s);
      });
      h.appendChild(wrap);
    });
    h.classList.add('split');
  }

  function startHearts() {
    const box = $('#heroHearts');
    const glyphs = ['♥', '♡', '❤', '✦', '✧', '♥'];
    const colors = ['#f7d6e0', '#ffb3c7', '#f3dfa2', '#ffffff', '#e9a8b6'];
    let visible = true;
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe($('.hero'));
    setInterval(() => {
      if (!visible || document.hidden || box.childElementCount > 26) return;
      const h = document.createElement('span');
      h.className = 'float-heart';
      h.textContent = pick(glyphs);
      h.style.left = rand(2, 96) + '%';
      h.style.setProperty('--hs', rand(12, isSmall() ? 26 : 34) + 'px');
      h.style.setProperty('--hc', pick(colors));
      h.style.setProperty('--hd', rand(7, 12) + 's');
      h.style.setProperty('--hx', rand(-40, 40) + 'px');
      h.addEventListener('animationend', () => h.remove());
      box.appendChild(h);
    }, 520);
  }

  (function countdown() {
    const nums = { d: $('[data-unit="d"]'), h: $('[data-unit="h"]'), m: $('[data-unit="m"]'), s: $('[data-unit="s"]') };
    const note = $('#countdownNote');
    let celebrated = false;

    function target(now) {
      const y = now.getFullYear();
      const start = new Date(y, 10, 20, 0, 0, 0);   // 20 November, local time
      const end = new Date(y, 10, 21, 0, 0, 0);
      if (now >= start && now < end) return { today: true };
      return { t: now < start ? start : new Date(y + 1, 10, 20, 0, 0, 0) };
    }
    function set(el, v) {
      const s = String(v).padStart(2, '0');
      if (el.textContent !== s) {
        el.textContent = s;
        el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
      }
    }
    function tick() {
      const now = new Date();
      const t = target(now);
      if (t.today) {
        ['d', 'h', 'm', 's'].forEach((k) => set(nums[k], 0));
        note.textContent = "It's your birthday — today! 🎂";
        if (!celebrated && document.body.classList.contains('is-ready')) {
          celebrated = true;
          setTimeout(() => Confetti.rain(160), 1600);
        }
        return;
      }
      let diff = Math.max(0, t.t - now);
      const d = Math.floor(diff / 864e5); diff -= d * 864e5;
      const h = Math.floor(diff / 36e5); diff -= h * 36e5;
      const m = Math.floor(diff / 6e4); diff -= m * 6e4;
      const s = Math.floor(diff / 1e3);
      set(nums.d, d); set(nums.h, h); set(nums.m, m); set(nums.s, s);
    }
    tick();
    setInterval(tick, 1000);
  })();

  /* -------------------------------------------------------
     SCROLL REVEALS (staggered) and PARALLAX
     ------------------------------------------------------- */
  const revealIO = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      en.target.style.setProperty('--delay', Math.min(n++, 6) * 0.09 + 's');
      en.target.classList.add('is-visible');
      revealIO.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  const observeReveals = () => $$('.reveal:not(.is-visible)').forEach((el) => revealIO.observe(el));

  (function parallax() {
    const items = $$('[data-parallax]');
    let ticking = false;
    function update() {
      const vh = window.innerHeight;
      items.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const offset = (r.top + r.height / 2 - vh / 2) * parseFloat(el.dataset.parallax);
        el.style.translate = `0 ${offset.toFixed(1)}px`;
      });
      ticking = false;
    }
    window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  })();

  /* -------------------------------------------------------
     TYPEWRITER letter
     ------------------------------------------------------- */
  (function typewriter() {
    const el = $('#typewriter');
    const text = $('#typewriterText').content.textContent.trim();
    let started = false;
    function type(i = 0) {
      if (i > text.length) { el.classList.add('is-done'); return; }
      el.textContent = text.slice(0, i);
      const ch = text[i - 1];
      const delay = reduceMotion ? 4 : /[.,—!?]/.test(ch) ? 260 : rand(22, 48);
      setTimeout(() => type(i + 1), delay);
    }
    new IntersectionObserver(([en], obs) => {
      if (en.isIntersecting && !started && document.body.classList.contains('is-ready')) {
        started = true; obs.disconnect(); setTimeout(type, 400);
      }
    }, { threshold: 0.35 }).observe(el);
  })();

  /* -------------------------------------------------------
     KEN BURNS slideshows, standing in for videos (tap a reel to pause)
     ------------------------------------------------------- */
  (function kenBurns() {
    $$('[data-kb]').forEach((kb) => {
      const imgs = $$('img', kb);
      const interval = +kb.dataset.interval || 5000;
      kb.style.setProperty('--kb-dur', interval + 1800 + 'ms');
      let i = 0, visible = false;
      imgs[0].classList.add('is-on');
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; }).observe(kb);
      if (imgs.length > 1) {
        setInterval(() => {
          if (!visible || kb.classList.contains('is-paused') || document.hidden) return;
          imgs[i].classList.remove('is-on');
          i = (i + 1) % imgs.length;
          imgs[i].classList.add('is-on');
        }, interval);
      }
    });

    $$('[data-kb-toggle]').forEach((reel) => {
      const kb = $('[data-kb]', reel);
      const badge = $('.reel__badge', reel);
      reel.setAttribute('role', 'button');
      reel.setAttribute('tabindex', '0');
      reel.setAttribute('aria-label', 'Pause or play this memory reel');
      const toggle = () => {
        const paused = !reel.classList.contains('is-paused');
        reel.classList.toggle('is-paused', paused);
        kb.classList.toggle('is-paused', paused);
        badge.innerHTML = `<i></i> ${paused ? 'paused' : 'playing'}`;
      };
      reel.addEventListener('click', toggle);
      reel.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      // Desktop: hovering pauses, like a video preview
      reel.addEventListener('mouseenter', () => { if (!reel.classList.contains('is-paused')) kb.classList.add('is-paused'); });
      reel.addEventListener('mouseleave', () => { if (!reel.classList.contains('is-paused')) kb.classList.remove('is-paused'); });
    });
  })();

  /* -------------------------------------------------------
     CAROUSEL: auto-advance, arrows, dots, swipe
     ------------------------------------------------------- */
  (function carousel() {
    const root = $('#carousel');
    const slides = $$('.carousel__slide', root);
    const dotsWrap = $('.carousel__dots', root);
    const bar = $('.carousel__progress i', root);
    const DUR = 4500;
    let i = 0, hover = false, offscreen = true;
    root.style.setProperty('--cdur', DUR + 'ms');

    const dots = slides.map((_, k) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', `Photo ${k + 1}`);
      b.addEventListener('click', () => go(k, k > i ? 1 : -1));
      dotsWrap.appendChild(b);
      return b;
    });

    function restartBar() { bar.classList.remove('run'); void bar.offsetWidth; bar.classList.add('run'); }
    function updatePause() { root.classList.toggle('is-paused', hover || offscreen || document.hidden); }

    function go(n, dir = 1) {
      const prev = i;
      i = (n + slides.length) % slides.length;
      if (prev !== i) {
        slides[i].style.setProperty('--from', dir > 0 ? '8%' : '-8%');
        void slides[i].offsetWidth;
        slides[prev].style.setProperty('--from', dir > 0 ? '-8%' : '8%');
        slides[prev].classList.remove('is-active');
        slides[i].classList.add('is-active');
      }
      dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
      restartBar();
    }
    bar.addEventListener('animationend', () => go(i + 1, 1));

    $('.carousel__arrow--prev', root).addEventListener('click', () => go(i - 1, -1));
    $('.carousel__arrow--next', root).addEventListener('click', () => go(i + 1, 1));
    root.addEventListener('mouseenter', () => { hover = true; updatePause(); });
    root.addEventListener('mouseleave', () => { hover = false; updatePause(); });
    root.setAttribute('tabindex', '0');
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(i - 1, -1);
      if (e.key === 'ArrowRight') go(i + 1, 1);
    });
    document.addEventListener('visibilitychange', updatePause);
    new IntersectionObserver(([en]) => { offscreen = !en.isIntersecting; updatePause(); }, { threshold: 0.25 }).observe(root);

    // Swipe with touch, pen or mouse
    const vp = $('.carousel__viewport', root);
    let sx = 0, sy = 0, down = false;
    vp.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; hover = true; updatePause(); });
    const end = (e) => {
      if (!down) return;
      down = false;
      if (e.pointerType !== 'mouse') hover = false;
      updatePause();
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { suppressClick(); go(i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }
    };
    vp.addEventListener('pointerup', end);
    vp.addEventListener('pointercancel', () => { down = false; hover = false; updatePause(); });
    vp.addEventListener('dragstart', (e) => e.preventDefault());

    go(0);
    updatePause();
  })();

  /* -------------------------------------------------------
     DRAG SLIDER: native touch scroll plus mouse drag with momentum
     ------------------------------------------------------- */
  (function dragSlider() {
    const el = $('#dragSlider');
    let down = false, startX = 0, startScroll = 0, lastX = 0, lastT = 0, v = 0, moved = 0, raf;
    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return; // touch uses native momentum scroll
      down = true; moved = 0; v = 0;
      startX = lastX = e.clientX; lastT = performance.now();
      startScroll = el.scrollLeft;
      cancelAnimationFrame(raf);
    });
    window.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 6) el.classList.add('is-dragging');
      el.scrollLeft = startScroll - dx;
      const now = performance.now();
      v = (e.clientX - lastX) / Math.max(1, now - lastT) * 16;
      lastX = e.clientX; lastT = now;
    });
    window.addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (moved > 6) suppressClick();
      setTimeout(() => el.classList.remove('is-dragging'), 30);
      const glide = () => {
        el.scrollLeft -= v; v *= 0.94;
        if (Math.abs(v) > 0.4) raf = requestAnimationFrame(glide);
      };
      raf = requestAnimationFrame(glide);
    });
  })();

  /* -------------------------------------------------------
     WISHES WALL: popups, hover tilt, wishes saved in localStorage
     ------------------------------------------------------- */
  (function wishes() {
    const board = $('#wishBoard');
    const form = $('#wishForm');
    const KEY = 'bday-wishes-v1';

    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (_) { return []; } };
    const save = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (_) {} };

    function makeNote({ name, text }, isNew) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'note note--mine reveal is-visible' + (isNew ? ' is-new' : '');
      b.dataset.from = name;
      b.dataset.msg = text;
      const t = document.createElement('span'); t.className = 'note__text'; t.textContent = text;
      const f = document.createElement('span'); f.className = 'note__from'; f.textContent = '— ' + name;
      b.append(t, f);
      return b;
    }
    load().forEach((w) => board.prepend(makeNote(w, false)));

    board.addEventListener('click', (e) => {
      const note = e.target.closest('.note');
      if (!note) return;
      const wrap = document.createElement('div');
      wrap.className = 'popup-center note-pop';
      const img = $('img', note);
      if (img) { const c = img.cloneNode(); c.removeAttribute('loading'); wrap.appendChild(c); }
      const from = document.createElement('p'); from.className = 'note-pop__from'; from.textContent = 'a note from ' + note.dataset.from;
      const msg = document.createElement('p'); msg.textContent = note.dataset.msg;
      const sign = document.createElement('p'); sign.className = 'script-line'; sign.textContent = 'Happy birthday ♡';
      wrap.append(from, msg, sign);
      Modal.open(wrap);
      const c = centerOf(note);
      Confetti.burst({ x: c.x, y: c.y, count: 40, speed: 9 });
    });

    // Hover tilt on devices with a mouse; touch devices get the tap-to-open popup instead
    if (window.matchMedia('(hover: hover)').matches) {
      board.addEventListener('pointermove', (e) => {
        const note = e.target.closest('.note');
        if (!note || !note.classList.contains('is-visible')) return;
        const r = note.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        note.classList.add('is-tilting');
        note.style.transform = `perspective(700px) rotateX(${(-py * 14).toFixed(1)}deg) rotateY(${(px * 14).toFixed(1)}deg) scale(1.05)`;
      });
      board.addEventListener('pointerout', (e) => {
        const note = e.target.closest('.note');
        if (note && !note.contains(e.relatedTarget)) { note.classList.remove('is-tilting'); note.style.transform = ''; }
      });
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('#wishName').value.trim();
      const text = $('#wishText').value.trim();
      if (!name || !text) return;
      const w = { name, text };
      const list = load(); list.push(w); save(list);
      const note = makeNote(w, true);
      board.prepend(note);
      form.reset();
      note.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      setTimeout(() => { const c = centerOf(note); Confetti.burst({ x: c.x, y: c.y, count: 90, speed: 11 }); }, 450);
    });
  })();

  /* -------------------------------------------------------
     CAKE: blow out the candles
     ------------------------------------------------------- */
  (function cake() {
    const cakeEl = $('#cakeEl');
    const btn = $('#makeWish');
    btn.addEventListener('click', () => {
      if (cakeEl.classList.contains('is-out')) {
        cakeEl.classList.remove('is-out');
        btn.textContent = 'Make a Wish ✨';
        return;
      }
      cakeEl.classList.add('is-out');
      btn.textContent = 'Relight the candles 🕯';
      setTimeout(() => {
        const c = centerOf(cakeEl);
        Confetti.burst({ x: c.x, y: c.y - 40, count: 180, speed: 15 });
        Balloons.release(8);
      }, 600);
      setTimeout(() => Modal.open('tpl-wish'), 1500);
    });
  })();

  /* -------------------------------------------------------
     SCRATCH CARD
     ------------------------------------------------------- */
  (function scratch() {
    const card = $('#scratchCard');
    const cvs = $('.scratch__canvas', card);
    const hint = $('#scratchHint');
    const ctx = cvs.getContext('2d', { willReadFrequently: true });
    let w = 0, h = 0, dpr = 1, drawing = false, last = null, moves = 0, cleared = false, touched = false;

    function paint() {
      if (cleared) return;
      w = card.clientWidth; h = card.clientHeight;
      if (!w || !h) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cvs.width = w * dpr; cvs.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#d9a0aa'); g.addColorStop(0.5, '#f3dfa2'); g.addColorStop(1, '#b76e79');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = `rgba(255,255,255,${rand(0.15, 0.6)})`;
        ctx.beginPath(); ctx.arc(rand(0, w), rand(0, h), rand(0.6, 2.2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#8b2252';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = `italic 700 ${Math.max(20, w * 0.075)}px "Playfair Display", Georgia, serif`;
      ctx.fillText('Scratch here ✦', w / 2, h / 2 - 10);
      ctx.font = `500 ${Math.max(11, w * 0.03)}px "DM Mono", monospace`;
      ctx.fillText('a secret is hiding underneath', w / 2, h / 2 + w * 0.06);
      ctx.globalCompositeOperation = 'destination-out';
      touched = false;
    }

    function pos(e) { const r = cvs.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function scratchTo(p) {
      ctx.lineWidth = Math.max(30, w * 0.1);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last ? last.x : p.x, last ? last.y : p.y);
      ctx.lineTo(p.x + 0.01, p.y);
      ctx.stroke();
      last = p;
      touched = true;
      if (++moves % 8 === 0) check();
    }
    function check() {
      const data = ctx.getImageData(0, 0, cvs.width, cvs.height).data;
      let clear = 0, total = 0;
      for (let i = 3; i < data.length; i += 4 * 24) { total++; if (data[i] < 128) clear++; }
      if (clear / total > 0.55) reveal();
    }
    function reveal() {
      if (cleared) return;
      cleared = true;
      cvs.classList.add('is-cleared');
      hint.textContent = 'you found it ♡';
      const c = centerOf(card);
      Confetti.burst({ x: c.x, y: c.y, count: 130, speed: 13 });
    }

    cvs.addEventListener('pointerdown', (e) => {
      drawing = true; last = null;
      try { cvs.setPointerCapture(e.pointerId); } catch (_) {}
      scratchTo(pos(e));
    });
    cvs.addEventListener('pointermove', (e) => { if (drawing) scratchTo(pos(e)); });
    const stop = () => { if (drawing) { drawing = false; last = null; check(); } };
    cvs.addEventListener('pointerup', stop);
    cvs.addEventListener('pointercancel', stop);

    let lastW = 0;
    new ResizeObserver(() => {
      if (card.clientWidth !== lastW && !touched) { lastW = card.clientWidth; paint(); }
    }).observe(card);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (!touched) paint(); });
  })();

  /* -------------------------------------------------------
     GIFT BOXES
     ------------------------------------------------------- */
  $$('.gift-box').forEach((box) => {
    box.addEventListener('click', () => {
      const first = !box.classList.contains('is-open');
      box.classList.add('is-open');
      const c = centerOf(box);
      Confetti.burst({ x: c.x, y: c.y - 20, count: first ? 90 : 40, speed: 11, angle: -Math.PI / 2, spread: Math.PI * 1.2 });
      setTimeout(() => Modal.open('tpl-coupon-' + box.dataset.coupon), first ? 650 : 150);
    });
  });

  /* -------------------------------------------------------
     REASONS: flip cards (click or tap)
     ------------------------------------------------------- */
  $$('.flip').forEach((card) => {
    card.setAttribute('aria-pressed', 'false');
    card.addEventListener('click', () => {
      const on = card.classList.toggle('is-flipped');
      card.setAttribute('aria-pressed', String(on));
      if (on) {
        const c = centerOf(card);
        Confetti.burst({ x: c.x, y: c.y, count: 18, speed: 7 });
      }
    });
  });

  /* -------------------------------------------------------
     FINALE, floating buttons
     ------------------------------------------------------- */
  (function finale() {
    const sec = $('#finale');
    let fired = false;
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !fired && document.body.classList.contains('is-ready')) {
        fired = true;
        Confetti.cannons(3);
        Balloons.release(12);
      }
    }, { threshold: 0.55 }).observe(sec);

    $('#lastThing').addEventListener('click', () => {
      Confetti.cannons(2);
      Balloons.release(10);
      setTimeout(() => Modal.open('tpl-final'), 700);
    });
  })();

  $('#throwConfetti').addEventListener('click', (e) => {
    const c = centerOf(e.currentTarget);
    Confetti.burst({ x: c.x, y: c.y, count: 110, speed: 17, angle: -Math.PI / 2.6, spread: 1.1 });
    Confetti.rain(60);
  });

  (function backToTop() {
    const btn = $('#backToTop');
    const onScroll = () => btn.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.9);
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
    onScroll();
  })();

  /* -------------------------------------------------------
     WELCOME: open the surprise
     ------------------------------------------------------- */
  (function welcome() {
    const overlay = $('#welcome');
    const btn = $('#openSurprise');
    const site = $('#site');
    btn.focus({ preventScroll: true });
    window.scrollTo(0, 0);

    btn.addEventListener('click', () => {
      btn.disabled = true;
      overlay.classList.add('is-opening');
      Music.play(); // the first tap counts as a user gesture, so playback is allowed

      setTimeout(() => {
        const W = window.innerWidth, H = window.innerHeight;
        Confetti.burst({ x: W / 2, y: H * 0.42, count: 240, speed: 17 });
        Confetti.cannons(1);
        Balloons.release(isSmall() ? 14 : 20);
        overlay.classList.add('is-leaving');
        site.classList.add('is-revealed');
        document.body.classList.remove('is-locked');
        document.body.classList.add('is-ready');
        splitName();
        startHearts();
        Balloons.startAmbient();
        observeReveals();
      }, 700);

      setTimeout(() => { overlay.classList.add('is-gone'); overlay.setAttribute('aria-hidden', 'true'); }, 1900);
    });
  })();
})();
