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
    this.x = Math.random() * width;
  }

  reset(width, height) {
    this.x = 0;
    this.y = Math.random() * height;
    
    // Parallax depth: 0.2 (far, slow, tiny) to 1.0 (near, fast, larger)
    this.depth = Math.random() * 0.8 + 0.2;
    
    // Slightly more prominent star sizes: from 0.2px (deep) to 2.3px (foreground)
    this.size = (Math.random() * 1.5 + 0.8) * this.depth;
    
    // Drift speed based on depth
    this.baseSpeedX = (Math.random() * 0.35 + 0.2) * this.depth;
    this.speedY = (Math.random() - 0.5) * 0.1 * this.depth;
    
    // Slightly more prominent alpha range: 0.2 to 0.7
    this.alpha = (Math.random() * 0.5 + 0.2) * this.depth;
  }

  update(currSpeed, width, height) {
    // Defensive check: ensure speed is a valid finite number
    const validSpeed = Number.isFinite(currSpeed) && currSpeed > 0 ? currSpeed : 0;
    
    // Speed multiplier curves up faster (division by 3.5 instead of 6) and caps higher (60x instead of 45x)
    const speedMultiplier = 1 + Math.min(validSpeed / 3.5, 60) * this.depth;
    this.x += this.baseSpeedX * speedMultiplier;
    this.y += this.speedY;

    if (this.x > width) {
      this.reset(width, height);
    }
  }

  draw(ctx, currSpeed, color) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = this.size;

    // Stretch particles into thin glowing vector streaks as speed increases
    const validSpeed = Number.isFinite(currSpeed) && currSpeed > 0 ? currSpeed : 0;
    const speedFactor = Math.min(validSpeed / 3.5, 60);
    
    if (speedFactor > 1.5) {
      const length = Math.min(speedFactor * 1.8 * this.depth, 80);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - length, this.y);
      ctx.stroke();
    } else {
      // Circular micro-particles at rest/low speed
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
const ParticleBackground = memo(({ speed, status }) => {
  const canvasRef = useRef(null);
  
  // Track speed and status using refs to prevent animation loops from tearing down
  const speedRef = useRef(speed);
  const statusRef = useRef(status);

  useEffect(() => {
    speedRef.current = speed;
    statusRef.current = status;
  }, [speed, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // 100 particles gives a rich but highly-optimized starry cosmos
    const particleCount = 100;
    const particles = Array.from({ length: particleCount }, () => new Particle(width, height));

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      const currentStatus = statusRef.current;
      
      // Speed test is running only during pinging, downloading, or uploading phases
      const isRunning = currentStatus === 'pinging' || currentStatus === 'downloading' || currentStatus === 'uploading';
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
        particles[i].draw(ctx, currentSpeed, color);
      }

      animationId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', handleResize);
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
