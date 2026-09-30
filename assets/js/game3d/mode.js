// Which layer of the world is live. The island is always rendered behind the page ("tour"); the
// game systems (combat, encounters, pickups) only run once the reader takes control ("play").
// Anything that can hurt the player or change save data checks `mode.play`.

export const mode = {
  play: false,
};
