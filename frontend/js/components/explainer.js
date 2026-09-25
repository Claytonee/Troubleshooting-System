/**
 * Animated explainers — feature 15.
 *
 * PowerCert-style animation, drawn by the app instead of delivered as a video.
 * A 90-second 720p clip is about 8 MB; this is about 45 KB — 180 times smaller.
 * That ratio is not a storage saving, it is the difference between playing and
 * not playing on a 2 GB-RAM tablet over a rural uplink, and it is small enough
 * to sit in the offline shell cache. So the explainer about the dead router
 * still plays when the router is dead, which is the only time it matters.
 *
 * Three things it does that a video cannot:
 *   - it STEPS. A teacher with both hands on a charging hub can stop on step 3
 *     without scrubbing a timeline.
 *   - it switches language instantly, with no second file. One drawing, two
 *     caption tracks (feature 14's rule: never a second translation round-trip).
 *   - it is vector, so it is equally sharp on a 7-inch tablet and a smart screen.
 *
 * Two layers, and the order matters. The FLOOR is CSS class toggles: opacity,
 * a small scale, a pulsing light. That alone carries the whole meaning and runs
 * on Amazon Fire's Silk, Huawei's browser and any low-cost Android build —
 * no SMIL, no Web Animations API, no animated custom properties. On top of it,
 * GSAP 3 (already vendored, free for commercial use since April 2025) adds the
 * flow: things arrive in an order, a cable draws itself rather than appearing,
 * and a packet runs along it so the direction of travel is shown instead of
 * described. That is the difference between a slideshow and an explanation.
 *
 * GSAP is lazy-loaded by this component alone and is never required: if it does
 * not arrive, the CSS floor plays. Motion is never the thing that has to work.
 * `prefers-reduced-motion` keeps every end state and skips the journey.
 */
