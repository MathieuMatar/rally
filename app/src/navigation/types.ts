export type AuthStackParamList = {
  Login: undefined;
};

export type GameStackParamList = {
  Clue: undefined;
  Scan: { mode: 'START' | 'END' };
  Challenge: undefined;
  Complete: undefined;
};
