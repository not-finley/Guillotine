// --- Helper Function for Moving Cards ---
function moveInLine(lineUp, targetIndex, distance) {
  if (targetIndex < 0 || targetIndex >= lineUp.length) return;
  const [card] = lineUp.splice(targetIndex, 1);
  // Calculate new position ensuring bounds safety
  let newIdx = targetIndex - distance; // "forward" moves index closer to 0
  if (newIdx < 0) newIdx = 0;
  if (newIdx > lineUp.length) newIdx = lineUp.length;
  lineUp.splice(newIdx, 0, card);
}

function resolveActionCard({ room, player, card, target }) {
  const gs = room.gameState;
  if (!gs) return;

  const isComplexTarget = target && typeof target === "object";
  const targetIdx = isComplexTarget ? target.index : target;

  // Handle cards that attach to a player's tableau area permanently
  const tableauCards = ["a3", "a4", "a6", "a16", "a18", "a21", "a32"];
  if (tableauCards.includes(card.key)) {
    player.tableau.push(card);
    return; // Don't add to discard pile yet
  }

  // Always send the played card to the discard pile unless intercepted
  gs.discard.push(card);

  switch (card.key) {
    // --- Player-Targeted Mechanics ---
    case "a1": { // After You... (Put front noble into another player's score pile)
      if (gs.lineUp.length > 0) {
        const victim = room.players.find(p => p.nickname === target);
        if (victim) {
          const noble = gs.lineUp.shift();
          victim.collection.push(noble);
          victim.score += (typeof noble.value === 'number' ? noble.value : 0);
        }
      }
      break;
    }
    case "a7": { // Clerical Error (Swap cards between score piles)
      const victim = room.players.find(p => p.nickname === target.player);
      if (victim && victim.collection.length > 0 && player.collection.length > 0) {
        // Find targeted noble in victim's collection
        const vIdx = victim.collection.findIndex(n => n.instanceId === target.victimCardId);
        // Take a random one from yours
        const pIdx = Math.floor(Math.random() * player.collection.length);
        
        if (vIdx !== -1) {
          const [vNoble] = victim.collection.splice(vIdx, 1);
          const [pNoble] = player.collection.splice(pIdx, 1);
          player.collection.push(vNoble);
          victim.collection.push(pNoble);
        }
      }
      break;
    }
    case "a9": { // Confusion in Line (Target player gets random line shake before chop)
      const victim = room.players.find(p => p.nickname === target);
      if (victim) victim.triggerLineShuffleNextTurn = true;
      break;
    }
    case "a15": { // Forced Break (All other players discard an action card at random)
      room.players.forEach(p => {
        if (p.id !== player.id && p.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * p.hand.length);
          const [discarded] = p.hand.splice(randIdx, 1);
          gs.discard.push(discarded);
        }
      });
      break;
    }
    case "a22": { // Infighting (Target player discards 2 random action cards)
      const victim = room.players.find(p => p.nickname === target);
      if (victim && victim.hand.length > 0) {
        for (let i = 0; i < 2 && victim.hand.length > 0; i++) {
          const randIdx = Math.floor(Math.random() * victim.hand.length);
          const [discarded] = victim.hand.splice(randIdx, 1);
          gs.discard.push(discarded);
        }
      }
      break;
    }
    case "a23": { // Information Exchange (Trade hands with another player)
      const victim = room.players.find(p => p.nickname === target);
      if (victim) {
        const tempHand = [...player.hand];
        player.hand = [...victim.hand];
        victim.hand = tempHand;
      }
      break;
    }
    case "a25": { // Lack of Support (Look at target hand and discard 1 specific card)
      const victim = room.players.find(p => p.nickname === target.player);
      if (victim) {
        const cardIdx = victim.hand.findIndex(c => c.instanceId === target.cardId);
        if (cardIdx !== -1) {
          const [discarded] = victim.hand.splice(cardIdx, 1);
          gs.discard.push(discarded);
        }
      }
      break;
    }
    case "a34": { // Missed! (Target player puts last collected noble at end of line)
      const victim = room.players.find(p => p.nickname === target);
      if (victim && victim.collection.length > 0) {
        const returnedNoble = victim.collection.pop();
        gs.lineUp.push(returnedNoble);
      }
      break;
    }
    case "a35": { // Missing Heads (Target player loses a random noble from score pile)
      const victim = room.players.find(p => p.nickname === target);
      if (victim && victim.collection.length > 0) {
        const randIdx = Math.floor(Math.random() * victim.collection.length);
        const [lostNoble] = victim.collection.splice(randIdx, 1);
        gs.discard.push(lostNoble); // Send noble to global discard
      }
      break;
    }
    case "a42": { // Rush Job (Target player skips action card phase next turn)
      const victim = room.players.find(p => p.nickname === target);
      if (victim) victim.skipNextAction = true;
      break;
    }
    case "a47": { // Tough Crowd (Attach -2 points to another player's field)
      const victim = room.players.find(p => p.nickname === target);
      if (victim) {
        victim.tableau.push(card);
        gs.discard.pop(); // Intercept and pull out from global discard list
      }
      break;
    }
    case "a49": { // Twist of Fate (Discard a tableau helper card)
      const victim = room.players.find(p => p.nickname === target.player);
      if (victim) {
        const tabIdx = victim.tableau.findIndex(t => t.instanceId === target.instanceId);
        if (tabIdx !== -1) {
          const [removedTableau] = victim.tableau.splice(tabIdx, 1);
          gs.discard.push(removedTableau);
        }
      }
      break;
    }

    // --- Line Manipulation Mechanics (Instant & Global) ---
    case "a2": { // Bribed Guards (Move front noble to the end)
      if (gs.lineUp.length > 0) gs.lineUp.push(gs.lineUp.shift());
      break;
    }
    case "a10": { // Double Feature (Collect an additional noble this turn)
      player.extraNoble = true;
      break;
    }
    case "a11": { // Escape! (Discard 2 random nobles, shuffle remaining line)
      for (let i = 0; i < 2 && gs.lineUp.length > 0; i++) {
        const randIdx = Math.floor(Math.random() * gs.lineUp.length);
        gs.lineUp.splice(randIdx, 1);
      }
      gs.lineUp.sort(() => Math.random() - 0.5);
      break;
    }
    case "a12": { // Extra Cart (Add 3 nobles to the end of the line)
      for (let i = 0; i < 3 && gs.nobleDeck.length > 0; i++) {
        gs.lineUp.push(gs.nobleDeck.shift());
      }
      break;
    }
    case "a17": { // Forward March (Move first found Palace Guard to the front)
      const guardIdx = gs.lineUp.findIndex(n => n.key === "r1");
      if (guardIdx !== -1) {
        const [guard] = gs.lineUp.splice(guardIdx, 1);
        gs.lineUp.unshift(guard);
      }
      break;
    }
    case "a24": { // Lack of Faith (Nearest Blue noble moves to the front)
      const blueIdx = gs.lineUp.findIndex(n => n.color === "blue");
      if (blueIdx !== -1) {
        const [blueNoble] = gs.lineUp.splice(blueIdx, 1);
        gs.lineUp.unshift(blueNoble);
      }
      break;
    }
    case "a26": { // Late Arrival (Look at top 3 nobles, add 1 to line end)
      if (gs.nobleDeck.length > 0) {
        const choices = gs.nobleDeck.splice(0, 3);
        // Pull out target configuration index (handled by UI selector index 0-2)
        const chosenIdx = (target >= 0 && target < choices.length) ? target : 0;
        const chosenNoble = choices.splice(chosenIdx, 1)[0];
        gs.lineUp.push(chosenNoble);
        gs.nobleDeck.unshift(...choices); // Return unchosen nobles back to top of deck
      }
      break;
    }
    case "a27": { // Let Them Eat Cake (Move Marie Antoinette to front if present)
      const marieIdx = gs.lineUp.findIndex(n => n.key === "v15");
      if (marieIdx !== -1) {
        const [marie] = gs.lineUp.splice(marieIdx, 1);
        gs.lineUp.unshift(marie);
      }
      break;
    }
    case "a30": { // Mass Confusion (Cycle entire lineup line back to deck and shuffle)
      gs.nobleDeck.push(...gs.lineUp.splice(0));
      gs.nobleDeck.sort(() => Math.random() - 0.5);
      gs.lineUp = gs.nobleDeck.splice(0, gs.lineUp.length || 12);
      break;
    }
    case "a33": { // Milling in Line (Shuffle first 5 nobles)
      const subLine = gs.lineUp.splice(0, 5);
      subLine.sort(() => Math.random() - 0.5);
      gs.lineUp.unshift(...subLine);
      break;
    }
    case "a36": { // Opinionated Guards (Rearrange first 4 cards via targeted array map)
      if (Array.isArray(target)) { // Target is sequence permutation array of indices
        const pool = gs.lineUp.splice(0, 4);
        const arranged = target.map(idx => pool[idx]).filter(Boolean);
        gs.lineUp.unshift(...arranged);
      }
      break;
    }
    case "a37": { // Political Influence (Draw 3 cards, skip noble collection this turn)
      for (let i = 0; i < 3 && gs.actionDeck.length > 0; i++) {
        player.hand.push(gs.actionDeck.shift());
      }
      player.skipNobleThisTurn = true;
      break;
    }
    case "a40": { // Rain Delay (Shuffle hands and deal 5 new ones)
      room.players.forEach(p => {
        gs.actionDeck.push(...p.hand.splice(0));
      });
      gs.actionDeck.sort(() => Math.random() - 0.5);
      room.players.forEach(p => {
        for (let i = 0; i < 5 && gs.actionDeck.length > 0; i++) {
          p.hand.push(gs.actionDeck.shift());
        }
      });
      break;
    }
    case "a41": { // Rat Break (Grab chosen card from discard pile back to hand)
      const discIdx = gs.discard.findIndex(c => c.instanceId === target);
      if (discIdx !== -1) {
        const [salvagedCard] = gs.discard.splice(discIdx, 1);
        player.hand.push(salvagedCard);
      }
      break;
    }
    case "a43": { // Scarlet Pimpernel (Day ends after your turn)
      gs.dayEndedEarly = true; 
      break;
    }
    case "a45": { // The Long Walk (Reverse line order)
      gs.lineUp.reverse();
      break;
    }

    // --- Index-Based Targeting Mechanics ---
    case "a5": { // Civic Pride (Move Green noble forward up to 2 places)
      if (gs.lineUp[targetIdx]?.color === "green") {
        const dist = isComplexTarget ? target.distance : 2;
        moveInLine(gs.lineUp, targetIdx, dist);
      }
      break;
    }
    case "a13": { // Fainting Spell (Move noble backward up to 3 places)
      const dist = isComplexTarget ? target.distance : -3; // negative is backward
      moveInLine(gs.lineUp, targetIdx, dist);
      break;
    }
    case "a19": { // Friend of the Queen (Move noble backward up to 2 places)
      const dist = isComplexTarget ? target.distance : -2;
      moveInLine(gs.lineUp, targetIdx, dist);
      break;
    }
    case "a28": { // L'Idiot (Move noble forward up to 2 places)
      const dist = isComplexTarget ? target.distance : 2;
      moveInLine(gs.lineUp, targetIdx, dist);
      break;
    }
    case "a29": { // Majesty (Move Purple noble forward up to 2 places)
      if (gs.lineUp[targetIdx]?.color === "violet") {
        const dist = isComplexTarget ? target.distance : 2;
        moveInLine(gs.lineUp, targetIdx, dist);
      }
      break;
    }
    case "a31": { // Military Might (Move Red noble forward up to 2 places)
      if (gs.lineUp[targetIdx]?.color === "red") {
        const dist = isComplexTarget ? target.distance : 2;
        moveInLine(gs.lineUp, targetIdx, dist);
      }
      break;
    }
    case "a50": { // Was That My Name? (Move noble forward up to 3 places)
      const dist = isComplexTarget ? target.distance : 3;
      moveInLine(gs.lineUp, targetIdx, dist);
      break;
    }

    // --- Keep all other fixed explicit distance cases exactly the same (a20, a39, a44, a46, a48 etc.) ---
    case "a20": { moveInLine(gs.lineUp, targetIdx, 4); break; }
    case "a39": { moveInLine(gs.lineUp, targetIdx, 2); break; }
    case "a44": { moveInLine(gs.lineUp, targetIdx, 1); break; }
    case "a46": { moveInLine(gs.lineUp, targetIdx, 3); break; }
    case "a48": { moveInLine(gs.lineUp, targetIdx, -1); player.actions += 1; break; }
    default:
      console.log(`Card handling generic or empty for: ${card.key}`);
      break;
  }
}

module.exports = { resolveActionCard };