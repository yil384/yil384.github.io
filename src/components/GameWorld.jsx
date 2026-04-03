import { useEffect, useRef } from 'react';

export default function GameWorld({ weather, dayPhase }) {
  const midRef = useRef(null);
  const particleRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Setup mid-ground elements
    const midBg = midRef.current;
    if (midBg) {
      const midElements = [
        { type: 'tree', x: 5, y: 60, shadow: '0 0 0 #0f4a1c, 4px 0 0 #0f4a1c, -4px 0 0 #0f4a1c, 0 -4px 0 #166534, 4px -4px 0 #166534, -4px -4px 0 #166534, 0 -8px 0 #22c55e, 0 4px 0 #854d0e, 0 8px 0 #854d0e' },
        { type: 'tree', x: 15, y: 45, shadow: '0 0 0 #0f4a1c, 4px 0 0 #0f4a1c, -4px 0 0 #0f4a1c, 0 -4px 0 #166534, 4px -4px 0 #166534, -4px -4px 0 #166534, 0 -8px 0 #22c55e, 0 4px 0 #854d0e, 0 8px 0 #854d0e' },
        { type: 'tree', x: 85, y: 55, shadow: '0 0 0 #0f4a1c, 4px 0 0 #0f4a1c, -4px 0 0 #0f4a1c, 0 -4px 0 #166534, 4px -4px 0 #166534, -4px -4px 0 #166534, 0 -8px 0 #22c55e, 0 4px 0 #854d0e, 0 8px 0 #854d0e' },
        { type: 'tree', x: 92, y: 70, shadow: '0 0 0 #0f4a1c, 4px 0 0 #0f4a1c, -4px 0 0 #0f4a1c, 0 -4px 0 #166534, 4px -4px 0 #166534, -4px -4px 0 #166534, 0 -8px 0 #22c55e, 0 4px 0 #854d0e, 0 8px 0 #854d0e' },
        { type: 'glow', x: 8, y: 75, color: '#f97316' },
        { type: 'glow', x: 25, y: 82, color: '#fbbf24' },
        { type: 'glow', x: 70, y: 40, color: '#f97316' },
        { type: 'glow', x: 88, y: 65, color: '#fbbf24' },
        { type: 'glow', x: 50, y: 90, color: '#ef4444' },
        { type: 'crystal', x: 12, y: 50, color: '#818cf8' },
        { type: 'crystal', x: 78, y: 35, color: '#c084fc' },
        { type: 'crystal', x: 35, y: 72, color: '#60a5fa' },
        { type: 'crystal', x: 60, y: 85, color: '#818cf8' },
        { type: 'crystal', x: 95, y: 48, color: '#c084fc' },
      ];
      midElements.forEach(el => {
        const div = document.createElement('div');
        if (el.type === 'tree') {
          div.className = 'mid-tree';
          div.style.cssText = `position:absolute;width:4px;height:4px;opacity:0.5;left:${el.x}%;top:${el.y}%;box-shadow:${el.shadow}`;
        } else if (el.type === 'glow') {
          div.className = 'mid-glow';
          div.style.cssText = `position:absolute;width:6px;height:6px;border-radius:50%;left:${el.x}%;top:${el.y}%;background:radial-gradient(circle,${el.color} 0%,transparent 70%);animation:midGlowPulse 3s ease-in-out infinite;animation-delay:${Math.random()*3}s`;
        } else if (el.type === 'crystal') {
          div.className = 'mid-crystal';
          div.style.cssText = `position:absolute;width:4px;height:8px;opacity:0.4;left:${el.x}%;top:${el.y}%;background:${el.color};box-shadow:0 0 8px ${el.color};animation:crystalSway 4s ease-in-out infinite;animation-delay:${Math.random()*4}s`;
        }
        midBg.appendChild(div);
      });
    }

    // Setup particles
    const pContainer = particleRef.current;
    if (pContainer) {
      const colors = ['#ffd700', '#818cf8', '#60a5fa', '#4ade80', '#c084fc'];
      for (let i = 0; i < 25; i++) {
        const p = document.createElement('div');
        p.className = 'world-particle';
        const size = 2 + Math.random() * 2;
        p.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;top:${Math.random()*100}%;background:${colors[Math.floor(Math.random()*colors.length)]};--dur:${4+Math.random()*4}s;animation-delay:${Math.random()*5}s`;
        pContainer.appendChild(p);
      }
    }
  }, []);

  // Day/Night cycle visual overlay
  const dayOverlays = {
    dawn: 'linear-gradient(180deg, rgba(255,140,50,0.05) 0%, transparent 50%)',
    day: 'none',
    dusk: 'linear-gradient(180deg, rgba(200,100,50,0.08) 0%, rgba(50,20,80,0.05) 100%)',
    night: 'linear-gradient(180deg, rgba(0,0,30,0.15) 0%, rgba(0,0,50,0.1) 100%)',
  };

  return (
    <>
      <div id="world-bg-far" style={{ background: dayOverlays[dayPhase] !== 'none' ? undefined : undefined }} />
      <div id="world-bg-mid" ref={midRef} />
      <div id="world-particles" ref={particleRef} />
      {dayPhase && dayOverlays[dayPhase] !== 'none' && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
          background: dayOverlays[dayPhase],
          transition: 'background 5s ease',
        }} />
      )}
    </>
  );
}
