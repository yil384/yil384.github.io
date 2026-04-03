import { useEffect, useRef } from 'react';

export default function SkillTree() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          const line = e.target.querySelector('.tree-line');
          if (line) line.classList.add('animated');
          obs.unobserve(e.target);
        }
      });
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section id="skill-tree" className="section anim-target" ref={ref} data-zone="~ HALL OF KNOWLEDGE ~" style={{ position: 'relative' }}>
      <div className="section-title">SKILL TREE</div>
      <div className="tree-path">
        <div className="tree-node pixel-border">
          <div className="tree-node-icon">{'\u{1F3DB}\uFE0F'}</div>
          <div className="tree-node-name pixel-font">Tsinghua University</div>
          <div className="tree-node-detail">B.S. Computer Science and Technology</div>
          <div className="tree-node-date">2021 &ndash; 2025</div>
        </div>
        <div className="tree-line">
          <div className="tree-line-fill" />
          <div className="tree-arrow">{'\u25B6'}</div>
        </div>
        <div className="tree-node pixel-border">
          <div className="tree-node-icon">{'\u{1F52C}'}</div>
          <div className="tree-node-name pixel-font">UC San Diego</div>
          <div className="tree-node-detail">Ph.D. Computer Science and Engineering</div>
          <div className="tree-node-detail">Advisor: Prof. Yufei Ding</div>
          <div className="tree-node-date">2025 &ndash; Now</div>
        </div>
      </div>
    </section>
  );
}
