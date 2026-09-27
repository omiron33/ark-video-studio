import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
const html=await readFile(new URL('composition.html.txt',root),'utf8');
const animation=await readFile(new URL('animation.js',root),'utf8');
await writeFile(new URL('index.html',root),html.replace('<script src="animation.js"></script>',`<script>\n${animation}\n</script>`));
console.log(`Built ${fileURLToPath(new URL('index.html',root))}`);
