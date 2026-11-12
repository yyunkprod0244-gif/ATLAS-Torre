/* ============================================================================
   BASE DOS MÓDULOS DO SERVIDOR
   ----------------------------------------------------------------------------
   Pastas de trabalho, banco de dados em arquivo, respostas HTTP e a fila de
   trabalhos que os agentes executam no computador (um de cada vez, para o
   computador continuar leve).

   Tudo o que os agentes criam fica em ATLAS_DADOS (no .env; padrão
   S:\AtlasDados quando o disco S: existe). Eles nunca mexem fora dessa pasta.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

/* ---------- pastas ---------- */
export function pastaDeDados(raizProjeto) {
  if (process.env.ATLAS_DADOS) return path.resolve(process.env.ATLAS_DADOS);
  try { if (fs.existsSync('S:\\')) return 'S:\\AtlasDados'; } catch { /* sem disco S: */ }
  return path.join(raizProjeto, 'dados');
}
/* garante que `alvo` está dentro de `base` (protege contra "..\\..\\Windows") */
export function dentroDe(base, alvo) {
  const b = path.resolve(base) + path.sep, a = path.resolve(alvo);
  return a === path.resolve(base) || a.startsWith(b);
}
export function novoId(prefixo = '') { return prefixo + Date.now().toString(36) + randomBytes(4).toString('hex'); }
export const ID_VALIDO = /^[a-z0-9]{6,40}$/;

/* ---------- banco de dados em arquivo JSON ----------
   Gravação atômica (escreve num .tmp e troca), agrupada em 250 ms. */
export function abrirBanco(arquivo, padrao) {
  let dados = structuredClone(padrao);
  try {
    const lido = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    for (const k of Object.keys(padrao)) if (lido[k] !== undefined) dados[k] = lido[k];
  } catch { /* primeira vez: começa do padrão */ }
  let timer = null;
  const gravar = () => {
    timer = null;
    const tmp = arquivo + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(dados, null, 1));
    fs.renameSync(tmp, arquivo);
  };
  return {
    get d() { return dados; },
    salvar() { if (!timer) timer = setTimeout(() => { try { gravar(); } catch (e) { console.error('[banco]', e.message); } }, 250); },
    salvarJa() { clearTimeout(timer); gravar(); },
  };
}

/* ---------- HTTP ---------- */
export function json(res, status, corpo, extras = {}) {
  if (res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extras });
  res.end(JSON.stringify(corpo));
}
export function lerCorpo(req, limite = 200_000) {
  return new Promise((resolve, reject) => {
    let tam = 0; const partes = [];
    req.on('data', (c) => { tam += c.length; if (tam > limite) { reject(new Error('corpo grande demais')); req.destroy(); } else partes.push(c); });
    req.on('end', () => resolve(Buffer.concat(partes).toString('utf8')));
    req.on('error', reject);
  });
}
export async function lerJSON(req, limite) {
  const t = await lerCorpo(req, limite);
  try { return JSON.parse(t || '{}'); } catch { throw Object.assign(new Error('JSON inválido'), { status: 400 }); }
}
/* Só a própria torre pode mandar ordens: páginas de outros sites abertas no navegador
   não conseguem, porque o navegador sempre envia o cabeçalho Origin nesses pedidos. */
export function mesmaOrigem(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === req.headers.host; } catch { return false; }
}

const TIPOS_MIDIA = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.mkv': 'video/x-matroska', '.m4v': 'video/mp4', '.avi': 'video/x-msvideo', '.jpg': 'image/jpeg', '.png': 'image/png', '.srt': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
/* entrega um arquivo com suporte a "Range" (o player de vídeo pula para qualquer ponto) */
export function servirArquivo(req, res, arquivo) {
  fs.stat(arquivo, (erro, info) => {
    if (erro || !info.isFile()) { res.writeHead(404).end(); return; }
    const tipo = TIPOS_MIDIA[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
    const faixa = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (faixa && (faixa[1] || faixa[2])) {
      let ini = faixa[1] ? +faixa[1] : info.size - +faixa[2], fim = faixa[1] && faixa[2] ? +faixa[2] : info.size - 1;
      if (ini < 0) ini = 0;
      if (ini >= info.size || fim < ini) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end(); return; }
      fim = Math.min(fim, info.size - 1);
      res.writeHead(206, { 'Content-Type': tipo, 'Content-Length': fim - ini + 1, 'Content-Range': `bytes ${ini}-${fim}/${info.size}`, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
      if (req.method === 'HEAD') res.end(); else fs.createReadStream(arquivo, { start: ini, end: fim }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': tipo, 'Content-Length': info.size, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(arquivo).pipe(res);
  });
}

/* ---------- limite de pedidos por endereço (para o atendimento público) ---------- */
export function limitador(maximo, janelaMs) {
  const contas = new Map();
  return (chave) => {
    const agora = Date.now(), lista = (contas.get(chave) || []).filter((t) => agora - t < janelaMs);
    if (lista.length >= maximo) { contas.set(chave, lista); return false; }
    lista.push(agora); contas.set(chave, lista);
    if (contas.size > 5000) for (const [k, v] of contas) if (!v.some((t) => agora - t < janelaMs)) contas.delete(k);
    return true;
  };
}

/* ---------- fila de trabalhos ----------
   Um trabalho por vez. Cada um tem tipo, rótulo, progresso (0 a 1) e pode ser cancelado. */
export function criarFila(aoMudar) {
  const fila = [], estado = { atual: null };
  async function proximo() {
    if (estado.atual || !fila.length) return;
    const t = fila.shift();
    estado.atual = t; t.inicio = Date.now(); t.estado = 'rodando'; aoMudar?.(t);
    try { t.resultado = await t.fazer(t); t.estado = 'feito'; }
    catch (e) { t.estado = t.cancelado ? 'cancelado' : 'erro'; t.erro = String(e?.message || e).slice(0, 400); }
    t.fim = Date.now(); estado.atual = null; aoMudar?.(t);
    setImmediate(proximo);
  }
  return {
    adicionar(t) { t.id = t.id || novoId('t'); t.estado = 'na fila'; t.progresso = 0; fila.push(t); aoMudar?.(t); setImmediate(proximo); return t; },
    cancelar(filtro) {
      for (let i = fila.length - 1; i >= 0; i--) if (filtro(fila[i])) { const [t] = fila.splice(i, 1); t.estado = 'cancelado'; aoMudar?.(t); }
      if (estado.atual && filtro(estado.atual)) { estado.atual.cancelado = true; estado.atual.parar?.(); }
    },
    get atual() { return estado.atual; },
    get pendentes() { return fila.slice(); },
    tem(filtro) { return (estado.atual && filtro(estado.atual)) || fila.some(filtro); },
  };
}
