import { useState, useCallback, useRef } from 'react';

export interface HysteresisOptions {
  windowSize?: number;       // W
  tauOn?: number;            // 啟動閾值
  tauOff?: number;           // 釋放閾值
  consensusRatio?: number;   // 共識門檻
}

export function useHysteresis(options: HysteresisOptions = {}) {
  const {
    windowSize = 15,
    tauOn = 80,
    tauOff = 72,
    consensusRatio = 0.75
  } = options;

  if (tauOn <= tauOff) {
    throw new Error("INVALID_HYSTERESIS_BOUNDS");
  }

  const [state, setState] = useState<0 | 1>(0);
  const bufferRef = useRef<number[]>([]);
  const isLockedRef = useRef<boolean>(false);
  const stateRef = useRef<0 | 1>(0);

  const pushScore = useCallback((score: number) => {
    bufferRef.current.push(score);
    if (bufferRef.current.length > windowSize) {
      bufferRef.current.shift();
    }

    const currentBuffer = bufferRef.current;
    const minRequiredFrames = Math.ceil(windowSize * consensusRatio);
    
    // BUFFER_UNDERFLOW_DECISION
    if (currentBuffer.length < minRequiredFrames) {
      return stateRef.current;
    }

    // 計算共識
    const triggerVotes = currentBuffer.filter(s => s >= tauOn).length;
    const releaseVotes = currentBuffer.filter(s => s <= tauOff).length;

    let nextState = stateRef.current;

    if (stateRef.current === 0) {
      if (triggerVotes >= minRequiredFrames) {
        isLockedRef.current = true;
        nextState = 1;
      }
    } else {
      // Lock Permanence Invariant
      if (releaseVotes >= minRequiredFrames) {
         isLockedRef.current = false;
         nextState = 0;
      }
    }

    if (nextState !== stateRef.current) {
      stateRef.current = nextState;
      setState(nextState);
    }

    return nextState;
  }, [windowSize, tauOn, tauOff, consensusRatio]);

  const forceUnlock = useCallback(() => {
    isLockedRef.current = false;
    stateRef.current = 0;
    setState(0);
    bufferRef.current = [];
  }, []);

  const timeoutUnlock = useCallback(() => {
    if (isLockedRef.current) {
       throw new Error("LOCKOUT_TIMEOUT_BREACH");
    }
  }, []);

  return { state, pushScore, forceUnlock, timeoutUnlock };
}
