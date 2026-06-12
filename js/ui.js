/* =========================================================
   PIQUETE SIMULATOR — interface
   ========================================================= */

const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);

const COLW = 192;   // largura de coluna do mural
const ROWH = 172;   // altura de linha do mural
const PAD  = 24;    // respiro nas bordas do mural

const TELAS = { title: $('#screen-title'), game: $('#screen-game'), end: $('#screen-end') };

function mostrarTela(nome) {
  Object.entries(TELAS).forEach(([k, el]) => { el.hidden = (k !== nome); });
}

/* ================= HUD ================= */
function renderHud() {
  $('#hud-day').textContent = Math.min(S.dia, TOTAL_DIAS);
  $('#hud-mob').textContent = Math.round(S.mob);
  $('#hud-pre').textContent = Math.round(S.pre);
  $('#hud-opi').textContent = Math.round(S.opi);
  $('#hud-cash').textContent = 'R$ ' + S.cash;
  $('#bar-mob').style.width = clamp(S.mob, 0, 100) + '%';
  $('#bar-pre').style.width = clamp(S.pre, 0, 100) + '%';
  $('#bar-opi').style.width = clamp(S.opi, 0, 100) + '%';
  $('#hud-greve').hidden = !S.greve;
  $('#badge-pauta').textContent = pontosPauta() + '/4';
  $('#tab-btn-mesa').classList.toggle('tab-live', mesaAberta());
  document.body.classList.toggle('em-greve', S.greve);

  // barra de ação
  const st = $('#focus-status');
  if (S.focoAtivo) {
    const f = foco(S.focoAtivo.id);
    const pct = Math.round((S.focoAtivo.progresso / f.dias) * 100);
    st.innerHTML =
      `<span class="focus-name">${f.nome}</span>` +
      `<span class="focus-days">${S.focoAtivo.progresso}/${f.dias} dias</span>` +
      `<div class="meter meter-thin"><div class="meter-fill fill-foco" style="width:${pct}%"></div></div>`;
  } else {
    st.innerHTML = '<span class="focus-none">Nenhuma tática em curso — escolha uma no mural</span>';
  }
}

/* ================= MURAL (árvore) ================= */
function renderArvore() {
  const canvas = $('#tree-canvas');
  canvas.querySelectorAll('.focus-node').forEach(n => n.remove());

  const maxX = Math.max(...FOCOS.map(f => f.x));
  const maxY = Math.max(...FOCOS.map(f => f.y));
  canvas.style.width  = (PAD * 2 + (maxX + 1) * COLW) + 'px';
  canvas.style.height = (PAD * 2 + (maxY + 1) * ROWH) + 'px';

  for (const f of FOCOS) {
    const est = estadoFoco(f);
    const el = document.createElement('button');
    el.className = `focus-node st-${est}` + (f.marco ? ' marco' : '');
    el.dataset.id = f.id;
    el.style.left = (PAD + f.x * COLW) + 'px';
    el.style.top  = (PAD + f.y * ROWH) + 'px';

    let extra = '';
    if (est === 'ativo') {
      const pct = Math.round((S.focoAtivo.progresso / f.dias) * 100);
      extra = `<div class="meter meter-thin"><div class="meter-fill fill-foco" style="width:${pct}%"></div></div>`;
    }
    el.innerHTML =
      `<span class="fn-name">${f.nome}</span>` +
      `<span class="fn-meta">${f.dias}d${f.custo ? ' · R$' + f.custo : ''}</span>` +
      extra +
      (est === 'feito' ? '<span class="fn-stamp">FEITO</span>' : '') +
      (est === 'descartado' ? '<span class="fn-stamp fn-stamp-x">RISCADO</span>' : '');
    el.addEventListener('click', () => abrirDetalheFoco(f.id));
    canvas.appendChild(el);
  }

  requestAnimationFrame(desenharLinhas);
}

