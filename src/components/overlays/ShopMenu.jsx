import { SHOP_ITEMS } from '../../game/constants';

export default function ShopMenu({ engine, score }) {
  return (
    <div className="overlay overlay-dark" id="shop-menu" onClick={(e) => { if (e.target === e.currentTarget) engine.closeShop(); }}>
      <div className="shop-inner pixel-border">
        <div className="shop-title pixel-font gold">MARIO'S SHOP</div>
        {SHOP_ITEMS.map(item => (
          <div key={item.id} className="shop-item" onClick={() => engine.buyItem(item.id)}>
            <span>{item.name}</span>
            <span className="pixel-font gold">{item.cost}</span>
            <span className="text-dim" style={{ fontSize: '9px' }}>{item.desc}</span>
          </div>
        ))}
        <button className="shop-close pixel-font" onClick={() => engine.closeShop()}>Close</button>
      </div>
    </div>
  );
}
