import { CRAFTING_RECIPES } from '../../game/constants';

export default function CraftingPanel({ engine, materials }) {
  function canCraft(recipe) {
    for (const [mat, count] of Object.entries(recipe.materials)) {
      if ((materials[mat] || 0) < count) return false;
    }
    return true;
  }

  function matName(key) {
    const names = { crystal: 'Crystal', darkEssence: 'Dark Essence', dragonScale: 'Dragon Scale' };
    return names[key] || key;
  }

  return (
    <div className="overlay overlay-dark" id="crafting-panel" onClick={(e) => { if (e.target === e.currentTarget) engine.toggleCrafting(); }}>
      <div className="crafting-inner">
        <div className="crafting-title">CRAFTING</div>
        <div className="crafting-materials">
          {'\u{1F48E}'} Crystal: {materials.crystal || 0} | {'\u{1F5A4}'} Dark Essence: {materials.darkEssence || 0} | {'\u{1F409}'} Dragon Scale: {materials.dragonScale || 0}
        </div>
        {CRAFTING_RECIPES.map((recipe, i) => {
          const available = canCraft(recipe);
          return (
            <div
              key={i}
              className={`craft-recipe${available ? '' : ' disabled'}`}
              onClick={() => available && engine.craft(i)}
            >
              <div>
                <div className="craft-recipe-name">{recipe.icon} {recipe.name}</div>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)' }}>{recipe.desc}</div>
              </div>
              <div className="craft-recipe-cost pixel-font">
                {Object.entries(recipe.materials).map(([mat, count]) => (
                  <div key={mat}>{count}x {matName(mat)}</div>
                ))}
              </div>
            </div>
          );
        })}
        <button className="overlay-close pixel-font" onClick={() => engine.toggleCrafting()}>Close</button>
      </div>
    </div>
  );
}
