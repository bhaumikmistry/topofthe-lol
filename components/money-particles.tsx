'use client';

import { useEffect, useRef } from 'react';

const GLYPHS = ['$', '#1', '$$', 'BID', '$', '↑', '$', '#'];
const COUNT = 34;

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  drift: number;
  glyph: string;
  hot: boolean;
}

/**
 * Drifting money glyphs behind the page. Canvas rather than DOM nodes so the
 * count costs nothing in layout, and it parks itself whenever the tab is hidden
 * or the viewer asks for reduced motion.
 */
export function MoneyParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let particles: Particle[] = [];

    const seed = () => {
      particles = Array.from({ length: COUNT }, (_, index) => ({
        x: Math.random() * width,
        y: Math.random() * height,
        size: 11 + Math.random() * 26,
        speed: 0.12 + Math.random() * 0.5,
        drift: (Math.random() - 0.5) * 0.25,
        glyph: GLYPHS[index % GLYPHS.length],
        hot: index % 7 === 0,
      }));
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!particles.length) seed();
    };

    const isDark = () => document.documentElement.classList.contains('dark');

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const ink = isDark() ? 'rgba(253, 253, 248, 0.13)' : 'rgba(0, 0, 0, 0.10)';
      const hot = isDark() ? 'rgba(255, 92, 0, 0.28)' : 'rgba(255, 92, 0, 0.22)';

      for (const particle of particles) {
        context.font = `700 ${particle.size}px ui-monospace, SFMono-Regular, Menlo, monospace`;
        context.fillStyle = particle.hot ? hot : ink;
        context.fillText(particle.glyph, particle.x, particle.y);

        if (reduced) continue;
        particle.y -= particle.speed;
        particle.x += particle.drift;
        if (particle.y < -40) {
          particle.y = height + 40;
          particle.x = Math.random() * width;
        }
        if (particle.x < -60) particle.x = width + 40;
        if (particle.x > width + 60) particle.x = -40;
      }
    };

    const tick = () => {
      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      cancelAnimationFrame(frame);
      if (reduced) {
        draw();
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) cancelAnimationFrame(frame);
      else start();
    };

    resize();
    start();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full"
    />
  );
}
