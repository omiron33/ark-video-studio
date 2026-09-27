/** Same 20 seconds, paired at native aspect ratio. Exactly one source-audio track. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createCanvas,GlobalFonts} from '@napi-rs/canvas';

const run=promisify(execFile),here=path.dirname(fileURLToPath(import.meta.url));
const clip=JSON.parse(await readFile(path.join(here,'clip.json'),'utf8'));
const out=clip.metadata.outputDir;
await mkdir(out,{recursive:true});
GlobalFonts.registerFromPath(path.join(here,'assets/BebasNeue-Regular.ttf'),'Bebas Neue');
const canvas=createCanvas(1920,1080),ctx=canvas.getContext('2d');
ctx.fillStyle='#08080b';ctx.fillRect(0,0,1920,1080);
ctx.textAlign='center';ctx.fillStyle='#f2eee8';ctx.font='60px "Bebas Neue"';
ctx.fillText('ORIGINAL V3',480,190);ctx.fillText('HYPERFRAMES',1440,190);
ctx.fillStyle='#acaaab';ctx.font='29px "Bebas Neue"';
ctx.fillText('GENESIS 4  /  VENGEANCE TO MERCY',960,890);
ctx.fillText('SAME AUDIO · SAME WORD TIMING · SEPARATE 20-SECOND EXPERIMENT',960,936);
ctx.fillStyle='#832d37';ctx.fillRect(959,246,2,587);
const label=path.join(out,'comparison-labels.png');await writeFile(label,canvas.toBuffer('image/png'));
const comparison=path.join(out,'comparison.mp4');
await run('ffmpeg',['-v','error','-y','-loop','1','-framerate',String(clip.fps),'-i',label,'-i',path.join(out,'baseline.mp4'),'-i',path.join(out,'hyperframes.mp4'),'-i',path.join(here,'assets/song.wav'),'-filter_complex','[1:v]scale=960:540:flags=lanczos,setsar=1[l];[2:v]scale=960:540:flags=lanczos,setsar=1[r];[0:v][l]overlay=0:270:shortest=1[tmp];[tmp][r]overlay=960:270:shortest=1[v]','-map','[v]','-map','3:a:0','-frames:v',String(clip.frames),'-t',String(clip.duration),'-r',String(clip.fps),'-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-c:a','aac','-b:a','256k','-movflags','+faststart',comparison],{maxBuffer:4*1024*1024});
console.log(comparison);
