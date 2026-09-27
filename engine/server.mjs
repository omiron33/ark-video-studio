import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadProject, resolveSource, editSection, inspectProject } from './project.mjs';
import { renderProject } from './export.mjs';

const engineDir = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4' };
async function bodyJson(request) {
  let body = '';
  for await (const chunk of request) { body += chunk; if (body.length > 2e6) throw new Error('Request body too large'); }
  return body ? JSON.parse(body) : {};
}
async function sendFile(request, response, file) {
  const info = await stat(file);
  const headers = { 'Content-Type': types[path.extname(file).toLowerCase()] ?? 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if (range) {
    const start = Number(range[1]), end = range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) { response.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); response.end(); return; }
    response.writeHead(206, { ...headers, 'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${info.size}` });
    createReadStream(file, { start, end }).pipe(response);
  } else { response.writeHead(200, { ...headers, 'Content-Length': info.size }); createReadStream(file).pipe(response); }
}
export async function startServer({ projectPath, port = 4177, host = '127.0.0.1' }) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('Studio binds to loopback only');
  const manifestPath = path.resolve(projectPath);
  await loadProject(manifestPath);
  const jobs = new Map();
  let editTail = Promise.resolve(), activeRender = false;
  const server = http.createServer(async (request, response) => {
    const json = (code, value) => { response.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); response.end(JSON.stringify(value)); };
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);
      const allowedHost = new Set([`127.0.0.1:${server.address().port}`, `localhost:${server.address().port}`, `[::1]:${server.address().port}`]);
      if (!allowedHost.has(request.headers.host)) return json(403, { error: 'Invalid Host header' });
      if (!['GET', 'HEAD'].includes(request.method) && request.headers.origin && !allowedHost.has(new URL(request.headers.origin).host)) return json(403, { error: 'Cross-origin editing is forbidden' });
      if (request.method === 'GET' && url.pathname === '/') return await sendFile(request, response, path.join(engineDir, 'preview.html'));
      if (request.method === 'GET' && url.pathname === '/engine/visual.mjs') return await sendFile(request, response, path.join(engineDir, 'visual.mjs'));
      if (request.method === 'GET' && url.pathname === '/api/project') {
        const { project, validation } = await loadProject(manifestPath);
        const view = structuredClone(project);
        for (const [id, asset] of Object.entries(view.assets)) asset.src = `/asset/${encodeURIComponent(id)}`;
        view.audio.src = '/audio';
        return json(200, { ...view, project: view, validation, inspection: inspectProject(project, validation) });
      }
      if (request.method === 'GET' && (url.pathname.startsWith('/asset/') || url.pathname === '/audio')) {
        const { project } = await loadProject(manifestPath);
        const source = url.pathname === '/audio' ? project.audio.src : project.assets[decodeURIComponent(url.pathname.slice(7))]?.src;
        if (!source) return json(404, { error: 'Unknown asset' });
        return await sendFile(request, response, resolveSource(manifestPath, source));
      }
      const sectionMatch = url.pathname.match(/^\/api\/sections\/([^/]+)$/);
      if (sectionMatch && ['PATCH', 'POST'].includes(request.method)) {
        const body = await bodyJson(request), id = decodeURIComponent(sectionMatch[1]);
        const patch = body.patch ?? body.section ?? Object.fromEntries(Object.entries(body).filter(([key]) => key !== 'retime'));
        const operation = () => editSection(manifestPath, id, patch, { replace: request.method === 'POST', retime: body.retime === true });
        const work = editTail.then(operation); editTail = work.catch(() => {});
        const result = await work;
        return json(200, { section: result.section, revision: result.revision, changed: result.changed });
      }
      if (request.method === 'POST' && url.pathname === '/api/render') {
        if (activeRender) return json(409, { error: 'A render is already running' });
        const options = await bodyJson(request), jobId = randomUUID();
        const safeName = options.sectionId ? String(options.sectionId).replace(/[^A-Za-z0-9_.-]/g, '_') : 'full';
        const outPath = path.join(path.dirname(manifestPath), 'out', `${safeName}-${jobId.slice(0, 8)}.mp4`);
        const job = { id: jobId, status: 'running', progress: null, result: null, error: null };
        jobs.set(jobId, job); activeRender = true;
        renderProject({ projectPath: manifestPath, outPath, sectionId: options.sectionId, scale: options.scale ?? 0.5, force: options.force === true, onProgress: progress => { job.progress = progress; } }).then(result => { job.status = 'complete'; job.result = result; job.downloadUrl = `/api/jobs/${jobId}/video`; }, error => { job.status = 'failed'; job.error = error.message; }).finally(() => { activeRender = false; });
        return json(202, { jobId, id: jobId, status: 'running', poll: `/api/jobs/${jobId}` });
      }
      const videoMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/video$/);
      if (request.method === 'GET' && videoMatch) {
        const job = jobs.get(videoMatch[1]);
        if (!job) return json(404, { error: 'Unknown job' });
        if (job.status !== 'complete' || !job.result?.output) return json(409, { error: 'Video is not ready' });
        return await sendFile(request, response, job.result.output);
      }
      if (request.method === 'GET' && url.pathname.startsWith('/api/jobs/')) {
        const job = jobs.get(url.pathname.slice('/api/jobs/'.length));
        return json(job ? 200 : 404, job ?? { error: 'Unknown job' });
      }
      return json(404, { error: 'Not found' });
    } catch (error) { if (!response.headersSent) json(400, { error: error.message }); else response.destroy(error); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
  return { server, url: `http://${host}:${server.address().port}`, projectPath: manifestPath };
}
