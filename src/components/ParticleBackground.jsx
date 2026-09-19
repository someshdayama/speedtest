/**
 * @file ParticleBackground.jsx
 * High-performance HTML5 Canvas-based speed-reactive particle backdrop.
 * Smooth color morphing between test phases using linear interpolation.
 */

import { useEffect, useRef, memo } from 'react';

class Particle {
  constructor(width, height) {
    this.reset(width, height);
    this.x = Math.random() * (width + 120) - 60;
  }

  reset(width, height) {
    this.x = -60;
    this.baseY = Math.random() * height;
    this.y = this.baseY;
    this.depth = Math.random() * 0.8 + 0.2;
    this.size = (Math.random() * 1.5 + 0.8) * this.depth;
    this.baseSpeedX = (Math.random() * 0.4 + 0.4) * this.depth;
    this.wavePhase = Math.random() * Math.PI * 2;
    this.waveAmplitude = (Math.random() * 10 + 5) * (1 - this.depth);
    this.waveFrequency = Math.random() * 0.005 + 0.002;
    this.alpha = (Math.random() * 0.45 + 0.2) * this.depth;
  }

  update(currSpeed, width, height) {
    const validSpeed = Number.isFinite(currSpeed) && currSpeed > 0 ? currSpeed : 0;
    const speedMultiplier = 1 + Math.min(validSpeed / 2.0, 90) * this.depth;
    this.x += this.baseSpeedX * speedMultiplier;
    this.y = this.baseY + Math.sin(this.x * this.waveFrequency + this.wavePhase) * this.waveAmplitude;
    if (this.x > width + 60) this.reset(width, height);
  }

  draw(ctx, currSpeed, r, g, b, width, height) {
    if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) return;
    ctx.save();
    let edgeAlpha = 1;
    if (this.x < 100) edgeAlpha = this.x / 100;
    else if (this.x > width - 100) edgeAlpha = (width - this.x) / 100;
    edgeAlpha = Math.max(0, Math.min(1, edgeAlpha));
    ctx.globalAlpha = this.alpha * edgeAlpha;
    const color = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = this.size;
    const validSpeed = Number.isFinite(currSpeed) && currSpeed > 0 ? currSpeed : 0;
    const speedFactor = Math.min(validSpeed / 2.0, 90);
    if (speedFactor > 1.5) {
      const length = Math.min(speedFactor * 2.2 * this.depth, 160);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - length, this.y);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// Target color [r, g, b] per status
const STATUS_COLORS = {
  idle:        [255, 255, 255],
  pinging:     [240, 180,  41],
  downloading: [ 94,  94, 240],
  uploading:   [ 61, 214, 140],
  finished:    [200, 200, 220],
  error:       [248, 113, 113],
};

const lerp = (a, b, t) => a + (b - a) * t;
const LERP_SPEED = 0.022; // ~1.5s transition at 60fps

const ParticleBackground = memo(({ status }) => {
  const canvasRef = useRef(null);
  const speedRef = useRef(0);
  const statusRef = useRef(status);

  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    const handleSpeed = (e) => { speedRef.current = e.detail; };
    window.addEventListener('speed-update', handleSpeed);
    return () => window.removeEventListener('speed-update', handleSpeed);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    let width = window.innerWidth;
    let height = window.innerHeight;
    // Start with idle color
    let currentColor = [...STATUS_COLORS['idle']];

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    const particleCount = 100;
    const particles = Array.from({ length: particleCount }, () => new Particle(width, height));

    const tick = () => {
      const currentStatus = statusRef.current;
      const isRunning = currentStatus === 'pinging' || currentStatus === 'downloading' || currentStatus === 'uploading';
      ctx.clearRect(0, 0, width, height);
      const currentSpeed = isRunning ? speedRef.current : 0;

      // Smoothly interpolate toward target color
      const target = STATUS_COLORS[currentStatus] || STATUS_COLORS['idle'];
      currentColor[0] = lerp(currentColor[0], target[0], LERP_SPEED);
      currentColor[1] = lerp(currentColor[1], target[1], LERP_SPEED);
      currentColor[2] = lerp(currentColor[2], target[2], LERP_SPEED);

      const [r, g, b] = currentColor;
      for (let i = 0; i < particles.length; i++) {
        particles[i].update(currentSpeed, width, height);
        particles[i].draw(ctx, currentSpeed, r, g, b, width, height);
      }
      animationId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: -1,
        background: 'transparent',
      }}
    />
  );
});

ParticleBackground.displayName = 'ParticleBackground';
export default ParticleBackground;