function desenharLinhas() {
  const canvas = $('#tree-canvas');
  const svg = $('#tree-lines');
  svg.setAttribute('width', canvas.style.width);
  svg.setAttribute('height', canvas.style.height);
  svg.innerHTML = '';

  const pos = {};
  canvas.querySelectorAll('.focus-node').forEach(n => {
    pos[n.dataset.id] = {
      x: n.offsetLeft + n.offsetWidth / 2,
      top: n.offsetTop,
      bot: n.offsetTop + n.offsetHeight,
    };
  });

  for (const f of FOCOS) {
    const pais = [...(f.req || []), ...(f.reqAny || [])];
    for (const pid of pais) {
      const a = pos[pid], b = pos[f.id];
      if (!a || !b) continue;
      const midY = a.bot + (b.top - a.bot) / 2;
      const d = `M ${a.x} ${a.bot} V ${midY} H ${b.x} V ${b.top}`;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      const ligado = S.feitos.includes(pid) &&
        (S.feitos.includes(f.id) || (S.focoAtivo && S.focoAtivo.id === f.id));
      path.setAttribute('class', 'tree-line' + (ligado ? ' on' : ''));
      svg.appendChild(path);
    }
  }
}

/* ================= MESA DE NEGOCIAÇÃO ================= */
function rotuloNivel(id) {
  const st = S.pautaStatus[id];
  if (st >= 1) return '<span class="nivel nivel-int">INTEGRAL</span>';
  if (st >= 0.5) return '<span class="nivel nivel-reb">REBAIXADO</span>';
  return '<span class="nivel nivel-aberto">EM ABERTO</span>';
}

function renderMesa() {
  const el = $('#mesa-conteudo');
  if (!mesaInstalada()) {
    el.innerHTML = `<div class="paper-sheet mesa-fechada">
      <h2 class="sheet-title">Mesa de Negociação</h2>
      <p class="sheet-sub">sala 12 do prédio da reitoria — atualmente vazia</p>
      <p class="mesa-aviso">A reitoria só senta à mesa com uma greve de pé e a tática
      <strong>"Instalar a mesa de negociação"</strong> concluída no mural.
      ${S.greveJa && !S.greve ? 'Com a greve encerrada, essa porta se fechou.' : 'Construa a greve primeiro.'}</p>
    </div>`;
    return;
  }

  const clima = climaMesa();
  const forca = Math.round(clamp(forcaMesa(), 0, 100));
  const aberta = mesaAberta();

  const itens = MESA_ITENS.map(item => {
    const p = pautaDe(item.id);
    const st = S.pautaStatus[item.id];
    const oferta = aberta ? ofertaItem(item) : null;
    let tendencia;
    if (st >= 1) {
      tendencia = `<span class="tend ok">✊ ${p.integral}</span>`;
    } else if (!aberta) {
      tendencia = st >= 0.5
        ? `<span class="tend">Ficou pela metade: ${p.rebaixada}</span>`
        : '<span class="tend">Ficou em aberto — a mesa fechou.</span>';
    } else if (oferta === 'integral') {
      tendencia = `<span class="tend boa">Na próxima rodada, a reitoria cederia <strong>na íntegra</strong> (−${custoItem(item, 'integral')} pressão).</span>`;
    } else if (oferta === 'rebaixada') {
      tendencia = `<span class="tend media">Na próxima rodada, cederia uma versão <strong>rebaixada</strong> (−${custoItem(item, 'rebaixada')} pressão).</span>`;
    } else if (st >= 0.5) {
      tendencia = `<span class="tend">Assinado rebaixado. Pra elevar à íntegra, falta força na mesa (precisa ~${item.dif}).</span>`;
    } else {
      tendencia = `<span class="tend ruim">Fora de cogitação por enquanto (força necessária: ~${item.dif - 12}).</span>`;
    }
    return `<li class="mesa-item">
      <div class="mesa-item-head"><strong>${p.nome}</strong>${rotuloNivel(item.id)}</div>
      ${tendencia}
    </li>`;
  }).join('');

  el.innerHTML = `<div class="paper-sheet">
    <h2 class="sheet-title">Mesa de Negociação</h2>
    <p class="sheet-sub">ata nº ${S.rodadas + 1} — comando de greve × gabinete da reitoria</p>

    <div class="mesa-clima">
      <div class="mesa-clima-rotulo">
        <span class="res-label">Reitoria:</span>
        <span class="clima-tag">${clima.rotulo}</span>
      </div>
      <div class="meter meter-clima"><div class="meter-fill fill-clima" style="width:${forca}%"></div></div>
      <p class="clima-desc">${clima.desc}</p>
      <p class="clima-formula">força na mesa = pressão ${S.flags.dossie ? '+ dossiê ' : ''}+ opinião pública − resistência da reitoria (${Math.round(S.resistencia)})</p>
    </div>

    <ul class="mesa-lista">${itens}</ul>

    ${aberta ? `
      <div class="mesa-acoes">
        <button class="btn btn-primary" id="btn-rodada">Convocar rodada (2 dias)</button>
        <button class="btn btn-ghost" id="btn-acordo" ${podeAcordoFinal() ? '' : 'disabled'}
          title="${podeAcordoFinal() ? 'Encerra a greve consolidando o que já foi assinado' : 'Assine ao menos uma conquista antes'}">
          Assinar acordo final
        </button>
      </div>
      <p class="mesa-nota">Cada conquista assinada faz a reitoria endurecer (+resistência).
      O acordo final encerra a greve por cima — mas fecha a mesa pra sempre.</p>
    ` : '<p class="mesa-aviso">A mesa está encerrada. O que foi assinado, está assinado.</p>'}
  </div>`;

  const br = $('#btn-rodada');
  if (br) br.addEventListener('click', executarRodada);
  const ba = $('#btn-acordo');
  if (ba) ba.addEventListener('click', confirmarAcordoFinal);
}

