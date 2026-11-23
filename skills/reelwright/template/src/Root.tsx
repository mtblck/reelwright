import React from 'react';
import {Composition} from 'remotion';
import {Video} from './Video';
import type {Props} from './types';

const empty: Props = {
  brand: {name: 'Reelwright', paper: '#f6f1e7', ink: '#1b1b1b', primary: '#1b1b1b', accent: '#f0643c', dark: '#1b1b1b', display: {family: 'Inter', weight: 800}, text: {family: 'Inter', weight: 400}},
  scenes: [{type: 'title', start: 0, dur: 90, enter: 'cut', bg: 'paper', cues: [0, 30], props: {}}],
  voice: null, music: null, speech: [], sfx: [], durationInFrames: 90,
};
const meta = ({props}: {props: Props}) => ({durationInFrames: Math.max(1, props.durationInFrames)});

// One video, three shapes. Each scene lays itself out from the frame size.
export const Root: React.FC = () => (
  <>
    <Composition id="square" component={Video} width={1080} height={1080} fps={30} durationInFrames={90} defaultProps={empty} calculateMetadata={meta} />
    <Composition id="vertical" component={Video} width={1080} height={1920} fps={30} durationInFrames={90} defaultProps={empty} calculateMetadata={meta} />
    <Composition id="landscape" component={Video} width={1920} height={1080} fps={30} durationInFrames={90} defaultProps={empty} calculateMetadata={meta} />
  </>
);
