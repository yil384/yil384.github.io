const items = [
  { href: '#character', label: 'Character' },
  { href: '#skill-tree', label: 'Skill Tree' },
  { href: '#attributes', label: 'Attributes' },
  { href: '#achievements', label: 'Achievements' },
  { href: '#quests', label: 'Quest Log' },
  { href: '#equipment', label: 'Equipment' },
  { href: '#portals', label: 'Portals' },
];

export default function NavMenu({ onClose }) {
  return (
    <div className="nav-menu-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="nav-menu-inner pixel-border">
        <div className="nav-menu-title pixel-font gold">MENU</div>
        {items.map(item => (
          <a key={item.href} href={item.href} className="nav-item" onClick={onClose}>
            {'\u25B6'} {item.label}
          </a>
        ))}
      </div>
    </div>
  );
}