function executarRodada() {
  if (!backdrop.hidden) return;
  const r = convocarRodada();
  if (!r) return;
  renderTudo();
  if (r.fim) { mostrarFim(r.fim); return; }

  if (!r.ofertas.length) {
    abrirModal(`
      <div class="modal-tape" aria-hidden="true"></div>
      <span class="modal-kicker">RODADA Nº ${S.rodadas}</span>
      <h3 class="modal-title">A reitoria não cede nada</h3>
      <p class="modal-text">Duas horas de leitura de pareceres e um "infelizmente não há disponibilidade orçamentária". Tradução: a pressão ainda não chegou lá. Volte com mais força — pressão alta, opinião pública a favor e resistência baixa.</p>
      <button class="btn btn-primary" id="m-ok">Voltar pra luta</button>
    `);
    $('#m-ok').addEventListener('click', () => { fecharModal(); checarFimOuRender(); });
    return;
  }

  const ofertasHtml = r.ofertas.map(o => {
    const p = pautaDe(o.id);
    const semPre = S.pre < o.custo;
    const elevando = o.nivel === 'integral' && S.pautaStatus[o.id] >= 0.5;
    return `<button class="btn btn-op" data-id="${o.id}" data-nivel="${o.nivel}" ${semPre ? 'disabled' : ''}>
      <span>${elevando ? 'Elevar à íntegra' : 'Assinar'}: ${p.nome} ${o.nivel === 'integral' ? '(INTEGRAL)' : '(rebaixado)'}</span>
      <small>${o.nivel === 'integral' ? p.integral : p.rebaixada}</small>
      <small>custa ${o.custo} de pressão${semPre ? ' — pressão insuficiente' : ''} · a reitoria endurece depois</small>
    </button>`;
  }).join('');

  const pacoteHtml = r.pacote ? `
    <button class="btn btn-op btn-pacote" id="m-pacote">
      <span>⚠ Aceitar o pacote da reitoria</span>
      <small>Tudo que está na mesa sai assinado REBAIXADO, sem custo de pressão — mas a greve termina hoje.</small>
    </button>` : '';

  abrirModal(`
    <div class="modal-tape" aria-hidden="true"></div>
    <span class="modal-kicker">RODADA Nº ${S.rodadas} — A REITORIA APRESENTA</span>
    <h3 class="modal-title">O que está sobre a mesa</h3>
    <p class="modal-text">O chefe de gabinete desliza uma pasta pela mesa. Você pode assinar <strong>um</strong> item por rodada — ou levantar e voltar com mais força.</p>
    <div class="evento-ops">
      ${ofertasHtml}
      ${pacoteHtml}
      <button class="btn btn-op" id="m-levantar">
        <span>Levantar da mesa sem assinar</span>
        <small>+2 mobilização — a firmeza anima a base, e a oferta não foge</small>
      </button>
    </div>
  `, true);

  modalCard.querySelectorAll('.btn-op[data-id]').forEach(b => {
    b.addEventListener('click', () => {
      assinarItem(b.dataset.id, b.dataset.nivel);
      modalTravado = false; fecharModal();
      const p = pautaDe(b.dataset.id);
      abrirModal(`
        <div class="modal-tape" aria-hidden="true"></div>
        <span class="modal-kicker">ASSINADO EM ATA</span>
        <h3 class="modal-title">${p.nome}</h3>
        <p class="modal-text">${b.dataset.nivel === 'integral' ? p.integral : p.rebaixada}</p>
        <p class="modal-fx">${b.dataset.nivel === 'integral' ? 'conquista integral (1 ponto)' : 'conquista rebaixada (meio ponto)'} · a reitoria endurece (+10 resistência)</p>
        <button class="btn btn-primary" id="m-ok">A luta continua</button>
      `);
      $('#m-ok').addEventListener('click', () => { fecharModal(); checarFimOuRender(); });
    });
  });
  const bp = $('#m-pacote');
  if (bp) bp.addEventListener('click', () => {
    modalTravado = false; fecharModal();
    const fechados = aceitarPacote();
    abrirModal(`
      <div class="modal-tape" aria-hidden="true"></div>
      <span class="modal-kicker">PACOTE FECHADO</span>
      <h3 class="modal-title">A greve termina com acordo rebaixado</h3>
      <p class="modal-text">Assinados pela metade: ${fechados.join(', ')}. A base recebe a notícia dividida — era isso ou mais semanas de desgaste. A história julgará.</p>
      <button class="btn btn-primary" id="m-ok">Encerrar a greve</button>
    `);
    $('#m-ok').addEventListener('click', () => { fecharModal(); checarFimOuRender(); });
  });
  $('#m-levantar').addEventListener('click', () => {
    recusarRodada();
    modalTravado = false; fecharModal();
    checarFimOuRender();
  });
}

