from pathlib import Path
import base64,subprocess
HOST='sjfis@omipc.taild60b4e.ts.net'
def remote(script,timeout=90):
 encoded=base64.b64encode(script.encode('utf-16le')).decode('ascii')
 result=subprocess.run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10',HOST,'powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand '+encoded],capture_output=True,text=True,timeout=timeout)
 if result.returncode:raise RuntimeError(result.stderr.strip() or result.stdout.strip())
 return result.stdout.strip().lstrip('\ufeff')
def copy(source,destination,timeout=300):
 subprocess.run(['scp','-o','BatchMode=yes','-o','ConnectTimeout=10',str(source),HOST+':'+destination],check=True,capture_output=True,text=True,timeout=timeout)
def psquote(text):return "'"+str(text).replace("'","''")+"'"
