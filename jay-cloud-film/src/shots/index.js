import lookdev from './lookdev.js';
import ref from './ref.js';
import gref from './gref.js';
import lake from './s1_lake.js';
import sky from './s2_sky.js';
import ripple from './s3_ripple.js';
import alarm from './s4_alarm.js';
import finale from './s5_finale.js';
// film order: 16.32 + 10.2 + 8.18 + 6.09 + 19.34 = 60.13 s
export const SHOTS = [lake, sky, ripple, alarm, finale];
export const EXTRA = [lookdev, ref, gref];