function confirmarAcordoFinal() {
  if (!podeAcordoFinal() || !backdrop.hidden) return;
  const p = pontosPauta();
  abrirModal(`
    <div class="modal-tape" aria-hidden="true"></div>
    <span class="modal-kicker">DECISÃO DE ASSEMBLEIA</span>
    <h3 class="modal-title">Assinar o acordo final?</h3>
    <p class="modal-text">Encerra a greve por cima, consolidando <strong>${p} ponto${p === 1 ? '' : 's'}</strong> de pauta assinada. O desgaste para e a base sai em marcha — mas a mesa fecha: o que não foi conquistado fica pra próxima gestão.</p>
    <div class="evento-ops">
      <button class="btn btn-op" id="m-sim"><span>Assinar e sair em marcha</span><small>+${Math.round(6 + 4 * p)} mobilização, fim da greve</small></button>
      <button class="btn btn-op" id="m-nao"><span>Ainda não — dá pra arrancar mais</span><small>a greve continua</small></button>
    </div>
  `, true);
  $('#m-sim').addEventListener('click', () => {
    modalTravado = false; fecharModal();
    assinarAcordoFinal();
    checarFimOuRender();
  });
  $('#m-nao').addEventListener('click', () => { modalTravado = false; fecharModal(); });
}

/* ================= PAUTA / DIÁRIO ================= */
function renderPauta() {
  $('#pauta-list').innerHTML = PAUTA.map(p => {
    const st = S.pautaStatus[p.id];
    const ok = st > 0;
    return `<li class="pauta-item ${ok ? 'ok' : ''}">
      <div class="pauta-check">${st >= 1 ? '✊' : st >= 0.5 ? '½' : '·'}</div>
      <div><strong>${p.nome}</strong><p>${ok ? (st >= 1 ? p.integral : p.rebaixada) : p.desc}</p>
      <span class="pauta-status">${st >= 1 ? 'CONQUISTADO NA ÍNTEGRA — assinado em ata' : st >= 0.5 ? 'conquistado rebaixado — dá pra elevar na mesa' : 'em aberto'}</span></div>
    </li>`;
  }).join('');
}

function renderDiario() {
  $('#diario-list').innerHTML = S.diario.slice(0, 80).map(d =>
    `<li class="diario-item tipo-${d.tipo}">
      <span class="diario-dia">DIA ${d.dia}</span>
      <span class="diario-txt">${d.txt}</span>
    </li>`
  ).join('') || '<li class="diario-item"><span class="diario-txt">Nada registrado ainda.</span></li>';
}

function renderTudo() {
  renderHud(); renderArvore(); renderMesa(); renderPauta(); renderDiario();
}

/* ================= MODAIS ================= */
const backdrop = $('#modal-backdrop');
const modalCard = $('#modal-card');
let modalTravado = false; // eventos exigem escolha

function abrirModal(html, travado = false) {
  modalTravado = travado;
  modalCard.innerHTML = html;
  backdrop.hidden = false;
}
function fecharModal() {
  if (modalTravado) return;
  backdrop.hidden = true;
}
backdrop.addEventListener('click', e => { if (e.target === backdrop) fecharModal(); });

