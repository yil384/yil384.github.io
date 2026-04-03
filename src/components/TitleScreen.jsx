import { useEffect, useState, useRef } from 'react';

export default function TitleScreen({ onDismiss, onToggleMusic }) {
  const [dismissed, setDismissed] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showCursor, setShowCursor] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const fullText = 'YICHEN LIN';

  useEffect(() => {
    let idx = 0;
    const timer = setInterval(() => {
      if (idx < fullText.length) {
        setTypedName(fullText.slice(0, idx + 1));
        idx++;
      } else {
        clearInterval(timer);
        setTimeout(() => {
          setShowCursor(false);
          setShowSubtitle(true);
        }, 800);
      }
    }, 150);
    const autoTimer = setTimeout(handleDismiss, 5000);
    return () => { clearInterval(timer); clearTimeout(autoTimer); };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Enter') handleDismiss();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  function handleDismiss() {
    if (dismissed) return;
    setDismissed(true);
    setTimeout(onDismiss, 800);
  }

  // Generate stars
  const stars = useRef(
    Array.from({ length: 50 }, (_, i) => ({
      left: Math.random() * 100 + '%',
      top: Math.random() * 100 + '%',
      duration: (2 + Math.random() * 3) + 's',
      delay: Math.random() * 3 + 's',
    }))
  ).current;

  return (
    <div
      id="title-screen"
      className={dismissed ? 'dismissed' : ''}
      onClick={handleDismiss}
    >
      <div id="stars">
        {stars.map((s, i) => (
          <div
            key={i}
            className="star"
            style={{
              left: s.left,
              top: s.top,
              '--duration': s.duration,
              animationDelay: s.delay,
            }}
          />
        ))}
      </div>
      <div className="castle-silhouette" />
      <div className="title-sword left">{'\u2694\uFE0F'}</div>
      <div className="title-sword right">{'\u{1F6E1}\uFE0F'}</div>
      <div className="title-sword" style={{ left: '20%', top: '60%', fontSize: '18px', position: 'absolute', animation: 'floatSword 4s ease-in-out infinite', animationDelay: '1s' }}>{'\u2726'}</div>
      <div className="title-sword" style={{ right: '20%', top: '58%', fontSize: '18px', position: 'absolute', animation: 'floatSword 4s ease-in-out infinite', animationDelay: '3s' }}>{'\u2726'}</div>
      <div className="title-content">
        <h1 className="title-name">
          {typedName}
          {showCursor && <span className="title-cursor">&nbsp;</span>}
        </h1>
        <p className={`title-subtitle ${showSubtitle ? 'visible' : ''}`}>
          PhD Student &middot; UCSD CSE
        </p>
        <p className="title-prompt">&mdash; PRESS ENTER &mdash;</p>
      </div>
      <button
        id="music-toggle"
        className="pixel-font"
        onClick={(e) => {
          e.stopPropagation();
          const playing = onToggleMusic();
          setMusicOn(playing);
        }}
        aria-label="Toggle music"
      >
        {musicOn ? '\u{1F50A}' : '\u{1F507}'}
      </button>
    </div>
  );
}
