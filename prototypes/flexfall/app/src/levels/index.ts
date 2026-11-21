// PROTOTYPE - NOT FOR PRODUCTION
// Question: Voelt het fysiek vervormen van een speelvloer, waardoor tientallen knikkers tegelijk reageren, zo bevredigend dat je meteen nog een level wilt?
// Date: 2026-11-21
// The level list, in play order. A level is one JSON file: add the file, add it here.
import type { LevelData } from '../sim/types';
import l1 from './01-first-pull.json';
import l2 from './02-left-or-right.json';
import l3 from './03-the-cup.json';
import l4 from './04-three-nests.json';
import l5 from './05-avalanche.json';

export const LEVELS: LevelData[] = [l1, l2, l3, l4, l5];