function fmtFx(fx) {
  if (!fx) return '';
  const parts = [];
  if (fx.mob) parts.push(`${fx.mob > 0 ? '+' : ''}${fx.mob} mobilização`);
  if (fx.pre && fx.pre > -100) parts.push(`${fx.pre > 0 ? '+' : ''}${fx.pre} pressão`);
  if (fx.pre && fx.pre <= -100) parts.push('a pressão acumulada se perde');
  if (fx.opi) parts.push(`${fx.opi > 0 ? '+' : ''}${fx.opi} opinião pública`);
  if (fx.cash) parts.push(`${fx.cash > 0 ? '+' : ''}R$ ${Math.abs(fx.cash)}${fx.cash > 0 ? '' : ' do caixa'}`);
  if (fx.greve) parts.push('DEFLAGRA A GREVE');
  if (fx.fimGreve) parts.push('encerra a greve');
  if (fx.conquistaParcial) parts.push('conquista rebaixada: ' + pautaDe(fx.conquistaParcial).nome);
  return parts.join(' · ');
}

function abrirDetalheFoco(id) {
  const f = foco(id);
  const est = estadoFoco(f);
  const reqs = requisitosOk(f);
  let acao = '';
  if (est === 'disponivel') {
    acao = S.focoAtivo
      ? '<p class="modal-note">Termine a tática em curso antes de iniciar outra.</p>'
      : `<button class="btn btn-primary" id="m-start">Iniciar (${f.dias} dias${f.custo ? ' · R$' + f.custo : ''})</button>`;
  } else if (est === 'feito') {
    acao = '<p class="modal-note ok">Tática concluída. ✊</p>';
  } else if (est === 'ativo') {
    acao = `<p class="modal-note">Em curso: ${S.focoAtivo.progresso}/${f.dias} dias.</p>`;
  } else if (est === 'descartado') {
    acao = '<p class="modal-note">Caminho descartado — vocês escolheram outra via.</p>';
  } else {
    acao = '<div class="modal-reqs"><strong>Ainda falta:</strong><ul>' +
      reqs.faltas.map(r => `<li>${r}</li>`).join('') + '</ul></div>';
  }
  abrirModal(`
    <div class="modal-tape" aria-hidden="true"></div>
    <h3 class="modal-title">${f.nome}</h3>
    <p class="modal-text">${f.desc}</p>
    <p class="modal-fx">${fmtFx(f.fx)}</p>
    ${f.passivo ? `<p class="modal-passive">※ ${f.passivo}</p>` : ''}
    ${f.excl ? `<p class="modal-passive">⚠ Exclui: "${foco(f.excl).nome}"</p>` : ''}
    ${acao}
    <button class="btn btn-ghost" id="m-close">Fechar</button>
  `);
  const bs = $('#m-start');
  if (bs) bs.addEventListener('click', () => {
    if (iniciarFoco(id)) { modalTravado = false; fecharModal(); renderTudo(); }
  });
  $('#m-close').addEventListener('click', () => { modalTravado = false; fecharModal(); });
}

function abrirEvento(ev) {
  abrirModal(`
    <div class="modal-tape" aria-hidden="true"></div>
    <span class="modal-kicker">ACONTECEU NO CAMPUS</span>
    <h3 class="modal-title">${ev.titulo}</h3>
    <p class="modal-text">${ev.texto}</p>
    <div class="evento-ops">${ev.op.map((op, i) => {
      const semGrana = op.custo && S.cash < op.custo;
      return `<button class="btn btn-op" data-i="${i}" ${semGrana ? 'disabled' : ''}>
        <span>${op.txt}</span>
        <small>${fmtFx(op.fx)}${semGrana ? ' — caixa insuficiente' : ''}</small>
      </button>`;
    }).join('')}</div>
  `, true);
  modalCard.querySelectorAll('.btn-op').forEach(b => {
    b.addEventListener('click', () => {
      const i = +b.dataset.i;
      resolverEvento(ev, i);
      modalTravado = false; fecharModal();
      const op = ev.op[i];
      abrirModal(`
        <div class="modal-tape" aria-hidden="true"></div>
        <h3 class="modal-title">${ev.titulo}</h3>
        <p class="modal-text">${op.res}</p>
        <p class="modal-fx">${fmtFx(op.fx)}</p>
        <button class="btn btn-primary" id="m-ok">Seguir em frente</button>
      `);
      $('#m-ok').addEventListener('click', () => { fecharModal(); checarFimOuRender(); });
    });
  });
}

