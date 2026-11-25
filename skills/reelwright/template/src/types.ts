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
  mono?: {family: string; weight: number}; // code and terminal text (build.mjs loads it when a story needs it)
  mark?: string; // square mark on paper (public path)
  markDark?: string; // square mark on dark
  logo?: string; // wide logo for light title and end scenes, in place of mark and name (public path)
  logoDark?: string; // wide logo for dark and brand title and end scenes
  radius?: number; // card corner radius at 1080 px
  typeScale?: number; // every font size times this (a look whose face runs wider sets it)
  fallback?: string[]; // faces for scripts the brand's fonts lack (Noto Sans JP, SC, KR, Devanagari), after them in every stack
  fontCss?: string; // public path of the saved Google Fonts CSS (build.mjs)
};

export type Scene = {
  type: 'title' | 'statement' | 'screen' | 'features' | 'stat' | 'steps' | 'end' | 'kinetic' | 'reframe' | 'terminal' | 'code' | 'zoom-pan' | 'before-after' | 'quote' | 'compare' | 'logo-wall' | 'diagram' | 'chart';
  start: number; // frame
  dur: number; // frames
  enter: string; // a key of TRANSITIONS in transitions.tsx: cut, slide, fade, zoom, splice, push
  enterOpts?: Record<string, any>; // from story `enter: {type, ...opts}`, e.g. {direction: 'up'}
  bg: 'paper' | 'dark' | 'brand';
  cues: number[]; // local frame where each phrase of the scene starts
  props: Record<string, any>;
};

// burned-in captions: short lines of a few words, each word with the frames it's spoken over
export type Captions = {formats: string[]; lines: {from: number; to: number; words: {t: string; from: number; to: number; j?: boolean}[]}[]}; // j: no space after (CJK)

export type Sfx = {src: string; at: number; volume?: number};

export type Props = {
  brand: Brand;
  look?: string; // a key of LOOKS in looks.tsx; clean when absent
  check?: boolean; // set by render.mjs check: the frame reports its text (check.tsx)
  quiet?: boolean; // set by render.mjs for the GIF: the look's Wrap and Over are left out
  scenes: Scene[];
  voice: string | null;
  music: {src: string; volume: number; until?: number; stop?: boolean} | null; // until: the frame it ends on; stop: it ends on a tape stop
  speech: [number, number][]; // frames where the voice is speaking, for ducking
  sfx: Sfx[];
  captions?: Captions | null;
  durationInFrames: number;
};
