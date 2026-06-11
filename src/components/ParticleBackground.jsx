/**
 * @file ParticleBackground.jsx
 * High-performance HTML5 Canvas-based speed-reactive particle backdrop.
 * Renders a starry cosmos with parallax depth and vector stretching speed streaks.
 */

import { useEffect, useRef, memo } from 'react';

class Particle {
  constructor(width, height) {
    this.reset(width, height);
    // Initially randomize x positions so they don't all start from the left edge
    this.x = Math.random() * (width + 120) - 60;
  }

  reset(width, height) {
    this.x = -60;
    this.baseY = Math.random() * height;
    this.y = this.baseY;
    
    // Parallax depth: 0.2 (far, slow, tiny) to 1.0 (near, fast, larger)
    this.depth = Math.random() * 0.8 + 0.2;
    this.size = (Math.random() * 1.5 + 0.8) * this.depth;
    
    this.baseSpeedX = (Math.random() * 0.4 + 0.4) * this.depth;
    
    // Wave movement parameters (sine wave displacement)
    this.wavePhase = Math.random() * Math.PI * 2;
    this.waveAmplitude = (Math.random() * 10 + 5) * (1 - this.depth); // background waves drift more vertically
    this.waveFrequency = Math.random() * 0.005 + 0.002;
    
    this.alpha = (Math.random() * 0.45 + 0.2) * this.depth;
  }

  update(currSpeed, width, height) {
    const validSpeed = Number.isFinite(currSpeed) && currSpeed > 0 ? currSpeed : 0;
    const speedMultiplier = 1 + Math.min(validSpeed / 2.0, 90) * this.depth;
    this.x += this.baseSpeedX * speedMultiplier;
    
    // Soft sinusoidal wave displacement
    this.y = this.baseY + Math.sin(this.x * this.waveFrequency + this.wavePhase) * this.waveAmplitude;

    if (this.x > width + 60) {
      this.reset(width, height);
    }
  }

  draw(ctx, currSpeed, color, width, height) {
    // Boundary checks
    if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
      return;
    }

    ctx.save();
    
    // Boundary edge fade-in / fade-out to prevent sudden popping
    let edgeAlpha = 1;
    if (this.x < 100) {
      edgeAlpha = this.x / 100;
    } else if (this.x > width - 100) {
      edgeAlpha = (width - this.x) / 100;
    }
    edgeAlpha = Math.max(0, Math.min(1, edgeAlpha));
    
    ctx.globalAlpha = this.alpha * edgeAlpha;
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

/**
 * @param {{ speed: number, status: string }} props
 */
const ParticleBackground = memo(({ status }) => {
  const canvasRef = useRef(null);
  
  const speedRef = useRef(0);
  const statusRef = useRef(status);
  const wakeUpRef = useRef(null);

  useEffect(() => {
    statusRef.current = status;
    if (wakeUpRef.current) {
      wakeUpRef.current();
    }
  }, [status]);

  useEffect(() => {
    const handleSpeed = (e) => {
      speedRef.current = e.detail;
      if (wakeUpRef.current) {
        wakeUpRef.current();
      }
    };
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
    let lastActiveTime = Date.now();
    let isSuspended = false;

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

    const handleResize = () => {
      resizeCanvas();
    };
    window.addEventListener('resize', handleResize, { passive: true });

    const wakeUp = () => {
      lastActiveTime = Date.now();
      if (isSuspended) {
        isSuspended = false;
        animationId = requestAnimationFrame(tick);
      }
    };
    wakeUpRef.current = wakeUp;

    window.addEventListener('mousemove', wakeUp, { passive: true });
    window.addEventListener('touchstart', wakeUp, { passive: true });

    // 100 particles gives a rich but highly-optimized starry cosmos
    const particleCount = 100;
    const particles = Array.from({ length: particleCount }, () => new Particle(width, height));

    const tick = () => {
      const currentStatus = statusRef.current;
      const isRunning = currentStatus === 'pinging' || currentStatus === 'downloading' || currentStatus === 'uploading';
      
      if (isRunning) {
        lastActiveTime = Date.now();
      } else if (Date.now() - lastActiveTime > 5000) {
        isSuspended = true;
        ctx.clearRect(0, 0, width, height);
        return;
      }

      ctx.clearRect(0, 0, width, height);

      const currentSpeed = isRunning ? speedRef.current : 0;

      // Map color profiles (solid colors, opacity is controlled entirely by particle alpha)
      let color = 'rgb(255, 255, 255)'; // Idle
      if (currentStatus === 'pinging') {
        color = 'rgb(240, 180, 41)'; // Ping: Warm Amber
      } else if (currentStatus === 'downloading') {
        color = 'rgb(94, 94, 240)'; // Download: Violet/Indigo
      } else if (currentStatus === 'uploading') {
        color = 'rgb(61, 214, 140)'; // Upload: Green/Mint
      } else if (currentStatus === 'finished') {
        color = 'rgb(255, 255, 255)'; // Finished: Soft white
      }

      for (let i = 0; i < particles.length; i++) {
        particles[i].update(currentSpeed, width, height);
        particles[i].draw(ctx, currentSpeed, color, width, height);
      }

      animationId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', wakeUp);
      window.removeEventListener('touchstart', wakeUp);
      wakeUpRef.current = null;
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