function abrirAjuda() {
  abrirModal(`
    <div class="modal-tape" aria-hidden="true"></div>
    <h3 class="modal-title">Manual da militância</h3>
    <div class="modal-text manual">
      <p><strong>O objetivo:</strong> em 90 dias, antes da eleição do DCE, deflagrar uma greve estudantil e arrancar da reitoria o máximo da pauta: bandejão, moradia, PAPFE e cotas.</p>
      <p><strong>O mural de táticas:</strong> escolha uma tática por vez; cada uma leva alguns dias. Toque em "Virar o dia" para o tempo passar — ou "Tocar reto" para avançar até algo acontecer.</p>
      <p><strong>Mobilização ✊</strong> é a sua base. Precisa de 55 pra deflagrar a greve — e durante a greve ela se desgasta todo dia. Se zerar, a greve morre.</p>
      <p><strong>Pressão ▲</strong> é o quanto a reitoria está acuada. Sobe sozinha durante a greve e é a moeda da mesa: cada conquista assinada consome pressão.</p>
      <p><strong>Opinião pública ◉</strong> é a cidade olhando pra vocês. Ações radicais (trancaço, ocupação) dão pressão mas queimam a imagem; marcha, imprensa e aula pública constroem simpatia. Na mesa, imagem é força.</p>
      <p><strong>A Mesa:</strong> instale-a pelo mural e convoque rodadas (2 dias cada). A reitoria oferece cada item <em>na íntegra</em> ou <em>rebaixado</em>, conforme sua força (pressão + opinião − resistência). Cada assinatura endurece a reitoria. Itens rebaixados valem meio ponto — e podem ser elevados depois.</p>
      <p><strong>Caixa R$</strong> paga panfleto, som e capa de chuva. Festival e festa beneficente reabastecem.</p>
      <p><strong>O final:</strong> no dia 90, a urna conta os pontos da pauta assinada. Encerre a greve com o acordo final pra sair por cima — greve que esvazia, perde tudo.</p>
    </div>
    <button class="btn btn-primary" id="m-close2">Pra cima deles</button>
  `);
  $('#m-close2').addEventListener('click', fecharModal);
}

/* ================= PASSAGEM DE DIA ================= */
function checarFimOuRender() {
  if (S.fim) { mostrarFim(S.fim); return; }
  renderTudo();
}

function aoVirarDia(res) {
  renderTudo();
  if (res.fim) { mostrarFim(res.fim); return true; }
  if (res.evento) { abrirEvento(res.evento); return true; }
  return false;
}

function diaUnico() {
  if (S.fim || !backdrop.hidden) return;
  aoVirarDia(virarDia());
}

function tocarReto() {
  if (S.fim || !backdrop.hidden) return;
  const tinhaFoco = !!S.focoAtivo;
  for (let i = 0; i < 30; i++) {
    const res = virarDia();
    const parou = res.fim || res.evento || res.focoConcluido || (!tinhaFoco && i >= 4);
    if (parou) {
      renderTudo();
      if (res.fim) { mostrarFim(res.fim); return; }
      if (res.focoConcluido && !res.evento) {
        abrirModal(`
          <div class="modal-tape" aria-hidden="true"></div>
          <span class="modal-kicker">TÁTICA CONCLUÍDA</span>
          <h3 class="modal-title">${res.focoConcluido.nome}</h3>
          <p class="modal-fx">${fmtFx(res.focoConcluido.fx)}</p>
          <button class="btn btn-primary" id="m-ok">Próxima!</button>
        `);
        $('#m-ok').addEventListener('click', fecharModal);
      }
      if (res.evento) abrirEvento(res.evento);
      return;
    }
  }
  renderTudo();
}

