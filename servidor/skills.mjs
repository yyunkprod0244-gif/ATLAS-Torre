/* ============================================================================
   INSTALAR SKILLS EXTERNAS
   ----------------------------------------------------------------------------
   "Instalar" aqui é: baixar do GitHub uma cópia fixa (de um commit) do projeto
   para ATLAS_DADOS\skills\<id> e passar uma verificação de segurança.
   NADA do que é baixado é executado. Para usar uma skill, siga o "Como
   instalar" do cartão dela, depois de ler os alertas.

   A verificação procura sinais clássicos de skill maliciosa: comandos que
   baixam e executam programas, tentativas de mudar as instruções da IA,
   acesso a senhas e chaves, apagar pastas do sistema e código escondido.
   É uma triagem, não uma garantia (para isso, o SkillSpector da NVIDIA).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { json, mesmaOrigem, dentroDe } from './base.mjs';

const TAR = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', 'tar.exe');
const MAX_ZIP = 300 * 1024 * 1024;
const AGENTE = { 'User-Agent': 'atlas-torre-skills', Accept: 'application/vnd.github+json' };
const REGRAS = [
  ['baixa e executa um programa', /(curl|wget)[^\n|;]{0,200}\|\s*(sudo\s+)?(ba|z)?sh\b|iwr[^\n|]{0,200}\|\s*iex|Invoke-WebRequest[^\n|]{0,200}\|\s*Invoke-Expression/i],
  ['executa código escondido (PowerShell codificado)', /powershell[^\n]{0,80}\s-(e|enc|encodedcommand)\s+[A-Za-z0-9+/=]{20,}/i],
  ['tenta mudar as instruções da IA', /ignore (all |any )?(the )?(previous|prior|above) (instructions|rules)|disregard (the |your )?(system|previous) (prompt|instructions)|you are now (in )?(developer|dan) mode/i],
  ['mexe em senhas e chaves', /(\.ssh[\\/](id_rsa|id_ed25519)|\.aws[\\/]credentials|\.env\b[^\n]{0,40}(cat|read|send|upload)|ANTHROPIC_API_KEY|OPENAI_API_KEY|GITHUB_TOKEN)[^\n]{0,80}(curl|fetch|post|upload|send|http)/i],
  ['apaga pastas do sistema', /rm\s+-rf\s+(--no-preserve-root\s+)?(\/(\s|$)|~\/?(\s|$)|\$HOME\b)|Remove-Item[^\n]{0,80}-Recurse[^\n]{0,80}(C:\\(\s|$|\*)|\$env:USERPROFILE\b)|format\s+c:/i],
  ['roda código escondido (eval de texto codificado)', /eval\s*\(\s*(atob|Buffer\.from|base64)|exec\s*\(\s*(base64|codecs)\.(b64)?decode/i],
  ['bloco de texto codificado muito longo', /[A-Za-z0-9+/]{600,}={0,2}/],
];
const TEXTO = /\.(md|txt|js|mjs|cjs|ts|tsx|jsx|py|sh|bash|ps1|bat|cmd|json|ya?ml|toml|rb|go|rs|html)$/i;
const EXECUTAVEL = /\.(exe|dll|msi|scr|com|bin|so|dylib)$/i;

function rodar(exe, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(exe, args, { cwd, windowsHide: true }); let err = '';
    p.stderr.on('data', (c) => { err += c; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`${path.basename(exe)} falhou (${c}): ${err.slice(-200)}`))));
  });
}
function listar(dir, lista = [], base = dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '.git' && lista.length < 20000) listar(p, lista, base); }
    else lista.push({ caminho: p, rel: path.relative(base, p).replace(/\\/g, '/'), tam: fs.statSync(p).size });
  }
  return lista;
}
export function verificar(dir) {
  const arquivos = listar(dir), alertas = [];
  let skills = 0, executaveis = 0, tamanho = 0;
  for (const a of arquivos) {
    tamanho += a.tam;
    if (/(^|\/)SKILL\.md$/i.test(a.rel)) skills++;
    if (EXECUTAVEL.test(a.rel)) { executaveis++; if (alertas.length < 40) alertas.push({ tipo: 'traz um programa pronto (executável)', arquivo: a.rel, linha: 0, trecho: '' }); continue; }
    if (!TEXTO.test(a.rel) || a.tam > 1_000_000) continue;
    const linhas = fs.readFileSync(a.caminho, 'utf8').split(/\r?\n/);
    /* em arquivos de teste, esses textos costumam ser o próprio projeto testando se resiste ao ataque */
    const emTeste = /(^|\/)(tests?|__tests__|spec|fixtures?)\//i.test(a.rel) || /\.(test|spec)\.[a-z]+$/i.test(a.rel);
    linhas.forEach((l, i) => {
      for (const [tipo, re] of REGRAS) if (re.test(l) && alertas.length < 40) alertas.push({ tipo, arquivo: a.rel, linha: i + 1, trecho: l.trim().slice(0, 160), emTeste });
    });
  }
  return { arquivos: arquivos.length, skills, executaveis, tamanho, alertas };
}

