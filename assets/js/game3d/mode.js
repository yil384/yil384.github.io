// Which layer of the world is live. The island is always rendered behind the page ("tour"); the
// game systems (combat, encounters, pickups) only run once the reader takes control ("play").
// Anything that can hurt the player checks `mode.play`. Islander dialogs, dossiers and mini-games are
// modals, so they stay available in the tour: chatting is safe, and its rewards are welcome.

export const mode = {
  play: false,
};