const Explainer = (() => {
  let current = null;      // the record being shown
  let scene = 0;
  let timer = null;
  let playing = true;
  let lang = 'sw';

  /* ---------------------------------------------------------------- *
   * The drawings. SVG lives here — in git, reviewable — while the
   * script (captions, timing, what to highlight) lives in the database,
   * so wording and translation change without a deploy.
   * ---------------------------------------------------------------- */

  const ART = {
    /** A school's network: tablet → WiFi → router, then two separate paths. */
    network: `
<svg viewBox="0 0 640 300" role="img" aria-label="A tablet connects by WiFi to the router. From the router one path goes to the local LRS server and another goes out to the internet.">
  <g id="tablet" class="ex-part">
    <rect x="18" y="108" width="62" height="86" rx="7" fill="var(--bg4)" stroke="var(--border2)" stroke-width="2"/>
    <rect x="25" y="116" width="48" height="66" rx="3" fill="var(--accent)" opacity=".28"/>
    <text x="49" y="214" class="ex-label">Tablet</text>
  </g>

  <g id="wifi" class="ex-part">
    <path d="M96 151 q14 -16 28 0" fill="none" stroke="var(--teal)" stroke-width="3" stroke-linecap="round"/>
    <path d="M91 161 q19 -23 38 0" fill="none" stroke="var(--teal)" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path d="M86 171 q24 -30 48 0" fill="none" stroke="var(--teal)" stroke-width="3" stroke-linecap="round" opacity=".45"/>
  </g>

  <g id="router" class="ex-part">
    <rect x="152" y="126" width="104" height="52" rx="8" fill="var(--bg3)" stroke="var(--border2)" stroke-width="2"/>
    <line x1="176" y1="126" x2="170" y2="104" stroke="var(--text3)" stroke-width="2"/>
    <line x1="232" y1="126" x2="238" y2="104" stroke="var(--text3)" stroke-width="2"/>
    <g id="lightPower" class="ex-part ex-light"><circle cx="172" cy="166" r="5" fill="var(--green)"/></g>
    <g id="lightLan"   class="ex-part ex-light"><circle cx="192" cy="166" r="5" fill="var(--green)"/></g>
    <g id="lightWan"   class="ex-part ex-light"><circle cx="212" cy="166" r="5" fill="var(--red)"/></g>
    <text x="204" y="198" class="ex-label">Router</text>
  </g>

  <g id="linkLrs" class="ex-part">
    <path d="M256 142 L372 108" fill="none" stroke="var(--green)" stroke-width="3" stroke-dasharray="7 5"/>
    <text x="308" y="92" class="ex-label ex-tag">LAN</text>
  </g>
  <g id="lrs" class="ex-part">
    <rect x="378" y="62" width="112" height="74" rx="8" fill="var(--bg3)" stroke="var(--green)" stroke-width="2"/>
    <rect x="392" y="76" width="84" height="8" rx="2" fill="var(--green)" opacity=".55"/>
    <rect x="392" y="90" width="84" height="8" rx="2" fill="var(--green)" opacity=".35"/>
    <rect x="392" y="104" width="84" height="8" rx="2" fill="var(--green)" opacity=".2"/>
    <text x="434" y="154" class="ex-label">LRS · Quest Forward</text>
  </g>

  <g id="linkWan" class="ex-part">
    <path d="M256 166 L372 216" fill="none" stroke="var(--amber)" stroke-width="3" stroke-dasharray="7 5"/>
    <text x="306" y="204" class="ex-label ex-tag">WAN</text>
  </g>
  <g id="cloud" class="ex-part">
    <path d="M396 232 a22 22 0 0 1 22 -22 a28 28 0 0 1 52 6 a18 18 0 0 1 -2 36 h-50 a22 22 0 0 1 -22 -20 z"
          fill="var(--bg3)" stroke="var(--amber)" stroke-width="2"/>
    <text x="446" y="276" class="ex-label">Internet · sync</text>
  </g>
</svg>`,

    /** A charging hub on a wall socket, with tablets on it. */
    hub: `
<svg viewBox="0 0 640 300" role="img" aria-label="A charging hub plugged into a wall socket, with tablets connected and a status light on its front.">
  <g id="wallPlug" class="ex-part">
    <rect x="26" y="96" width="58" height="66" rx="6" fill="var(--bg4)" stroke="var(--border2)" stroke-width="2"/>
    <circle cx="44" cy="120" r="4" fill="var(--text3)"/>
    <circle cx="66" cy="120" r="4" fill="var(--text3)"/>
    <rect x="46" y="136" width="18" height="6" rx="2" fill="var(--text3)"/>
    <text x="55" y="182" class="ex-label">Soketi · Wall socket</text>
    <path d="M84 130 L176 130" fill="none" stroke="var(--amber)" stroke-width="3"/>
  </g>

  <g id="hub" class="ex-part">
    <rect x="176" y="98" width="180" height="76" rx="10" fill="var(--bg3)" stroke="var(--border2)" stroke-width="2"/>
    <g id="ledOff" class="ex-part ex-light"><circle cx="200" cy="158" r="6" fill="var(--text3)"/></g>
    <g id="ledOn"  class="ex-part ex-light"><circle cx="200" cy="158" r="6" fill="var(--green)"/></g>
    <rect x="222" y="112" width="18" height="24" rx="3" fill="var(--bg4)"/>
    <rect x="248" y="112" width="18" height="24" rx="3" fill="var(--bg4)"/>
    <rect x="274" y="112" width="18" height="24" rx="3" fill="var(--bg4)"/>
    <rect x="300" y="112" width="18" height="24" rx="3" fill="var(--bg4)"/>
    <text x="266" y="196" class="ex-label">Charging hub</text>
  </g>

  <g id="leadBack" class="ex-part">
    <path d="M356 118 L410 118" fill="none" stroke="var(--red)" stroke-width="3" stroke-linecap="round"/>
    <circle cx="414" cy="118" r="7" fill="none" stroke="var(--red)" stroke-width="3"/>
    <text x="410" y="100" class="ex-label ex-tag">kaza hapa</text>
  </g>

  <g id="spare" class="ex-part">
    <rect x="452" y="96" width="46" height="66" rx="6" fill="var(--bg4)" stroke="var(--border2)" stroke-width="2"/>
    <rect x="512" y="96" width="46" height="66" rx="6" fill="var(--bg4)" stroke="var(--border2)" stroke-width="2"/>
    <text x="505" y="182" class="ex-label">Hub nyingine</text>
  </g>
</svg>`
  };

  /* ---------------------------------------------------------------- *
   * Opening and running
   * ---------------------------------------------------------------- */

  /**
   * GSAP, loaded once and only when somebody actually opens an explainer.
   *
   * The same pattern SecurityPage uses: vendored (the CSP allows 'self' only,
   * never a CDN), and injected by the one feature that needs it so a teacher who
   * never opens an explainer never pays the 71 KB — which on a 2 GB tablet over
   * a rural link is a real cost, not a rounding error.
   *
   * It is an ENHANCEMENT. If it fails to load — offline on first use, or a
   * browser that chokes on it — the CSS class toggles below still carry the
   * whole meaning. Motion is never the thing that has to work.
   */
  let gsapReady = null;
  function loadGsap() {
    if (window.gsap) return Promise.resolve(true);
    if (gsapReady) return gsapReady;
    gsapReady = new Promise(resolve => {
      const v = (document.querySelector('script[src*="explainer.js"]') || {}).src || '';
      const q = v.match(/[?&]v=([^&]+)/);
      const s = document.createElement('script');
      s.src = 'js/vendor/gsap.min.js' + (q ? '?v=' + q[1] : '');
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return gsapReady;
  }

  const reducedMotion = () => {
    try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
    catch (e) { return false; }
  };

  /** @param {object} rec the explainer record from /api/assist/explainers/:id */
  function open(rec, startLang) {
    if (!rec || !Array.isArray(rec.scenes) || !rec.scenes.length) return;
    current = rec;
    scene = 0;
    playing = true;
    lang = startLang === 'en' ? 'en' : 'sw';
    Modal.open(title(), body(), footer(), true);
    paint();
    schedule();
    // Arrives a beat later and takes over from the CSS on the next scene, so
    // opening is never held up waiting for a script.
    loadGsap().then(okGsap => { if (okGsap && current) animate(); });
  }

  const title = () => (current.title && current.title[lang]) || (current.title && current.title.sw) || '';

  function body() {
    const art = ART[current.art] || '';
    return `
      <div class="ex-wrap">
        <div class="ex-stage">${art}</div>
        <div class="ex-caption" id="ex-caption"></div>
        <div class="ex-dots" id="ex-dots"></div>
      </div>`;
  }

  function footer() {
    const other = lang === 'sw' ? 'English' : 'Kiswahili';
    const back = lang === 'sw' ? 'Nyuma' : 'Back';
    const next = lang === 'sw' ? 'Mbele' : 'Next';
    return `
      <div class="ex-bar">
        <button type="button" class="btn btn-secondary btn-sm" onclick="Explainer.lang()">
          <i class="ti ti-language"></i> ${esc(other)}
        </button>
        <div class="ex-transport">
          <button type="button" class="btn btn-secondary btn-sm" onclick="Explainer.prev()"><i class="ti ti-player-track-prev"></i> ${esc(back)}</button>
          <button type="button" class="btn btn-secondary btn-sm" id="ex-play" onclick="Explainer.toggle()"><i class="ti ti-player-pause"></i></button>
          <button type="button" class="btn btn-primary btn-sm" onclick="Explainer.next()">${esc(next)} <i class="ti ti-player-track-next"></i></button>
        </div>
      </div>`;
  }

  /** Paints the current scene: the caption, the dots, and what is lit. */
  function paint() {
    const s = current.scenes[scene];
    if (!s) return;

    const cap = document.getElementById('ex-caption');
    if (cap) {
      // Re-triggering the transition is what makes a caption change read as a
      // change rather than as a redraw.
      cap.classList.remove('in');
      cap.textContent = s[lang] || s.sw || s.en || '';
      void cap.offsetWidth;
      cap.classList.add('in');
    }

    const dots = document.getElementById('ex-dots');
    if (dots) {
      dots.innerHTML = current.scenes.map((_, i) =>
        `<button type="button" class="ex-dot${i === scene ? ' on' : ''}${i < scene ? ' done' : ''}"
           aria-label="${i + 1}" onclick="Explainer.go(${i})"></button>`).join('');
    }

    const focus = new Set(s.focus || []);
    const stage = document.querySelector('.ex-stage');
    if (stage) {
      stage.querySelectorAll('.ex-part').forEach(el => {
        el.classList.toggle('on', focus.has(el.id));
        // Nothing is hidden, only dimmed: the whole picture stays legible, so a
        // reader keeps their bearings while one part is being talked about.
        el.classList.toggle('off', focus.size > 0 && !focus.has(el.id));
      });
    }

    const play = document.getElementById('ex-play');
    if (play) play.innerHTML = `<i class="ti ti-player-${playing ? 'pause' : 'play'}"></i>`;

    animate();
  }

  /* ---------------------------------------------------------------- *
   * The motion — GSAP timelines over the same SVG
   * ---------------------------------------------------------------- */

  let tl = null;

  /**
   * What makes an explainer feel like a film rather than a slideshow, and the
   * reason to reach for a timeline at all: things arrive in an order, a cable
   * DRAWS ITSELF rather than appearing, and a packet runs along it so the
   * direction of travel is shown instead of described.
   *
   * All of it is GSAP core — a line drawn with stroke-dashoffset, a packet
   * placed with the SVG DOM's own getPointAtLength. No DrawSVG, no MotionPath,
   * no plugin file beyond the 71 KB already in the repository.
   */
  function animate() {
    if (!window.gsap || !current) return;
    const stage = document.querySelector('.ex-stage');
    const s = current.scenes[scene];
    if (!stage || !s) return;

    if (tl) { tl.kill(); tl = null; }
    clearPackets(stage);

    const focus = new Set(s.focus || []);
    const parts = [...stage.querySelectorAll('.ex-part')];
    const lit = parts.filter(p => focus.has(p.id));
    const rest = parts.filter(p => !focus.has(p.id));

    // Reduced motion keeps every end state and skips the journey. The
    // highlighting is what carries the meaning; the movement only decorates it.
    if (reducedMotion()) {
      gsap.set(rest, { opacity: focus.size ? 0.22 : 1 });
      gsap.set(lit, { opacity: 1 });
      return;
    }

    tl = gsap.timeline();
    tl.to(rest, { opacity: focus.size ? 0.22 : 1, duration: 0.45, ease: 'power2.out' }, 0);
    tl.fromTo(lit,
      { opacity: 0.35 },
      { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: 0.12 }, 0);

    // A cable or a signal path draws itself in the direction it carries.
    lit.forEach((g, i) => {
      const line = g.querySelector('path[stroke-dasharray], path.ex-draw');
      if (!line || typeof line.getTotalLength !== 'function') return;
      const L = line.getTotalLength();
      if (!L) return;
      tl.fromTo(line,
        { strokeDasharray: L, strokeDashoffset: L },
        { strokeDashoffset: 0, duration: 0.9, ease: 'power1.inOut' }, 0.15 + i * 0.1);
      tl.add(() => sendPacket(stage, line), 0.9 + i * 0.1);
    });

    const cap = document.getElementById('ex-caption');
    if (cap) tl.fromTo(cap, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }, 0.1);
  }

  /**
   * A dot running the length of a cable — the one gesture that turns a diagram
   * into an explanation, because it shows which way the traffic goes.
   */
  function sendPacket(stage, line) {
    const svg = stage.querySelector('svg');
    if (!svg || !window.gsap) return;
    const L = line.getTotalLength();
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('r', '4.5');
    dot.setAttribute('fill', line.getAttribute('stroke') || 'var(--accent)');
    dot.setAttribute('class', 'ex-packet');
    svg.appendChild(dot);
    const at = { d: 0 };
    gsap.to(at, {
      d: L, duration: 1.1, ease: 'power1.inOut', repeat: 1, repeatDelay: 0.35,
      onUpdate() {
        const p = line.getPointAtLength(at.d);
        dot.setAttribute('cx', p.x);
        dot.setAttribute('cy', p.y);
      },
      onComplete() { dot.remove(); }
    });
  }

  const clearPackets = (stage) => stage.querySelectorAll('.ex-packet').forEach(d => d.remove());

  function schedule() {
    clearTimeout(timer);
    if (!playing || !current) return;
    const s = current.scenes[scene];
    const ms = Math.max(2500, Math.min(20000, Number(s && s.ms) || 7000));
    timer = setTimeout(() => {
      if (scene < current.scenes.length - 1) { scene++; paint(); schedule(); }
      else { playing = false; paint(); }   // stops at the end; never loops at somebody
    }, ms);
  }

  function go(i) {
    if (!current) return;
    scene = Math.max(0, Math.min(current.scenes.length - 1, i));
    paint();
    schedule();
  }
  const next = () => go(scene + 1);
  const prev = () => go(scene - 1);

  /** Any manual step pauses: somebody driving it themselves does not want a timer. */
  function toggle() {
    playing = !playing;
    paint();
    if (playing) schedule(); else clearTimeout(timer);
  }

  /**
   * Switches language and remembers it on the ACCOUNT — tablets are shared, so
   * browser storage would follow the tablet rather than the person (feature 14).
   */
  async function setLang() {
    lang = lang === 'sw' ? 'en' : 'sw';
    const t = document.getElementById('modal-title');
    if (t) t.textContent = title();
    const f = document.getElementById('modal-footer');
    if (f) f.innerHTML = footer();
    paint();
    try { await API.setLanguage(lang); } catch (e) { /* the panel already switched */ }
  }

  function close() {
    clearTimeout(timer);
    if (tl) { tl.kill(); tl = null; }
    const stage = document.querySelector(".ex-stage");
    if (stage) clearPackets(stage);
    current = null;
  }

  return { open, go, next, prev, toggle, close, lang: setLang, ART };
})();
