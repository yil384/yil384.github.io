export default function PixelCharacter({ x, y, walking, visible }) {
  if (!visible) return null;
  return (
    <div
      id="pixel-char"
      className={walking ? 'walking' : ''}
      style={{ left: x + 'px', top: y + 'px', bottom: 'auto', right: 'auto' }}
      aria-hidden="true"
    />
  );
}
