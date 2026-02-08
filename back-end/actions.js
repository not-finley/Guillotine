
function moveInLine(line, index, distance) {
  if (!Array.isArray(line)) return;
  if (index < 0 || index >= line.length) return;
  if (distance === 0) return;

  const newIndex = Math.max(0, Math.min(line.length - 1, index - distance));
  // subtract because forward = toward the front (0)

  const [card] = line.splice(index, 1);
  line.splice(newIndex, 0, card);
}



export function resolveActionCard({ room, player, card, target, chosenDistance }) {
  const gs = room.gameState;

  switch (card.key) {
    case "a1": {
      if (!gs.lineUp.length) break;
      const victim = room.players.find(p => p.nickname === target);
      if (!victim) break;

      const noble = gs.lineUp.shift();
      victim.collection.push(noble);
      gs.discard.push(card);
      break;
    }
    case "a2": {
      if (gs.lineUp.length > 0) {
        gs.lineUp.push(gs.lineUp.shift());
      }
      gs.discard.push(card);
      break;
    }
    case "a5": {
        moveInLine(gs.lineUp, targetIndex, chosenDistance);
        break;
    }
    case "a4": // Church Support
    case "a6": // Civic Support
    case "a16": // Foreign Support
    case "a18": // Fountain of Blood
    case "a21": // Indifferent Public
    case "a32": { // Military Support
      player.tableau.push(card);
      break;
    }
  }
}