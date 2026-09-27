import test from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {drawFrame} from '../engine/visual.mjs';
import {cameraAtTime} from '../engine/camera-choreography.mjs';

const words=[{id:'w0',text:'SEVEN',start:1,end:1.9},{id:'w1',text:'TIMES',start:2,end:2.8}];
const film={width:1920,height:1080,fps:30,duration:4,title:'',words,beats:[],sections:[{id:'one',start:0,end:4,style:'story',wordIds:words.map(w=>w.id),assetIds:[],direction:{lyricOnset:'immediate',choreography:'split-verdict'}}]};
function alpha(p,t){const c=createCanvas(480,270);drawFrame(c.getContext('2d'),p,{},t,{layer:'type'});const data=c.getContext('2d').getImageData(0,0,480,270).data;let max=0;for(let i=3;i<data.length;i+=4)max=Math.max(max,data[i]);return max;}
test('immediate lyric mode reaches full opacity on its cue without leaking earlier words',()=>{
 const before=JSON.stringify(film);
 assert.equal(alpha(film,29/30),0);
 assert.equal(alpha(film,1),255);
 assert.equal(alpha(film,31/30),255);
 assert.equal(JSON.stringify(film),before);
 const historic=structuredClone(film);delete historic.sections[0].direction.lyricOnset;
 assert.equal(alpha(historic,1),0,'historical rendering retains its entrance fade');
});
test('opt-in camera settles on the first cue of the next phrase',()=>{
 const groups=words.map(w=>[w]);
 const fresh=cameraAtTime('camera-rail',groups,2,0,4,{settleAtOnset:true});
 assert.equal(fresh.station,1);
 assert.ok(cameraAtTime('camera-rail',groups,2,0,4).station<1,'older projects retain the prior camera timing');
});
