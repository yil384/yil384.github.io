import { useEffect, useRef } from 'react';

export default function CharacterCard() {
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
    <section id="character" className="section anim-target" ref={ref} data-zone="~ ADVENTURER'S GUILD ~" style={{ position: 'relative' }}>
      <div className="section-title">CHARACTER</div>
      <div className="char-card pixel-border">
        <div className="char-avatar-wrap">
          <img src="/static/selfpic_yichenlin.jpg" alt="Yichen Lin" className="char-avatar" />
          <div className="char-avatar-border" />
        </div>
        <div className="char-info">
          <div className="char-name pixel-font gold">YICHEN LIN</div>
          <div className="char-class"><span className="purple">Class:</span> Scholar {'\u2726\u2726\u2726'}</div>
          <div className="char-detail"><span className="text-dim">Guild:</span> UC San Diego &middot; CSE Dept</div>
          <div className="char-detail"><span className="text-dim">Mentor:</span> Prof. Yufei Ding</div>
          <div className="char-detail"><span className="text-dim">Phone:</span> (858) 319-7361</div>
          <div className="char-detail">
            <span className="blue">{'\u2709'}</span>{' '}
            <a href="mailto:yil384@ucsd.edu" className="char-link">yil384@ucsd.edu</a>
          </div>
        </div>
      </div>
    </section>
  );
}
