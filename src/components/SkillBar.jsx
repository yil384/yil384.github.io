import { SKILLS } from '../game/constants';

export default function SkillBar({ skills, mp, onCast }) {
  return (
    <div id="skill-bar">
      {Object.entries(SKILLS).map(([name, def]) => {
        const skill = skills[name];
        const onCooldown = skill && (Date.now() - skill.lastCast < def.cd);
        const notEnoughMp = mp < def.mp;
        return (
          <div
            key={name}
            className={`skill-slot${onCooldown ? ' on-cooldown' : ''}${notEnoughMp ? ' insufficient-mp' : ''}`}
            onClick={() => onCast(name)}
          >
            <div className="skill-icon">{def.icon}</div>
            <div className="skill-key pixel-font">{def.key.toUpperCase()}</div>
            <div className="skill-cooldown-overlay" />
            <div className="skill-cost pixel-font">{def.mp} MP</div>
            <div className="skill-tooltip">
              <div className="tooltip-name">{def.name}</div>
              <div className="tooltip-desc">{def.desc}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
