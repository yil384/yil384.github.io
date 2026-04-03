export default function Portals() {
  const links = [
    { name: 'GitHub', href: 'https://github.com/yil384' },
    { name: 'LinkedIn', href: 'https://www.linkedin.com/in/yichen-lin-206293384' },
    { name: 'Scholar', href: 'https://scholar.google.com/citations?user=itFHNzoAAAAJ' },
  ];

  return (
    <section id="portals" className="section" data-zone="~ DIMENSIONAL GATEWAY ~" style={{ position: 'relative' }}>
      <div className="section-title">PORTALS</div>
      <div className="portal-row">
        {links.map(l => (
          <a key={l.name} href={l.href} target="_blank" rel="noopener noreferrer" className="portal-link pixel-border">
            <div className="portal-glow" />
            <div className="portal-icon">{'\u{1F300}'}</div>
            <div className="portal-name pixel-font">{l.name}</div>
          </a>
        ))}
      </div>
    </section>
  );
}