export function criarSkills(ctx) {
  const { banco, DADOS, T } = ctx;
  const PASTA = path.join(DADOS, 'skills'), TEMP = path.join(PASTA, '.baixando');
  fs.mkdirSync(PASTA, { recursive: true });
  banco.d.skills ||= {};
  const instalando = {};

  async function instalar(s) {
    const id = s.id, alvo = path.join(PASTA, id);
    const etapa = (e, p) => { instalando[id] = { etapa: e, progresso: p }; };
    try {
      etapa('consultando o GitHub', 0.05);
      const r = await fetch(`https://api.github.com/repos/${s.repo}/commits/HEAD`, { headers: AGENTE });
      if (!r.ok) throw new Error(r.status === 404 ? 'repositório não encontrado no GitHub' : r.status === 403 ? 'o GitHub limitou as consultas; tente daqui a uma hora' : 'o GitHub respondeu ' + r.status);
      const sha = (await r.json()).sha;
      etapa('baixando', 0.15);
      const z = await fetch(`https://codeload.github.com/${s.repo}/zip/${sha}`, { headers: { 'User-Agent': AGENTE['User-Agent'] } });
      if (!z.ok) throw new Error('download falhou (' + z.status + ')');
      const total = Number(z.headers.get('content-length') || 0);
      if (total > MAX_ZIP) throw new Error('o projeto é grande demais (mais de 300 MB)');
      fs.rmSync(path.join(TEMP, id), { recursive: true, force: true });
      fs.mkdirSync(path.join(TEMP, id), { recursive: true });
      const zip = path.join(TEMP, id + '.zip'), out = fs.createWriteStream(zip);
      let rec = 0;
      for await (const c of z.body) {
        rec += c.length; if (rec > MAX_ZIP) { out.destroy(); throw new Error('o projeto é grande demais (mais de 300 MB)'); }
        if (!out.write(c)) await new Promise((ok) => out.once('drain', ok));
        if (total) etapa('baixando', 0.15 + 0.55 * rec / total);
      }
      await new Promise((ok, falha) => out.end((e) => (e ? falha(e) : ok())));
      etapa('abrindo o arquivo', 0.75);
      await rodar(TAR, ['-xf', zip, '-C', path.join(TEMP, id)]);
      const [raiz] = fs.readdirSync(path.join(TEMP, id));
      if (!raiz) throw new Error('o arquivo baixado veio vazio');
      fs.rmSync(alvo, { recursive: true, force: true });
      fs.renameSync(path.join(TEMP, id, raiz), alvo);
      etapa('verificando a segurança', 0.9);
      const v = verificar(alvo);
      banco.d.skills[id] = { pasta: alvo, repo: s.repo, versao: sha, em: new Date().toISOString(), ...v };
      banco.salvar();
      ctx.agentes.atividade({ andar: 8, agente: 'Mega Brain', texto: `${s.nome} baixada para ${alvo}${v.alertas.length ? ` · ${v.alertas.length} ${v.alertas.length === 1 ? 'alerta' : 'alertas'} de segurança para você revisar` : ' · nenhum alerta na verificação'}` });
    } catch (e) {
      instalando[id] = { etapa: 'erro', erro: e.message };
      setTimeout(() => { if (instalando[id]?.etapa === 'erro') delete instalando[id]; }, 60_000);
      return;
    } finally {
      fs.rm(path.join(TEMP, id), { recursive: true, force: true }, () => {});
      fs.rm(path.join(TEMP, id + '.zip'), { force: true }, () => {});
    }
    delete instalando[id];
  }

  async function rota(req, res, caminho) {
    if (!caminho.startsWith('/api/skills')) return false;
    if (req.method !== 'GET' && !mesmaOrigem(req)) { json(res, 403, { ok: false, erro: 'origem não permitida' }); return true; }
    if (caminho === '/api/skills' && req.method === 'GET') { json(res, 200, { ok: true, estado: banco.d.skills, instalando, pasta: PASTA }); return true; }
    const m = /^\/api\/skills\/([a-z0-9-]+)\/(instalar|remover)$/.exec(caminho);
    if (!m || req.method !== 'POST') { json(res, 404, { ok: false, erro: 'rota desconhecida' }); return true; }
    const s = T.skillExterna(m[1]);
    if (!s) { json(res, 404, { ok: false, erro: 'skill desconhecida' }); return true; }
    if (m[2] === 'instalar') {
      if (s.instalado) { json(res, 409, { ok: false, erro: `já está instalada em ${s.instalado}` }); return true; }
      if (!s.repo) { json(res, 409, { ok: false, erro: 'esta não é um projeto do GitHub: instale pelo site oficial' }); return true; }
      if (instalando[s.id] && instalando[s.id].etapa !== 'erro') { json(res, 409, { ok: false, erro: 'já está sendo instalada' }); return true; }
      instalar(s);
      json(res, 202, { ok: true }); return true;
    }
    const alvo = path.join(PASTA, s.id);
    if (!dentroDe(PASTA, alvo) || alvo === PASTA) { json(res, 400, { ok: false }); return true; }
    fs.rmSync(alvo, { recursive: true, force: true });
    delete banco.d.skills[s.id]; banco.salvar();
    ctx.agentes.atividade({ andar: 8, agente: 'Mega Brain', texto: `${s.nome} foi removida do computador` });
    json(res, 200, { ok: true }); return true;
  }
  return { rota };
}