/* ================= FIM ================= */
function mostrarFim(id) {
  const fim = FINAIS[id];
  apagarSave();
  $('#end-stamp').textContent = fim.carimbo;
  $('#end-title').textContent = fim.titulo;
  $('#end-text').textContent = fim.texto;
  const detalhePauta = PAUTA.map(p => {
    const st = S.pautaStatus[p.id];
    return `${p.nome}: ${st >= 1 ? 'integral' : st >= 0.5 ? 'rebaixado' : 'não conquistado'}`;
  }).join(' · ');
  const stats = [
    `Pauta assinada: ${pontosPauta()} de 4 pontos`,
    detalhePauta,
    S.greveJa ? `Dias de greve: ${S.diasGreve} · Rodadas de negociação: ${S.rodadas}` : 'A greve nunca foi deflagrada',
    `Mobilização final: ${Math.round(S.mob)} · Pressão: ${Math.round(S.pre)} · Opinião pública: ${Math.round(S.opi)}`,
    `Caixa do DCE: R$ ${S.cash}`,
    S.flags.migalha ? 'A história registra: a gestão aceitou a proposta-migalha.' : null,
    S.flags.pacote ? 'A história registra: a gestão fechou o pacote rebaixado da reitoria.' : null,
    S.flags.acordoFinal ? 'A greve terminou por cima, com acordo final assinado em marcha.' : null,
  ].filter(Boolean);
  $('#end-stats').innerHTML = stats.map(s => `<li>${s}</li>`).join('');
  document.getElementById('end-stamp').className =
    'stamp stamp-end ' + (fim.carimbo === 'VITÓRIA' || fim.carimbo === 'UFA' ? 'stamp-win' : 'stamp-lose');
  mostrarTela('end');
}

/* ================= ABAS ================= */
$$('.tab').forEach(t => t.addEventListener('click', () => {
  $$('.tab').forEach(x => x.classList.remove('active'));
  $$('.tab-panel').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  $('#tab-' + t.dataset.tab).classList.add('active');
  if (t.dataset.tab === 'tree') requestAnimationFrame(desenharLinhas);
}));

/* ================= ARRASTAR O MURAL ================= */
(function () {
  const sc = $('#tree-scroll');
  let down = false, sx = 0, sy = 0, sl = 0, st = 0, moveu = false;
  sc.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return; // touch usa scroll nativo
    down = true; moveu = false;
    sx = e.clientX; sy = e.clientY; sl = sc.scrollLeft; st = sc.scrollTop;
  });
  sc.addEventListener('pointermove', e => {
    if (!down) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) moveu = true;
    sc.scrollLeft = sl - dx; sc.scrollTop = st - dy;
  });
  window.addEventListener('pointerup', () => { down = false; });
  sc.addEventListener('click', e => { if (moveu) { e.stopPropagation(); e.preventDefault(); moveu = false; } }, true);
})();

/* ================= INICIALIZAÇÃO ================= */
function comecarJogo(continuar) {
  if (continuar) {
    if (!continuarPartida()) novaPartida();
  } else {
    apagarSave();
    novaPartida();
  }
  mostrarTela('game');
  renderTudo();
  // centraliza o mural na raiz
  const sc = $('#tree-scroll');
  requestAnimationFrame(() => {
    sc.scrollLeft = Math.max(0, ($('#tree-canvas').offsetWidth - sc.clientWidth) / 2);
  });
  if (!continuar) {
    abrirModal(`
      <div class="modal-tape" aria-hidden="true"></div>
      <span class="modal-kicker">BRIEFING DA GESTÃO</span>
      <h3 class="modal-title">Presida, temos um problema</h3>
      <p class="modal-text">O PAPFE não paga nem a passagem, acharam <em>mais um</em> parafuso na lasanha do bandejão e a reitoria responde os ofícios com carimbo de "ciente". Faltam 90 dias para a eleição do DCE.</p>
      <p class="modal-text">O plano: mobilizar a base, deflagrar a greve geral estudantil e sentar na mesa de negociação com força pra arrancar a pauta inteira. Sem pressa — mas sem perder a eleição.</p>
      <button class="btn btn-primary" id="m-go">Convocar a plenária</button>
    `);
    $('#m-go').addEventListener('click', fecharModal);
  }
}

$('#btn-new').addEventListener('click', () => comecarJogo(false));
$('#btn-continue').addEventListener('click', () => comecarJogo(true));
$('#btn-how').addEventListener('click', abrirAjuda);
$('#btn-day').addEventListener('click', diaUnico);
$('#btn-skip').addEventListener('click', tocarReto);
$('#btn-again').addEventListener('click', () => {
  mostrarTela('title');
  $('#btn-continue').hidden = true;
});

window.addEventListener('resize', () => {
  if (!TELAS.game.hidden) requestAnimationFrame(desenharLinhas);
});

// tela inicial
$('#btn-continue').hidden = !carregarSave();
mostrarTela('title');
