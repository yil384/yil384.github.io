export default function EquipmentPanel({ engine, equipment }) {
  const slots = ['weapon', 'staff', 'armor', 'ring'];
  const stats = engine.getEquipStats();

  return (
    <div className="overlay overlay-dark" id="equip-panel" onClick={(e) => { if (e.target === e.currentTarget) engine.toggleEquipPanel(); }}>
      <div className="equip-panel-inner pixel-border">
        <div className="equip-panel-title pixel-font gold">EQUIPMENT</div>
        <div className="equip-slots">
          {slots.map(slot => {
            const item = equipment[slot];
            return (
              <div key={slot} className="equip-slot">
                <span className="slot-label pixel-font">{slot.charAt(0).toUpperCase() + slot.slice(1)}</span>
                <span className={`slot-item pixel-font${item ? ' rarity-' + item.rarity : ''}`}>
                  {item ? `${item.icon} ${item.name}` : 'Empty'}
                </span>
              </div>
            );
          })}
        </div>
        <div className="pixel-font" style={{ fontSize: '7px', color: 'var(--text-dim)', marginTop: '12px', lineHeight: 2 }}>
          ATK +{stats.atk} | Spell +{stats.spellDmg} | DEF +{stats.def} | MP Regen +{stats.mpRegen}
        </div>
        <button className="overlay-close pixel-font" onClick={() => engine.toggleEquipPanel()}>Close</button>
      </div>
    </div>
  );
}
