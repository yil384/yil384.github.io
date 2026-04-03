import { useEffect, useRef } from 'react';

const skills = [
  { name: 'Python', level: 90, lv: 9, color: 'var(--green)' },
  { name: 'C++', level: 85, lv: 8, color: 'var(--blue)' },
  { name: 'Go', level: 70, lv: 7, color: 'var(--purple)' },
  { name: 'Rust', level: 75, lv: 7, color: 'var(--orange)' },
  { name: 'TypeScript', level: 65, lv: 6, color: '#06b6d4' },
  { name: 'JavaScript', level: 60, lv: 6, color: '#eab308' },
  { name: 'Verilog', level: 50, lv: 5, color: 'var(--red)' },
];

const tools = ['Linux', 'Vim', 'LaTeX', 'WebSocket', 'Django', 'MongoDB'];

export default function Attributes() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          e.target.querySelectorAll('.attr-row').forEach(row => {
            const level = row.dataset.level;
            const fill = row.querySelector('.attr-fill');
            if (fill) fill.style.width = level + '%';
          });
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="attributes" className="section anim-target" ref={ref} data-zone="~ TRAINING GROUNDS ~" style={{ position: 'relative' }}>
      <div className="section-title">ATTRIBUTES</div>
      <div className="pixel-border" style={{ padding: '24px' }}>
        {skills.map(s => (
          <div key={s.name} className="attr-row" data-level={s.level}>
            <span className="attr-name pixel-font">{s.name}</span>
            <span className="attr-bar"><span className="attr-fill" style={{ '--color': s.color, background: s.color }} /></span>
            <span className="attr-lv pixel-font">Lv.{s.lv}</span>
          </div>
        ))}
        <div className="tool-badges">
          {tools.map(t => (
            <span key={t} className="tool-badge pixel-font">{t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
