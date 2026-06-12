/* =========================================================
   PIQUETE SIMULATOR — lógica de jogo
   ========================================================= */

const SAVE_KEY = 'piquete_save_v1';

let S = null; // estado da partida

function novoEstado() {
  return {
    dia: 1,
    mob: 25,
    pre: 0,
    cash: 300,
    greve: false,        // greve em curso
    greveJa: false,      // greve já foi deflagrada alguma vez
    diasGreve: 0,
    conquistas: [],      // ids da PAUTA
    flags: {},           // marcas de eventos (ex.: migalha)
    passivos: {},        // zine, sintusp, piquete...
    feitos: [],          // focos concluídos
    descartados: [],     // focos perdidos por exclusividade
    focoAtivo: null,     // { id, progresso }
    eventosVistos: [],
    cooldownEvento: 2,
    diario: [],          // [{dia, txt, tipo}]
    fim: null,           // id do final
  };
}

/* ---------- persistência ---------- */
function salvar() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {}
}
function carregarSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return (s && !s.fim) ? s : null;
  } catch (e) { return null; }
}
function apagarSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
}

/* ---------- util ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const foco = id => FOCOS.find(f => f.id === id);

function log(txt, tipo = 'info') {
  S.diario.unshift({ dia: S.dia, txt, tipo });
}

/* ---------- efeitos ---------- */
function aplicarFx(fx) {
  if (!fx) return;
  if (fx.mob) S.mob = clamp(S.mob + fx.mob, 0, 100);
  if (fx.pre) S.pre = clamp(S.pre + fx.pre, 0, 100);
  if (fx.cash) S.cash += fx.cash;
  if (fx.passive) S.passivos[fx.passive] = true;
  if (fx.flag) S.flags[fx.flag] = true;
  if (fx.greve) {
    S.greve = true; S.greveJa = true;
    log('A GREVE ESTÁ DEFLAGRADA! A universidade para.', 'marco');
  }
  if (fx.fimGreve && S.greve) {
    S.greve = false;
    log('A greve foi encerrada.', 'marco');
  }
  if (fx.conquista && !S.conquistas.includes(fx.conquista)) {
    S.conquistas.push(fx.conquista);
    const item = PAUTA.find(p => p.id === fx.conquista);
    log(`CONQUISTA: ${item.nome}! A reitoria cede no papel e com assinatura.`, 'marco');
  }
}

/* ---------- estado de cada foco ---------- */
// retorna: 'feito' | 'ativo' | 'descartado' | 'disponivel' | 'bloqueado'
function estadoFoco(f) {
  if (S.feitos.includes(f.id)) return 'feito';
  if (S.focoAtivo && S.focoAtivo.id === f.id) return 'ativo';
  if (S.descartados.includes(f.id)) return 'descartado';
  return requisitosOk(f).ok ? 'disponivel' : 'bloqueado';
}

function requisitosOk(f) {
  const faltas = [];
  if (f.req && !f.req.every(id => S.feitos.includes(id)))
    faltas.push('Requer: ' + f.req.map(id => foco(id).nome).join(' + '));
  if (f.reqAny && !f.reqAny.some(id => S.feitos.includes(id)))
    faltas.push('Requer: ' + f.reqAny.map(id => foco(id).nome).join(' ou '));
  if (f.reqMob && S.mob < f.reqMob) faltas.push(`Mobilização ≥ ${f.reqMob}`);
  if (f.reqPre && S.pre < f.reqPre) faltas.push(`Pressão ≥ ${f.reqPre}`);
  if (f.minConq && S.conquistas.length < f.minConq) faltas.push(`Conquistas na mesa ≥ ${f.minConq}`);
  if (f.needsGreve && !S.greve) faltas.push(S.greveJa ? 'A greve já foi encerrada' : 'Exige a greve em curso');
  if (f.custo && S.cash < f.custo) faltas.push(`Caixa ≥ R$ ${f.custo}`);
  return { ok: faltas.length === 0, faltas };
}

