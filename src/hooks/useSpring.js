import { useState, useEffect, useRef } from 'react';

/**
 * A lightweight spring animation hook using requestAnimationFrame.
 * @param {number} targetValue
 * @param {object} options
 */
export default function useSpring(targetValue, { stiffness = 120, damping = 28 } = {}) {
  const [currentValue, setCurrentValue] = useState(targetValue);
  const velocityRef = useRef(0);
  const valueRef = useRef(targetValue);
  const targetRef = useRef(targetValue);
  const rAFRef = useRef(null);

  useEffect(() => {
    targetRef.current = targetValue;
    
    const animate = () => {
      const target = targetRef.current;
      const current = valueRef.current;
      const velocity = velocityRef.current;

      const delta = target - current;
      const springForce = delta * stiffness;
      const dampingForce = velocity * damping;
      const acceleration = springForce - dampingForce;

      const newVelocity = velocity + acceleration * (1 / 60);
      const newValue = current + newVelocity * (1 / 60);

      velocityRef.current = newVelocity;
      valueRef.current = newValue;

      if (Math.abs(newVelocity) < 0.05 && Math.abs(target - newValue) < 0.05) {
        valueRef.current = target;
        velocityRef.current = 0;
        setCurrentValue(target);
      } else {
        setCurrentValue(newValue);
        rAFRef.current = requestAnimationFrame(animate);
      }
    };

    if (!rAFRef.current) {
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
