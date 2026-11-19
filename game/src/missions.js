// The Sunfall City story: six missions from Mama Rosa, then the kingpin at the plaza.
// Each mission is a small objective graph driven by the game loop in main.js.
export const MISSIONS = [
  {
    id: 'first-steps', giver: 'Mama Rosa', title: 'First Steps',
    brief: 'Mama Rosa: "You look hungry, kid. Run down to the docks and tell Sal the seafood order is ready. Come straight back."',
    steps: [
      { type: 'reach', place: 'docks', label: 'Go to the docks (south pier)' },
      { type: 'reach', place: 'diner', label: "Return to Mama Rosa's diner" },
    ],
    reward: 250,
  },
  {
    id: 'borrowed-wheels', giver: 'Mama Rosa', title: 'Borrowed Wheels',
    brief: 'Mama Rosa: "Sal needs a car at the docks, yesterday. Take the blue sedan by the dealership east of midtown and leave it at the pier. Keys? Whose ever keys."',
    steps: [
      { type: 'stealCarType', carType: 'sedan', near: 'dealership', label: 'Steal a sedan near Marina Motors' },
      { type: 'deliverCar', place: 'docks', label: 'Deliver the sedan to the docks' },
    ],
    reward: 500,
  },
  {
    id: 'heat', giver: 'Mama Rosa', title: 'Heat',
    brief: 'Mama Rosa: "The law knows Sal took that car. Bring me the sports coupe from downtown — fast, loud, and the cops will want it back. Lose any heat before you come home."',
    steps: [
      { type: 'stealCarType', carType: 'sports', near: 'plaza', label: 'Steal a sports coupe downtown' },
      { type: 'loseWanted', label: 'Shake the police (get to 0 stars)' },
      { type: 'reach', place: 'diner', label: "Bring it back to Mama Rosa's" },
    ],
    reward: 800,
  },
  {
    id: 'clean-sweep', giver: 'Mama Rosa', title: 'Clean Sweep',
    brief: 'Mama Rosa: "Cuervo\'s crew is leaning on my suppliers. Go to the gang alley and teach four of them manners. Fists or steel, I don\'t care — but my diner stays out of it."',
    steps: [
      { type: 'defeatThugs', count: 4, near: 'alley', label: 'Defeat Cuervo\'s 4 thugs in the alley' },
      { type: 'reach', place: 'diner', label: "Report back to Mama Rosa's" },
    ],
    reward: 1200,
  },
  {
    id: 'big-score', giver: 'Mama Rosa', title: 'The Big Score',
    brief: 'Mama Rosa: "The armored car at Marina Motors is full of Cuervo\'s skimmed cash. Take it. Leave it at the stash garage northwest — and don\'t you dare skim."',
    steps: [
      { type: 'stealCarType', carType: 'armored', near: 'dealership', label: 'Steal the armored car at Marina Motors' },
      { type: 'deliverCar', place: 'stash', label: 'Hide the armored car at the stash garage' },
    ],
    reward: 2000,
  },
  {
    id: 'kingpin', giver: 'Mama Rosa', title: 'Kingpin',
    brief: 'Mama Rosa: "This is the last time I ask, kid. El Cuervo holds court at the plaza every night. End it. Sunfall City eats free again."',
    steps: [
      { type: 'defeatBoss', near: 'plaza', label: 'Defeat El Cuervo at the plaza' },
      { type: 'reach', place: 'diner', label: 'Claim your reward at the diner' },
    ],
    reward: 5000,
  },
];

export function currentMission(state) {
  return state.missionIndex < MISSIONS.length ? MISSIONS[state.missionIndex] : null;
}
