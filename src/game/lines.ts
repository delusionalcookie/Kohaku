export const LINES = {
  intro: [
    "The offering box is quiet, and so was the afternoon. You may come closer.",
  ],
  return: ["You came back. My ears noticed before I did."],
  first: ["Oh. Between the ears. That is the correct place."],
  early: [
    "A kitsune should not lean into a stranger's hand. I am leaning anyway.",
    "Your palm is warm. Even the paper lanterns noticed.",
    "Gently. I am not a festival drum.",
    "Right there. The fur is thinner, and the feeling is not.",
    "If anyone saw my tails, I would deny everything.",
  ],
  mid: [
    "You are getting good at this. Do not let it make you hasty.",
    "I have kept this shrine a long time. Few stayed to learn the spot.",
    "Both tails are being obvious. I asked them to stop. They refused.",
    "Slow, like sunlight through the maple. Yes. Like that.",
    "I will remember the weight of your hand.",
  ],
  high: [
    "Stay until the light goes gold. That is not a duty. It is a wish.",
    "Fondness is a poor word. It is smaller than this.",
    "You found the place I do not tell pilgrims about.",
    "If you stop, I will pretend I was only guarding the gate.",
    "My ears have given up on dignity. You may continue.",
  ],
  maxed: [
    "The ofuda cannot hold any more warmth. Pat me anyway.",
    "One hundred, and still the correct place.",
    "I am entirely pat. This is a serious shrine matter.",
  ],
  fast: [
    "Ah — slower. Fox ears are not cymbals.",
    "Ticklish. Leave me a little dignity.",
    "That was a drumroll. I asked for a prayer.",
    "Soft hands, not hurried ones.",
  ],
  miss: [
    "That is my sleeve. The ears are higher.",
    "My tails are proud. They are not the assignment.",
    "Lower than my ears, and you have missed the whole point.",
    "The hakama is ceremonial. The head is the welcome.",
  ],
  idle: [
    "Still here? Then I will stop pretending I was not waiting.",
    "The maple is loud today. Or that is just me, being pleased.",
    "You can rest your hand. I will not vanish.",
    "A quiet shrine is nice. A quiet shrine with you is better.",
  ],
  rhythm: [
    "That rhythm. Like a prayer you actually mean.",
    "Yes. Keep that pace. Even my heartbeat is trying to match it.",
    "Steady. A fox can tell when someone is listening.",
  ],
  tiers: {
    curious: "Curious is a start. My ears are already voting yes.",
    fond: "Fond. I said it out loud. The torii will gossip.",
    devoted: "Devoted is a strong word for a gate guardian. It is also accurate.",
    blissful: "Blissful. If I wrote that on an ofuda, it would glow all night.",
    shrineheart: "Shrineheart. The old word, for when a kitsune chooses a person.",
  },
} as const;

export function pickLine(pool: readonly string[], previous: string) {
  if (pool.length === 0) return previous;
  if (pool.length === 1) return pool[0];
  let index = Math.floor(Math.random() * pool.length);
  if (pool[index] === previous) index = (index + 1) % pool.length;
  return pool[index];
}
