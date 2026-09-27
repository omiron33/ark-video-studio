from pathlib import Path
import argparse,json,subprocess,hashlib,datetime
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parent
ASSETS=ROOT.parent/'assets/video'
HOST='sjfis@omipc.taild60b4e.ts.net'
def run(args):
 return subprocess.run(args,check=True,capture_output=True,text=True).stdout
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def finish(job,name):
 receipt=json.loads((ROOT/f'{job}-submission.json').read_text());hist=json.loads((ROOT/f'{job}-history.json').read_text()); data=hist[receipt['prompt_id']]
 assert data['status']['completed'] and data['status']['status_str']=='success'
 out=data['outputs']['15']['images'][0];assert out['type']=='output';assert '..' not in out['filename'] and '..' not in out['subfolder']
 raw=ROOT/'raw'/f'{job}.mp4';raw.parent.mkdir(exist_ok=True)
 run(['scp','-o','HostKeyAlias=omipc',HOST+':C:/AI/ComfyUI-Music3/output/'+out['subfolder']+'/'+out['filename'],str(raw)])
 dst=ASSETS/f'{name}-motion.mp4';ASSETS.mkdir(exist_ok=True)
 run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(raw),'-vf','crop=960:540:0:2','-an','-c:v','libx264','-crf','17','-preset','slow','-pix_fmt','yuv420p','-movflags','+faststart',str(dst)])
 run(['ffmpeg','-v','error','-i',str(dst),'-f','null','-'])
 probe=json.loads(run(['ffprobe','-v','error','-count_frames','-show_streams','-show_format','-of','json',str(dst)]))
 (ROOT/f'{job}-probe.json').write_text(json.dumps(probe,indent=2)+'\n')
 stream=probe['streams'][0]; count=int(stream['nb_read_frames']);fps=24;duration=count/fps
 first=ASSETS/f'{name}-first.png';last=ASSETS/f'{name}-last.png'
 run(['ffmpeg','-v','error','-y','-i',str(dst),'-frames:v','1',str(first)])
 run(['ffmpeg','-v','error','-y','-i',str(dst),'-vf',f'select=eq(n\\,{count-1})','-vsync','0','-frames:v','1',str(last)])
 frames=ROOT/'review'/job;frames.mkdir(parents=True,exist_ok=True)
 run(['ffmpeg','-v','error','-y','-i',str(dst),'-vf','fps=6,scale=320:180',str(frames/'frame-%03d.jpg')])
 paths=sorted(frames.glob('frame-*.jpg'));cols=6;rows=(len(paths)+cols-1)//cols
 sheet=Image.new('RGB',(cols*320,rows*205),(12,18,14));draw=ImageDraw.Draw(sheet)
 for i,p in enumerate(paths):
  x=i%cols*320;y=i//cols*205;sheet.paste(Image.open(p),(x,y));draw.text((x+8,y+183),f'{i/6:.3f}s',fill=(241,230,203))
 sheet_path=ROOT/'review'/f'{job}-6fps.jpg';sheet.save(sheet_path,quality=92)
 record={'name':name,'job':job,'provider':'local OmiPC ComfyUI','model':'MiniMax H3 FL2VA int8 convrot','checkpoint':'minimax_h3_fl2va_pruned_int8_convrot.safetensors','turboLora':'minimax_h3_turbo_v4_step600_ema_pruned_comfyui.safetensors','steps':4,'sampler':'MiniMaxH3TurboSampler','sourceRevision':run(['git','rev-parse','HEAD']).strip(),'promptId':receipt['prompt_id'],'conditioning':receipt['conditioning'],'seed':receipt['seed'],'input':receipt['firstImage'],'inputSha256':receipt['firstImageSha256'],'imageProvider':'built-in GPT Image','rawPath':str(raw),'rawSha256':sha(raw),'output':str(dst),'sha256':sha(dst),'native':{'width':960,'height':544,'fps':24,'frames':count},'finished':{'width':int(stream['width']),'height':int(stream['height']),'fps':24,'frames':count,'duration':duration,'audio':False},'processing':'Center crop 2px top/bottom, silent H264 CRF17, no frame interpolation, no speed change, no upscale','decode':'pass','firstPoster':str(first),'lastPoster':str(last),'reviewSheet':str(sheet_path),'reviewStatus':'awaiting_visual_inspection','completedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cost':'local GPU only; no paid API'}
 (ROOT/f'{name}-provenance.json').write_text(json.dumps(record,indent=2)+'\n')
 print(json.dumps(record,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('job');p.add_argument('name');a=p.parse_args();finish(a.job,a.name)
