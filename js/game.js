/* =========================================================
   PIQUETE SIMULATOR — lógica de jogo
   ========================================================= */

const SAVE_KEY = 'piquete_save_v2';

let S = null; // estado da partida

function novoEstado() {
  return {
    dia: 1,
    mob: 25,
    pre: 0,
    opi: 50,             // opinião pública (50 = neutra)
    cash: 300,
    greve: false,        // greve em curso
    greveJa: false,      // greve já foi deflagrada alguma vez
    diasGreve: 0,
    resistencia: 0,      // quanto a reitoria endureceu na mesa
    pautaStatus: { bandejao: 0, moradia: 0, papfe: 0, cotas: 0 }, // 0 | 0.5 | 1
    flags: {},           // marcas (dossie, migalha, acordoFinal, pacote...)
    passivos: {},        // zine, sintusp, piquete, comando, negociadores...
    feitos: [],          // focos concluídos
    descartados: [],     // focos perdidos por exclusividade
    focoAtivo: null,     // { id, progresso }
    eventosVistos: [],
    cooldownEvento: 2,
    rodadas: 0,          // rodadas de negociação convocadas
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
const pautaDe = id => PAUTA.find(p => p.id === id);

function pontosPauta() {
  return Object.values(S.pautaStatus).reduce((a, b) => a + b, 0);
}

function log(txt, tipo = 'info') {
  S.diario.unshift({ dia: S.dia, txt, tipo });
}

/* ---------- efeitos ---------- */
function aplicarFx(fx) {
  if (!fx) return;
  if (fx.mob) S.mob = clamp(S.mob + fx.mob, 0, 100);
  if (fx.pre) S.pre = clamp(S.pre + fx.pre, 0, 100);
  if (fx.opi) S.opi = clamp(S.opi + fx.opi, 0, 100);
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
  if (fx.conquistaParcial && S.pautaStatus[fx.conquistaParcial] < 0.5) {
    S.pautaStatus[fx.conquistaParcial] = 0.5;
    log(`Acordo rebaixado: ${pautaDe(fx.conquistaParcial).nome} sai pela metade.`, 'marco');
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

/* ---------- MESA DE NEGOCIAÇÃO ---------- */
function mesaInstalada() { return S.feitos.includes('mesa'); }
function mesaAberta() { return mesaInstalada() && S.greve; }

// força do movimento na mesa: pressão + opinião pública + dossiê − resistência
function forcaMesa() {
  return S.pre + (S.opi - 50) / 2 + (S.flags.dossie ? 8 : 0) - S.resistencia;
}

function climaMesa() {
  const f = forcaMesa();
  return CLIMA_MESA.find(c => f >= c.min);
}

// o que a reitoria cederia HOJE para um item: 'integral' | 'rebaixada' | null
function ofertaItem(item) {
  const f = forcaMesa();
  const st = S.pautaStatus[item.id];
  if (st >= 1) return null; // já conquistado integral
  if (f >= item.dif) return 'integral';
  if (st >= 0.5) return null; // rebaixado só melhora com oferta integral
  if (f >= item.dif - 12) return 'rebaixada';
  return null;
}

function custoItem(item, nivel) {
  let c = item.custo * (nivel === 'integral' ? 1 : 0.6);
  // elevar um item rebaixado a integral: paga só a diferença
  if (nivel === 'integral' && S.pautaStatus[item.id] >= 0.5) c = item.custo * 0.5;
  if (S.passivos.negociadores) c *= 0.8;
  return Math.round(c);
}

/* convoca uma rodada: consome dias de negociação e devolve as ofertas.
   retorna { dias: [resultados de virarDia], ofertas, pacote, fim } */
function convocarRodada() {
  if (!mesaAberta() || S.fim) return null;
  S.rodadas++;
  log('Rodada de negociação convocada. Dois dias de mesa, ata aberta.', 'info');
  const diasRes = [];
  for (let i = 0; i < 2; i++) {
    const r = virarDia({ semEvento: true });
    diasRes.push(r);
    if (r.fim) return { dias: diasRes, ofertas: [], pacote: false, fim: r.fim };
  }
  if (!S.greve) return { dias: diasRes, ofertas: [], pacote: false, fim: S.fim };

  const ofertas = MESA_ITENS.map(item => {
    const nivel = ofertaItem(item);
    return nivel ? { id: item.id, nivel, custo: custoItem(item, nivel) } : null;
  }).filter(Boolean);

  // às vezes a reitoria tenta fechar tudo de uma vez, rebaixado, com fim da greve
  const abertos = MESA_ITENS.filter(i => S.pautaStatus[i.id] === 0 && ofertaItem(i));
  const pacote = abertos.length >= 2 && Math.random() < 0.35;

  salvar();
  return { dias: diasRes, ofertas, pacote, fim: null };
}

function assinarItem(id, nivel) {
  const item = MESA_ITENS.find(i => i.id === id);
  const custo = custoItem(item, nivel);
  if (S.pre < custo) return false;
  S.pre = clamp(S.pre - custo, 0, 100);
  S.pautaStatus[id] = nivel === 'integral' ? 1 : 0.5;
  S.resistencia += 10; // a cada concessão, a reitoria endurece
  const p = pautaDe(id);
  log(nivel === 'integral'
    ? `ASSINADO NA ÍNTEGRA: ${p.nome}. ${p.integral}`
    : `Assinado rebaixado: ${p.nome}. ${p.rebaixada}`, 'marco');
  salvar();
  return true;
}

// pacote da reitoria: tudo que está na mesa sai rebaixado, sem custo — mas a greve acaba
function aceitarPacote() {
  const fechados = [];
  for (const item of MESA_ITENS) {
    if (S.pautaStatus[item.id] === 0 && ofertaItem(item)) {
      S.pautaStatus[item.id] = 0.5;
      fechados.push(pautaDe(item.id).nome);
    }
  }
  S.flags.pacote = true;
  S.greve = false;
  S.mob = clamp(S.mob + 5, 0, 100);
  log(`Pacote da reitoria aceito: ${fechados.join(', ')} — tudo rebaixado, greve encerrada.`, 'marco');
  salvar();
  return fechados;
}

function recusarRodada() {
  // levantar da mesa com a delegação inteira: gesto de força
  S.mob = clamp(S.mob + 2, 0, 100);
  log('A delegação levanta da mesa sem assinar nada. "Voltamos quando a proposta for séria."', 'info');
  salvar();
}

// acordo final: encerra a greve consolidando o que foi assinado
function podeAcordoFinal() {
  return mesaAberta() && pontosPauta() >= 1;
}
function assinarAcordoFinal() {
  if (!podeAcordoFinal()) return false;
  const ganho = Math.round(6 + 4 * pontosPauta());
  S.flags.acordoFinal = true;
  S.greve = false;
  S.mob = clamp(S.mob + ganho, 0, 100);
  S.opi = clamp(S.opi + 4, 0, 100);
  log(`ACORDO FINAL ASSINADO. A greve termina em marcha, com ata na mão e festa na escadaria (+${ganho} mobilização).`, 'marco');
  salvar();
  return true;
}

/* ---------- eventos ---------- */
function eventoElegivel(e) {
  if (e.once && S.eventosVistos.includes(e.id)) return false;
  if (e.greve && !S.greve) return false;
  if (e.mesaFeita && !mesaInstalada()) return false;
  if (e.minPre && S.pre < e.minPre) return false;
  if (e.minDia && S.dia < e.minDia) return false;
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
function virarDia(opts = {}) {
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
    if (S.passivos.comando) desgaste -= 0.4;
    desgaste = Math.max(1.0, desgaste);
    S.pre = clamp(S.pre + ganhoPre, 0, 100);
    S.mob = clamp(S.mob - desgaste, 0, 100);
    S.resistencia = Math.max(0, S.resistencia - 0.3); // a reitoria também cansa
  } else if (S.dia > 12 && !S.greveJa) {
    // a base esfria se a greve demora a sair do papel
    S.mob = clamp(S.mob - 0.4, 0, 100);
  }

  // a opinião pública esfria devagar rumo ao neutro (ciclo de notícias)
  if (S.opi > 50) S.opi = Math.max(50, S.opi - 0.2);
  else if (S.opi < 50) S.opi = Math.min(50, S.opi + 0.2);

  // repasse das entidades de base
  if (S.dia === 30 || S.dia === 60) {
    S.cash += 150;
    log('Repasse das entidades de base: +R$ 150 no caixa do DCE.', 'info');
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

  const evento = opts.semEvento ? null : sortearEvento();
  salvar();
  return { evento, focoConcluido, fim: null };
}

function apurarEleicao() {
  const p = pontosPauta();
  const m = S.mob;
  if (!S.greveJa) return 'sem_greve';
  if (p >= 3.5) return 'historica';
  if (p >= 2.5) return 'vitoria';
  if (p >= 1.5) return m >= 40 ? 'vitoria' : 'apertada';
  if (p >= 0.5) return m >= 45 ? 'apertada' : 'derrota_honrosa';
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
