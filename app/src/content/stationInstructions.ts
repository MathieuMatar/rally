/**
 * Static challenge instructions shown on the Challenge screen, keyed by station id.
 * Placeholder wording — replace with the exact text from the printed station cards
 * before the event.
 */
export const STATION_INSTRUCTIONS: Record<string, string> = {
  puzzle:
    'Solve the puzzle handed to you by the station leader. Work together — every piece matters!',
  build:
    'Use the materials provided to build the object described on your challenge card before time runs out.',
  general_knowledge:
    "Answer the quiz questions read aloud by the station leader. Discuss as a team before locking in your answer.",
  ai_or_not:
    'Look at the images or text shown by the station leader and decide together which were made by AI and which are real.',
  ask_locals:
    'Find and politely ask locals the question on your challenge card, then report their answers to the station leader.',
  local_scavenger:
    'Find every item on the scavenger list within the area and bring it back to the station leader.',
  physical:
    "Complete the physical challenge as a team — follow the station leader's instructions and safety rules.",
  blind_taste:
    'Taste each sample while blindfolded and guess what it is. Get as many right as you can!',
  cipher: 'Crack the coded message using the cipher key provided by the station leader.',
  storytelling:
    'Create and perform a short story using the prompt words given by the station leader.',
  music: 'Complete the music challenge — identify the songs or perform as instructed by the station leader.',
};

const DEFAULT_INSTRUCTIONS = 'Follow the instructions given by the station leader.';

export function getStationInstructions(stationId: string): string {
  return STATION_INSTRUCTIONS[stationId] ?? DEFAULT_INSTRUCTIONS;
}
