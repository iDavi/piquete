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
  $('#hud-cash').textContent = 'R$ ' + S.cash;
  $('#bar-mob').style.width = clamp(S.mob, 0, 100) + '%';
  $('#bar-pre').style.width = clamp(S.pre, 0, 100) + '%';
  $('#hud-greve').hidden = !S.greve;
  $('#badge-pauta').textContent = S.conquistas.length + '/4';
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
    el.className = `focus-node st-${est}` + (f.marco ? ' marco' : '') + (f.conquistaNode ? ' conq' : '');
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

/* ================= PAUTA / DIÁRIO ================= */
function renderPauta() {
  $('#pauta-list').innerHTML = PAUTA.map(p => {
    const ok = S.conquistas.includes(p.id);
    return `<li class="pauta-item ${ok ? 'ok' : ''}">
      <div class="pauta-check">${ok ? '✊' : '·'}</div>
      <div><strong>${p.nome}</strong><p>${p.desc}</p>
      <span class="pauta-status">${ok ? 'CONQUISTADO — assinado em ata' : 'em aberto'}</span></div>
    </li>`;
  }).join('');
}

function renderDiario() {
  $('#diario-list').innerHTML = S.diario.slice(0, 60).map(d =>
    `<li class="diario-item tipo-${d.tipo}">
      <span class="diario-dia">DIA ${d.dia}</span>
      <span class="diario-txt">${d.txt}</span>
    </li>`
  ).join('') || '<li class="diario-item"><span class="diario-txt">Nada registrado ainda.</span></li>';
}

function renderTudo() {
  renderHud(); renderArvore(); renderPauta(); renderDiario();
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
  if (fx.cash) parts.push(`${fx.cash > 0 ? '+' : ''}R$ ${Math.abs(fx.cash)}${fx.cash > 0 ? '' : ' do caixa'}`);
  if (fx.greve) parts.push('DEFLAGRA A GREVE');
  if (fx.fimGreve) parts.push('encerra a greve');
  if (fx.conquista) parts.push('CONQUISTA: ' + PAUTA.find(p => p.id === fx.conquista).nome);
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
      <p><strong>Pressão ▲</strong> é o quanto a reitoria está acuada. Durante a greve ela sobe sozinha, e é a moeda das negociações: cada conquista consome pressão.</p>
      <p><strong>Caixa R$</strong> paga panfleto, som e capa de chuva. Festival e festa beneficente reabastecem.</p>
      <p><strong>O final:</strong> no dia 90, a urna decide. Conquistas assinadas valem mais que discurso bonito.</p>
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
  const stats = [
    `Conquistas assinadas: ${S.conquistas.length} de 4` +
      (S.conquistas.length ? ' — ' + S.conquistas.map(c => PAUTA.find(p => p.id === c).nome).join(', ') : ''),
    S.greveJa ? `Dias de greve: ${S.diasGreve}` : 'A greve nunca foi deflagrada',
    `Mobilização final: ${Math.round(S.mob)} · Pressão final: ${Math.round(S.pre)}`,
    `Caixa do DCE: R$ ${S.cash}`,
    S.flags.migalha ? 'A história registra: a gestão aceitou a proposta-migalha.' : null,
  ].filter(Boolean);
  $('#end-stats').innerHTML = stats.map(s => `<li>${s}</li>`).join('');
  document.getElementById('end-stamp').className =
    'stamp stamp-end ' + (fim.carimbo === 'VITÓRIA' ? 'stamp-win' : fim.carimbo === 'UFA' ? 'stamp-win' : 'stamp-lose');
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
