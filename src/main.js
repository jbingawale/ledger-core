// Entry point. Replays the six day window and prints the report.

import { replay } from './replay.js';
import { renderRun } from './report.js';

console.log(renderRun(replay()));
