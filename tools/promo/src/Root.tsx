import '@fontsource/ibm-plex-sans-hebrew/hebrew-700.css';
import '@fontsource/ibm-plex-sans-hebrew/latin-700.css';
import React from 'react';
import { Composition } from 'remotion';
import { DURATION, FPS, Promo } from './Promo';

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} />
);
