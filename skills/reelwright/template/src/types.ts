export type Brand = {
  name: string;
  tagline?: string;
  url?: string;
  paper: string; // background on light scenes
  ink: string; // text on paper
  primary: string; // brand field, buttons
  accent: string; // one highlight per scene
  dark: string; // background on dark scenes
  support?: string; // panels and rules
  display: {family: string; weight: number};
  text: {family: string; weight: number};
  mark?: string; // square mark on paper (public path)
  markDark?: string; // square mark on dark
  radius?: number; // card corner radius at 1080 px
  fontCss?: string; // public path of the saved Google Fonts CSS (build.mjs)
};

export type Scene = {
  type: 'title' | 'statement' | 'screen' | 'features' | 'stat' | 'steps' | 'end';
  start: number; // frame
  dur: number; // frames
  enter: 'cut' | 'slide' | 'fade' | 'zoom';
  bg: 'paper' | 'dark' | 'brand';
  cues: number[]; // local frame where each phrase of the scene starts
  props: Record<string, any>;
};

export type Sfx = {src: string; at: number; volume?: number};

export type Props = {
  brand: Brand;
  scenes: Scene[];
  voice: string | null;
  music: {src: string; volume: number} | null;
  speech: [number, number][]; // frames where the voice is speaking, for ducking
  sfx: Sfx[];
  durationInFrames: number;
};
