import { useState, useEffect } from 'react';
import { NPC_DIALOGS } from '../game/constants';

export default function DialogBox({ engine, npcId }) {
  const dialog = NPC_DIALOGS[npcId];
  const [text, setText] = useState('');
  const [showChoices, setShowChoices] = useState(false);
  const [responded, setResponded] = useState(false);

  useEffect(() => {
    if (!dialog) return;
    let i = 0;
    const timer = setInterval(() => {
      if (i < dialog.text.length) {
        setText(dialog.text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(timer);
        setShowChoices(true);
      }
    }, 30);
    return () => clearInterval(timer);
  }, [dialog]);

  if (!dialog) return null;

  function selectChoice(idx) {
    const choice = dialog.choices[idx];
    setShowChoices(false);
    setResponded(true);
    setText('');
    let j = 0;
    const timer = setInterval(() => {
      if (j < choice.response.length) {
        setText(choice.response.slice(0, j + 1));
        j++;
      } else {
        clearInterval(timer);
        engine.giveDialogReward(npcId, choice.reward);
        setTimeout(() => engine.closeDialog(), 1500);
      }
    }, 30);
  }

  return (
    <div id="dialog-box">
      <div className="dialog-speaker">{dialog.speaker}</div>
      <div className="dialog-text">{text}</div>
      {showChoices && !responded && (
        <div className="dialog-choices">
          {dialog.choices.map((c, i) => (
            <button key={i} className="dialog-choice" onClick={() => selectChoice(i)}>
              {c.text}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