function iniciarFoco(id) {
  const f = foco(id);
  if (!f || estadoFoco(f) !== 'disponivel' || S.focoAtivo) return false;
  if (f.custo) S.cash -= f.custo;
  S.focoAtivo = { id, progresso: 0 };
  if (f.excl && !S.descartados.includes(f.excl)) {
    S.descartados.push(f.excl);
    log(`Caminho escolhido: "${f.nome}". A opção "${foco(f.excl).nome}" fica de fora.`, 'info');
  }
  log(`Nova tática em curso: ${f.nome} (${f.dias} dias).`, 'info');
  salvar();
  return true;
}

/* ---------- eventos ---------- */
function eventoElegivel(e) {
  if (e.once && S.eventosVistos.includes(e.id)) return false;
  if (e.greve && !S.greve) return false;
  if (e.minPre && S.pre < e.minPre) return false;
  if (e.maxDia && S.dia > e.maxDia) return false;
  return true;
}

function sortearEvento() {
  if (S.cooldownEvento > 0) { S.cooldownEvento--; return null; }
  if (Math.random() > 0.30) return null;
  const pool = EVENTOS.filter(eventoElegivel);
  if (!pool.length) return null;
  const total = pool.reduce((s, e) => s + (e.peso || 1), 0);
  let r = Math.random() * total;
  for (const e of pool) {
    r -= (e.peso || 1);
    if (r <= 0) {
      S.eventosVistos.push(e.id);
      S.cooldownEvento = 2;
      return e;
    }
  }
  return null;
}

function resolverEvento(ev, idx) {
  const op = ev.op[idx];
  aplicarFx(op.fx);
  log(`${ev.titulo} — ${op.res}`, 'evento');
  salvar();
}

/* ---------- passagem do dia ---------- */
// retorna { evento, focoConcluido, fim }
function virarDia() {
  if (S.fim) return { fim: S.fim };
  S.dia++;

  // progresso da tática ativa
  let focoConcluido = null;
  if (S.focoAtivo) {
    S.focoAtivo.progresso++;
    const f = foco(S.focoAtivo.id);
    if (S.focoAtivo.progresso >= f.dias) {
      S.feitos.push(f.id);
      S.focoAtivo = null;
      aplicarFx(f.fx);
      log(`Tática concluída: ${f.nome}.`, f.marco ? 'marco' : 'feito');
      focoConcluido = f;
    }
  }

  // dinâmica da greve
  if (S.greve) {
    S.diasGreve++;
    let ganhoPre = 1.0 + (S.passivos.piquete ? 0.6 : 0);
    let desgaste = 3.0;
    if (S.passivos.zine) desgaste -= 0.6;
    if (S.passivos.sintusp) desgaste -= 0.5;
    desgaste = Math.max(1.2, desgaste);
    S.pre = clamp(S.pre + ganhoPre, 0, 100);
    S.mob = clamp(S.mob - desgaste, 0, 100);
  } else if (S.dia > 12 && !S.greveJa) {
    // a base esfria se a greve demora a sair do papel
    S.mob = clamp(S.mob - 0.4, 0, 100);
  }

  // derrota antecipada: greve esvaziou
  if (S.greve && S.mob <= 5) {
    S.fim = 'esvaziou';
    salvar();
    return { focoConcluido, fim: S.fim };
  }

  // fim do prazo: eleição do DCE
  if (S.dia > TOTAL_DIAS) {
    S.fim = apurarEleicao();
    salvar();
    return { focoConcluido, fim: S.fim };
  }

  const evento = sortearEvento();
  salvar();
  return { evento, focoConcluido, fim: null };
}

function apurarEleicao() {
  const c = S.conquistas.length;
  const m = S.mob;
  if (!S.greveJa) return 'sem_greve';
  if (c >= 4) return 'historica';
  if (c === 3) return 'vitoria';
  if (c === 2) return m >= 40 ? 'vitoria' : 'apertada';
  if (c === 1) return m >= 45 ? 'apertada' : 'derrota_honrosa';
  return m >= 55 ? 'derrota_honrosa' : 'derrota';
}

/* ---------- partida ---------- */
function novaPartida() {
  S = novoEstado();
  log('Plenária marcada. Noventa dias até a eleição do DCE — e uma universidade inteira pra mobilizar.', 'marco');
  salvar();
}
function continuarPartida() {
  const s = carregarSave();
  if (!s) return false;
  S = s;
  return true;
}
