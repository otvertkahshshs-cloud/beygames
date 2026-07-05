/**
 * Single large slow smoke cloud background effect.
 * One big drifting smoke mass rendered with layered blobs.
 */
(function () {
  'use strict';

  /* ---------- canvas setup ---------- */
  const canvas = document.createElement('canvas');
  canvas.id = 'steam-canvas';
  canvas.style.cssText = [
    'position:fixed',
    'inset:0',
    'width:100%',
    'height:100%',
    'pointer-events:none',
    'z-index:0',
    'opacity:1',
  ].join(';');
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const W = () => canvas.width;
  const H = () => canvas.height;

  /* ---------- single large cloud ---------- */
  // The cloud is made of BLOB_COUNT overlapping radial-gradient blobs
  // that all share a common center but have individual offsets and sizes.
  // The whole group drifts slowly across the screen.

  const BLOB_COUNT = 18;

  const cloud = {
    // center of the cloud mass
    cx: 0,
    cy: 0,
    // drift velocity (pixels/frame)
    vx: 0,
    vy: 0,
    // turbulence angle
    angle: 0,
    angleSpeed: 0.0012,
    // master alpha (fade in/out)
    alpha: 0,
    alphaTarget: 0,
    alphaSpeed: 0.00025,
    blobs: [],

    init() {
      // start somewhere in the lower-center area
      this.cx = W() * 0.3 + Math.random() * W() * 0.4;
      this.cy = H() * 0.45 + Math.random() * H() * 0.35;
      this.vx = (Math.random() - 0.5) * 0.12;
      this.vy = -(0.06 + Math.random() * 0.10);
      this.angle = Math.random() * Math.PI * 2;
      this.alpha = 0;
      this.alphaTarget = 0.38 + Math.random() * 0.20;

      // build blobs relative to center
      this.blobs = [];
      for (let i = 0; i < BLOB_COUNT; i++) {
        const ang  = Math.random() * Math.PI * 2;
        const dist = Math.random() * 160;
        this.blobs.push({
          ox: Math.cos(ang) * dist,   // offset from center
          oy: Math.sin(ang) * dist,
          r : 120 + Math.random() * 220,  // radius of this blob
          // individual slow wobble
          wobAng : Math.random() * Math.PI * 2,
          wobSpd : (Math.random() - 0.5) * 0.006,
          wobAmp : 18 + Math.random() * 30,
          grey   : 185 + Math.floor(Math.random() * 55),
        });
      }
    },

    update() {
      // turbulent drift
      this.angle += this.angleSpeed;
      this.cx += this.vx + Math.sin(this.angle) * 0.18;
      this.cy += this.vy + Math.cos(this.angle * 0.7) * 0.10;

      // slowly expand the cloud over time
      for (const b of this.blobs) {
        b.r += 0.04;
        b.wobAng += b.wobSpd;
      }

      // alpha fade-in / fade-out lifecycle
      if (this.alpha < this.alphaTarget) {
        this.alpha = Math.min(this.alpha + this.alphaSpeed, this.alphaTarget);
      } else if (this.alpha > this.alphaTarget) {
        this.alpha = Math.max(this.alpha - this.alphaSpeed * 0.7, 0);
      }

      // start fading when cloud drifts off screen or gets too big
      const margin = 340;
      const offscreen =
        this.cx < -margin || this.cx > W() + margin ||
        this.cy < -margin || this.cy > H() + margin;
      if (offscreen || this.blobs[0].r > 700) {
        this.alphaTarget = 0;
      }

      // re-spawn once fully invisible
      if (this.alphaTarget === 0 && this.alpha <= 0.001) {
        this.init();
      }
    },

    draw(ctx) {
      ctx.globalCompositeOperation = 'screen';
      for (const b of this.blobs) {
        const bx = this.cx + b.ox + Math.sin(b.wobAng) * b.wobAmp;
        const by = this.cy + b.oy + Math.cos(b.wobAng * 0.8) * b.wobAmp * 0.6;

        const grad = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
        const a0 = this.alpha * 0.55;
        const a1 = this.alpha * 0.28;
        grad.addColorStop(0,   `rgba(${b.grey},${b.grey},${b.grey},${a0})`);
        grad.addColorStop(0.45, `rgba(${b.grey},${b.grey},${b.grey},${a1})`);
        grad.addColorStop(1,   `rgba(${b.grey},${b.grey},${b.grey},0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(bx, by, b.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
  };

  cloud.init();

  /* ---------- render loop ---------- */
  function tick() {
    ctx.clearRect(0, 0, W(), H());
    cloud.update();
    cloud.draw(ctx);
    requestAnimationFrame(tick);
  }

  tick();
})();
