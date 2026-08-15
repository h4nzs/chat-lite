// Shim untuk libsodium
declare module 'libsodium-wrappers';
declare module 'libsodium-wrappers-sumo';

declare global {
  interface Window {
    currentReactionHandler?: (emoji: string) => void;
    webkitAudioContext?: typeof AudioContext;
  }
}

