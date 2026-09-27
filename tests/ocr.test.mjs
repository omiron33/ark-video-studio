import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createCanvas} from '@napi-rs/canvas';
import {runProcess} from '../engine/export.mjs';
import {reviewLyricVisibility,visibilityWindows,verifyOCREvidence} from '../engine/ocr.mjs';
import {sha256File} from '../engine/gauntlet.mjs';

test('OCR visibility windows respect authored portal and submerge exits',()=>{
  const p={fps:30,duration:10,words:[{id:'a',text:'GROUND',start:4,end:5},{id:'b',text:'BELOW',start:8,end:8.7}],sections:[{id:'terrain',wordIds:['a'],start:3,end:6,direction:{portalAt:5.12}},{id:'water',wordIds:['b'],start:6,end:10,direction:{submergeAt:8.72}}]};
  const windows=visibilityWindows(p);
  assert.ok(windows[0].end<5.12);assert.ok(windows[1].end<8.72);
  for(const w of windows) assert.ok(w.times.every(t=>t>=w.start&&t<=w.end));
});

test('native OCR verifies rendered upright and rotated lyrics and rejects a missing word', {skip:process.platform!=='darwin',timeout:180000},async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ark-ocr-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const canvas=createCanvas(640,360),c=canvas.getContext('2d');
  c.fillStyle='#081b21';c.fillRect(0,0,640,360);c.fillStyle='#ffffff';c.font='bold 68px Arial';c.textAlign='center';c.fillText('ALPHA',240,185);
  c.save();c.translate(540,190);c.rotate(-Math.PI/2);c.font='bold 64px Arial';c.fillText('ROSE',0,0);c.restore();
  const png=path.join(dir,'source.png'),video=path.join(dir,'actual.mp4'),projectPath=path.join(dir,'project.json');
  await writeFile(png,canvas.toBuffer('image/png'));
  await runProcess('ffmpeg',['-v','error','-loop','1','-i',png,'-t','1','-r','30','-c:v','libx264','-pix_fmt','yuv420p',video]);
  const p={fps:30,width:640,height:360,duration:1,words:[{id:'a',text:'Alpha',start:.1,end:.4},{id:'b',text:'rose.',start:.8,end:1}],sections:[{id:'s',start:0,end:1,style:'impact',wordIds:['a','b'],direction:{}}]};
  await writeFile(projectPath,JSON.stringify(p));
  const pass=await reviewLyricVisibility({projectPath,videoPath:video,outDir:path.join(dir,'pass')});
  assert.equal(pass.status,'passed',JSON.stringify(pass.coverage??pass.error));
  assert.equal(pass.coverage.ratio,1);assert.equal(pass.binding.videoSha256,await sha256File(video));
  assert.ok(pass.evidence.some(frame=>frame.time>.96&&frame.seekTime<=29/30&&frame.sha256),'The final 30fps frame must decode for a lyric ending at clip duration');
  assert.ok(pass.wordCoverage.every(w=>w.observations.some(o=>o.confidence>=.3&&o.box.height>0&&o.sha256)));
  assert.equal(pass.checks.find(c=>c.id==='evidence_integrity')?.passed,true);
  const stored=JSON.parse(await readFile(pass.reportPath,'utf8'));assert.equal(stored.status,'passed');
  p.words.push({id:'missing',text:'GHOST',start:.2,end:.5});p.sections[0].wordIds.push('missing');
  await writeFile(projectPath,JSON.stringify(p));
  const fail=await reviewLyricVisibility({projectPath,videoPath:video,outDir:path.join(dir,'fail'),evidence:[{path:png,time:.3,text:'GHOST'}]});
  assert.equal(fail.status,'failed');assert.deepEqual(fail.coverage.unresolved,['missing']);
  assert.notEqual(fail.binding.projectHash,pass.binding.projectHash);
});

test('nearby subframe OCR samples keep distinct encoded pictures and reject changed evidence', {skip:process.platform!=='darwin',timeout:180000},async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'ark-ocr-collision-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const canvas=createCanvas(640,360),c=canvas.getContext('2d');
  for(let frame=0;frame<30;frame++){
    c.fillStyle='#081b21';c.fillRect(0,0,640,360);c.fillStyle='#fff';c.font='bold 68px Arial';c.textAlign='center';c.fillText('ALPHA',320,190);
    c.fillStyle='#d89867';c.fillRect(20+frame*12,290,30,30);
    await writeFile(path.join(dir,`${String(frame).padStart(2,'0')}.png`),canvas.toBuffer('image/png'));
  }
  const video=path.join(dir,'actual.mp4'),projectPath=path.join(dir,'project.json');
  await runProcess('ffmpeg',['-v','error','-framerate','30','-i',path.join(dir,'%02d.png'),'-c:v','libx264','-pix_fmt','yuv420p',video]);
  const project={fps:30,width:640,height:360,duration:1,words:[{id:'a',text:'ALPHA',start:.28459,end:.324627}],sections:[{id:'s',start:0,end:1,style:'impact',wordIds:['a'],direction:{}}]};
  await writeFile(projectPath,JSON.stringify(project));
  const report=await reviewLyricVisibility({projectPath,videoPath:video,outDir:path.join(dir,'review'),evidence:[{time:.316}]});
  assert.equal(report.status,'passed',JSON.stringify(report.checks));
  const first=report.evidence.find(f=>f.time===.28459),second=report.evidence.find(f=>f.time===.316);
  assert.ok(first&&second&&report.evidence.some(f=>f.time===.3),'Keep both original short-word samples and the independent supplemental time');
  assert.equal(Math.round(first.time*30),Math.round(second.time*30));
  assert.notEqual(first.path,second.path);assert.notEqual(first.sha256,second.sha256,'Moving encoded pixels must differ between these actual seeks');
  assert.equal(new Set(report.evidence.map(f=>f.path)).size,report.evidence.length);
  for(const frame of report.evidence)assert.equal(await sha256File(frame.path),frame.sha256);
  assert.equal((await verifyOCREvidence([first,first])).passed,false,'Duplicate aliases must fail even when bytes match');
  await writeFile(first.path,await readFile(second.path));
  const changed=await verifyOCREvidence(report.evidence);assert.equal(changed.passed,false);assert.ok(changed.errors.some(e=>e.path===first.path&&e.error==='Evidence hash changed'));
  await rm(second.path);const missing=await verifyOCREvidence(report.evidence);assert.equal(missing.passed,false);assert.ok(missing.errors.some(e=>e.path===second.path&&e.error.startsWith('Evidence unavailable:')));
});
