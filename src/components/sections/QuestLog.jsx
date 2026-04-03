import { useState, useEffect, useRef } from 'react';

const quests = [
  { name: 'PICASSO LAB (UCSD CSE)', role: 'Research Intern', dates: 'Mar 2024 \u2013 Feb 2025', details: ['Developed a CXL system simulator for large model communication.', 'Helped set up lab websites and use RAG to parse academic papers.'] },
  { name: 'METABIT', role: 'Quantitative Developer Intern', dates: 'Sep 2024 \u2013 Nov 2024', details: ['Optimized data parsing and added streaming read support for AI Platform.'] },
  { name: 'TENCENT (TIMI STUDIO)', role: 'Game Developer Intern', dates: 'Jun 2024 \u2013 Jul 2024', details: ['Developed Monster Hunter mobile game client with voice-controlled teammates.'] },
  { name: 'DISNEY+ HOTSTAR', role: 'Algorithm Developer Intern', dates: 'Mar 2024 \u2013 Jun 2024', details: ['Optimized search page, fine-tuned recommendation model for TPUs.'] },
  { name: 'BYTEDANCE LARK', role: 'Backend Developer Intern', dates: 'Jun 2023 \u2013 Nov 2023', details: ['Developed AskAI assistant using Redis and RocketMQ for sales data analysis.'] },
];

export default function QuestLog() {
  const ref = useRef(null);
  const [expanded, setExpanded] = useState({});

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
    <section id="quests" className="section anim-target" ref={ref} data-zone="~ QUEST BOARD ~" style={{ position: 'relative' }}>
      <div className="section-title">QUEST LOG</div>
      <div className="quest-list">
        {quests.map((q, i) => (
          <div key={i} className={`quest-card pixel-border${expanded[i] ? ' expanded' : ''}`}>
            <div className="quest-header" onClick={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}>
              <span className="quest-icon">{'\u2694\uFE0F'}</span>
              <div className="quest-meta">
                <div className="quest-name pixel-font">{q.name}</div>
                <div className="quest-role">{q.role} &middot; <span className="text-dim">{q.dates}</span></div>
              </div>
              <span className="quest-badge quest-complete pixel-font">{'\u2713'} COMPLETE</span>
            </div>
            <div className="quest-details">
              <ul>
                {q.details.map((d, j) => <li key={j}>{d}</li>)}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
