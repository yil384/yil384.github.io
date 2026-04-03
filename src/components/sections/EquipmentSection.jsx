import { useEffect, useRef } from 'react';

const projects = [
  { icon: '\u{1F5E1}\uFE0F', name: 'Starry-Next', desc: 'Monolithic Kernel OS', rarity: 'epic', backTitle: 'Starry-Next', backDesc: 'Implemented networking component as a graduation project for a monolithic kernel OS.', link: 'https://github.com/yil384/Starry-Next' },
  { icon: '\u{1F6E1}\uFE0F', name: 'IM System', desc: 'Real-time Chat Platform', rarity: 'rare', backTitle: 'IM System', backDesc: 'Built real-time chat website with WebSocket and Django.', link: 'https://github.com/yil384/Instant-messaging-system-frontend' },
  { icon: '\u{1F4DC}', name: 'CST-OJ', desc: 'Rust Code Evaluation', rarity: 'rare', backTitle: 'CST-OJ', backDesc: 'Built Rust-based platform for data structure assignment grading.', link: 'https://github.com/yil384/CST-OJ-Rust' },
  { icon: '\u26A1', name: 'TritonGym', desc: 'LLM Agent Flow', rarity: 'legendary', backTitle: 'TritonGym', backDesc: 'Proposed new algorithm for tool-augmented LLMs in GPU code generation.', link: null },
];

export default function EquipmentSection() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="equipment" className="section anim-target" ref={ref} data-zone="~ ARMORY ~" style={{ position: 'relative' }}>
      <div className="section-title">EQUIPMENT</div>
      <div className="equip-grid">
        {projects.map((p, i) => (
          <div key={i} className="equip-card" data-rarity={p.rarity}>
            <div className="equip-inner">
              <div className="equip-front pixel-border">
                <div className="equip-icon">{p.icon}</div>
                <div className="equip-name pixel-font">{p.name}</div>
                <div className="equip-desc">{p.desc}</div>
                <div className={`equip-rarity pixel-font ${p.rarity}`}>{p.rarity.toUpperCase()}</div>
              </div>
              <div className="equip-back pixel-border">
                <div className="equip-back-title pixel-font gold">{p.backTitle}</div>
                <p className="equip-back-desc">{p.backDesc}</p>
                {p.link ? (
                  <a href={p.link} target="_blank" rel="noopener noreferrer" className="equip-link pixel-font">{'\u2192'} GitHub</a>
                ) : (
                  <span className="equip-link pixel-font" style={{ color: 'var(--text-muted)' }}>Research Project</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
