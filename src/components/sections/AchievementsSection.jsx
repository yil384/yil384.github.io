import { useEffect, useRef } from 'react';

export default function AchievementsSection() {
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
    <section id="achievements" className="section anim-target" ref={ref} data-zone="~ TROPHY ROOM ~" style={{ position: 'relative' }}>
      <div className="section-title">ACHIEVEMENTS</div>
      <div className="achievement-list">
        <div className="achievement-card pixel-border" data-rarity="silver">
          <div className="ach-icon">{'\u{1F948}'}</div>
          <div className="ach-body">
            <div className="ach-name pixel-font">TRITONGYM</div>
            <div className="ach-desc">A Benchmark for Agentic LLM Workflows in Triton GPU Code Generation</div>
            <div className="ach-authors">Yue Guan*, <span className="gold">Yichen Lin*</span>, et al.</div>
            <div className="ach-venue pixel-font">In submission to ICLR 2026</div>
          </div>
        </div>
        <div className="achievement-card pixel-border" data-rarity="gold">
          <div className="ach-icon">{'\u{1F3C6}'}</div>
          <div className="ach-body">
            <div className="ach-name pixel-font">(Re){'\u00B2'}H{'\u2082'}O</div>
            <div className="ach-desc">Autonomous Driving Scenario Generation via Reversely Regularized Hybrid Offline-and-Online RL</div>
            <div className="ach-authors">Haoyi Niu*, Kun Ren*, <span className="gold">Yichen Lin</span>, et al.</div>
            <div className="ach-venue pixel-font">IEEE IV 2023</div>
          </div>
        </div>
      </div>
    </section>
  );
}
