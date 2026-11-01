import { useState, useEffect, useRef } from 'react';

const MAX_DT = 1 / 30;

/**
 * Lightweight, frame-rate independent spring driven by requestAnimationFrame.
 * Uses real frame deltas so motion feels the same at 60 Hz, 120 Hz or under load.
 * @param {number} targetValue
 * @param {{ stiffness?: number, damping?: number }} options
 */
export default function useSpring(targetValue, { stiffness = 120, damping = 28 } = {}) {
  const [currentValue, setCurrentValue] = useState(targetValue);
  const velocityRef = useRef(0);
  const valueRef = useRef(targetValue);
  const targetRef = useRef(targetValue);
  const rAFRef = useRef(null);
  const lastRef = useRef(0);

  useEffect(() => {
    targetRef.current = targetValue;

    const animate = (now) => {
      const dt = lastRef.current ? Math.min(Math.max((now - lastRef.current) / 1000, 0), MAX_DT) : 1 / 60;
      lastRef.current = now;

      const target = targetRef.current;
      const accel = (target - valueRef.current) * stiffness - velocityRef.current * damping;
      velocityRef.current += accel * dt;
      valueRef.current += velocityRef.current * dt;

      if (Math.abs(velocityRef.current) < 0.05 && Math.abs(target - valueRef.current) < 0.05) {
        valueRef.current = target;
        velocityRef.current = 0;
        rAFRef.current = null;
        lastRef.current = 0;
        setCurrentValue(target);
      } else {
        setCurrentValue(valueRef.current);
        rAFRef.current = requestAnimationFrame(animate);
      }
    };

    if (!rAFRef.current) {
      lastRef.current = 0;
      rAFRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (rAFRef.current) {
        cancelAnimationFrame(rAFRef.current);
        rAFRef.current = null;
      }
    };
  }, [targetValue, stiffness, damping]);

  return currentValue;
}
