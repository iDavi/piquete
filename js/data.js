/* =========================================================
   PIQUETE SIMULATOR — dados do jogo
   árvore de táticas, eventos, pauta e finais
   ========================================================= */

const TOTAL_DIAS = 90;

const PAUTA = [
  { id: 'bandejao', nome: 'Verba para o bandejão',
    desc: 'Os estudantes juram que já acharam prego, parafuso e uma dobradiça na lasanha. A empresa terceirizada jura que é "proteína texturizada".' },
  { id: 'moradia', nome: 'Vagas na moradia estudantil',
    desc: 'A fila de espera do CRUSP tem mais gente que a fila do bandejão. E olha que a do bandejão dobra o quarteirão.' },
  { id: 'papfe', nome: 'Reajuste do PAPFE',
    desc: 'O auxílio permanência está congelado há tanto tempo que dava pra pagar um almoço em 2019. Hoje paga meio pão de queijo.' },
  { id: 'cotas', nome: 'Ampliação das cotas',
    desc: 'Ampliar as cotas PPI e de escola pública também na pós-graduação. A universidade pública tem que ter a cara do povo.' },
];

/* ---------- ÁRVORE DE TÁTICAS (estilo árvore de focos) ----------
   x, y: posição no mural (colunas/linhas)
   dias: duração | custo: R$ | req: todos | reqAny: pelo menos um
   reqMob / reqPre: mínimo do recurso | excl: mutuamente exclusivo
   needsGreve: só disponível com a greve em curso
   fx: { mob, pre, cash, greve, fimGreve, conquista, flag, passive } */
const FOCOS = [
  { id: 'plenaria', x: 2.25, y: 0, dias: 2,
    nome: 'Plenária de abertura',
    desc: 'Reunir a diretoria do DCE, o café solúvel e o caderno de atas. Tudo começa com uma pauta de informes que ninguém ouve.',
    fx: { mob: 4 } },

  /* --- agitação e propaganda --- */
  { id: 'panfletagem', x: 0.5, y: 1, dias: 3, custo: 60, req: ['plenaria'],
    nome: 'Panfletagem nas catracas',
    desc: 'Mil panfletos, duas resmas e um grampeador emprestado. Metade vira marca-página, mas a outra metade vira conversa.',
    fx: { mob: 7 } },
  { id: 'zine', x: 0, y: 2, dias: 4, custo: 120, req: ['panfletagem'],
    nome: 'Relançar o jornal "O Piquete"',
    desc: 'O lendário jornal do DCE volta a circular. Análise de conjuntura, denúncia do bandejão e palavras cruzadas.',
    fx: { mob: 5, passive: 'zine' },
    passivo: 'Durante a greve, o desgaste diário da mobilização cai.' },
  { id: 'memes', x: 1, y: 2, dias: 3, req: ['panfletagem'],
    nome: 'Comitê de memes',
    desc: 'Três estudantes de design, um celular rachado e zero noção de limite. A página do DCE nunca mais será a mesma.',
    fx: { mob: 9 } },
  { id: 'ato', x: 0.5, y: 3, dias: 4, custo: 180, reqAny: ['zine', 'memes'], reqMob: 30,
    nome: 'Ato na Praça do Relógio',
    desc: 'Carro de som, faixas pintadas na véspera e palavra de ordem ensaiada no busão. Se chover, chove junto.',
    fx: { mob: 10, pre: 6 } },

  /* --- trabalho de base --- */
  { id: 'bandejao_base', x: 1.75, y: 1, dias: 3, req: ['plenaria'],
    nome: 'Corpo a corpo no bandejão',
    desc: 'Conversar mesa por mesa na hora do almoço. Entre um suspiro e um "isso aqui é frango?", a base vai se formando.',
    fx: { mob: 6, pre: 3 } },
  { id: 'conselho_cas', x: 3, y: 1, dias: 4, req: ['plenaria'],
    nome: 'Conselho de Centros Acadêmicos',
    desc: 'Articular os CAs de todas as unidades. A reunião dura cinco horas, mas sai com calendário unificado e vaquinha aprovada.',
    fx: { mob: 6, cash: 250 } },
  { id: 'fundo_greve', x: 2.25, y: 2, dias: 4, reqAny: ['bandejao_base', 'conselho_cas'],
    nome: 'Festival pró-fundo de greve',
    desc: 'Show no estacionamento da história, caipirinha de tampinha e banca de brechó. O caixa agradece, a vizinhança nem tanto.',
    fx: { cash: 450, mob: 3 } },
  { id: 'sintusp', x: 3.25, y: 2, dias: 4, req: ['conselho_cas'],
    nome: 'Unidade com os funcionários',
    desc: 'O sindicato dos trabalhadores da universidade entra junto. Quem limpa, cozinha e mantém o campus de pé conhece cada atalho da reitoria.',
    fx: { pre: 8, passive: 'sintusp' },
    passivo: 'Durante a greve, o desgaste diário da mobilização cai.' },
  { id: 'apg', x: 3.25, y: 3, dias: 3, req: ['sintusp'],
    nome: 'Frente com a pós e secundaristas',
    desc: 'Mestrandos sem bolsa e secundaristas que ocuparam escola em 2016. Reforço de peso — e eles trazem o próprio megafone.',
    fx: { mob: 4, pre: 5 } },

  /* --- via institucional --- */
  { id: 'oficio', x: 4.5, y: 1, dias: 2, req: ['plenaria'],
    nome: 'Protocolar a pauta',
    desc: 'Quatro reivindicações, doze páginas, três vias carimbadas. A reitoria responde com um "recebido, encaminharemos ao setor competente".',
    fx: { pre: 4 } },
  { id: 'audiencia', x: 4.5, y: 2, dias: 3, req: ['oficio'],
    nome: 'Audiência com a pró-reitoria',
    desc: 'Sala com ar-condicionado, biscoito de água e sal e muita cordialidade. Saem promessas vagas — mas agora está em ata.',
    fx: { pre: 6 } },

  /* --- A ASSEMBLEIA --- */
  { id: 'assembleia', x: 2, y: 4, dias: 2, reqAny: ['ato', 'apg'], reqMob: 55, marco: true,
    nome: 'Assembleia geral: deflagrar a GREVE',
    desc: 'Escadaria lotada, votação no braço, arrepio coletivo. Se a maioria levantar a mão, a universidade para.',
    fx: { mob: 8, greve: true },
    passivo: 'Inicia a greve: a pressão sobe todo dia, mas a mobilização se desgasta. Mantenha a chama acesa.' },

  /* --- ação direta (exige greve) --- */
  { id: 'piquete', x: 0.5, y: 5, dias: 3, req: ['assembleia'], needsGreve: true,
    nome: 'Montar os piquetes',
    desc: 'Corrente humana, faixa esticada e termo de compromisso com o diálogo (e com o cafezinho das 6h da manhã).',
    fx: { pre: 8, passive: 'piquete' },
    passivo: 'A pressão diária da greve aumenta.' },
  { id: 'vigilia', x: 1.5, y: 5, dias: 3, custo: 100, req: ['assembleia'], needsGreve: true,
    nome: 'Sarau e vigília cultural',
    desc: 'Violão, poesia marginal e cachorro-quente solidário. Greve que canta não esvazia.',
    fx: { mob: 8 } },
  { id: 'trancaco', x: 2.5, y: 5, dias: 2, req: ['assembleia'], needsGreve: true,
    nome: 'Trancaço na portaria 1',
    desc: 'Catraca livre e aula pública no asfalto. O trânsito reclama, a reitoria liga três vezes em uma hora.',
    fx: { pre: 10, mob: -2 } },
  { id: 'ocupacao', x: 0, y: 6, dias: 4, req: ['piquete'], reqMob: 55, excl: 'marcha', needsGreve: true,
    nome: 'Ocupar a reitoria',
    desc: 'Colchonete no saguão, comissão de limpeza e assembleia permanente. Radical, arriscado — e impossível de ignorar.',
    fx: { pre: 18, mob: -4 } },
  { id: 'marcha', x: 1.2, y: 6, dias: 4, custo: 250, req: ['piquete'], excl: 'ocupacao', needsGreve: true,
    nome: 'Marcha até a Paulista',
    desc: 'Oito quilômetros de caminhada, apoio dos motoristas de busão e manchete no jornal da noite. A cidade inteira fica sabendo.',
    fx: { pre: 10, mob: 8 } },

  /* --- mesa de negociação (exige greve) --- */
  { id: 'mesa', x: 4, y: 5, dias: 3, req: ['assembleia', 'audiencia'], reqPre: 30, needsGreve: true,
    nome: 'Mesa de negociação',
    desc: 'Agora é oficial: reitoria de um lado, comando de greve do outro. Cada conquista vai custar pressão acumulada.',
    fx: { pre: 4 } },
  { id: 'c_bandejao', x: 3, y: 6, dias: 3, req: ['mesa'], reqPre: 45, needsGreve: true, conquistaNode: true,
    nome: 'Arrancar verba pro bandejão',
    desc: 'Nova licitação, nutricionista concursada e fiscalização estudantil. Nunca mais um parafuso à bolonhesa.',
    fx: { conquista: 'bandejao', pre: -15, mob: 5 } },
  { id: 'c_moradia', x: 4, y: 6, dias: 3, req: ['mesa'], reqPre: 55, needsGreve: true, conquistaNode: true,
    nome: 'Vagas na moradia',
    desc: 'Reforma do bloco interditado e edital novo de vagas. A fila anda — de verdade, dessa vez.',
    fx: { conquista: 'moradia', pre: -18 } },
  { id: 'c_papfe', x: 5, y: 6, dias: 4, req: ['mesa'], reqPre: 65, needsGreve: true, conquistaNode: true,
    nome: 'Reajuste do PAPFE',
    desc: 'Reajuste real, calendário de pagamento e revisão anual. O auxílio volta a ser auxílio.',
    fx: { conquista: 'papfe', pre: -22, mob: 6 } },
  { id: 'c_cotas', x: 4.5, y: 7, dias: 4, reqAny: ['c_papfe', 'c_moradia'], reqPre: 75, needsGreve: true, conquistaNode: true,
    nome: 'Ampliação das cotas',
    desc: 'Cotas PPI e de escola pública também na pós. A conquista mais dura da mesa — e a que muda mais vidas.',
    fx: { conquista: 'cotas', pre: -25 } },

  /* --- desfecho --- */
  { id: 'acordo', x: 2.4, y: 7, dias: 2, req: ['mesa'], minConq: 2, needsGreve: true, marco: true,
    nome: 'Assinar o acordo e sair em marcha',
    desc: 'Encerrar a greve por cima, com ata assinada e festa na escadaria. O que não foi conquistado fica pra próxima gestão.',
    fx: { fimGreve: true, mob: 15 },
    passivo: 'Encerra a greve: o desgaste para, mas a mesa de negociação fecha.' },
];

/* ---------- EVENTOS ----------
   cond(s): elegível? | once: dispara uma vez | peso: chance relativa
   op: { txt, custo?, fx, res } */
const EVENTOS = [
  { id: 'parafuso', once: true, peso: 3,
    titulo: 'Um parafuso na lasanha',
    texto: 'Uma caloura da geografia morde a lasanha do bandejão e encontra um parafuso sextavado, levemente gratinado. Ela fotografou tudo.',
    op: [
      { txt: 'Expor nas redes do DCE, com close no parafuso',
        fx: { mob: 8 }, res: 'A foto roda a universidade inteira em duas horas. Até quem nunca pisou numa assembleia está indignado.' },
      { txt: 'Guardar a prova para o dossiê do bandejão',
        fx: { pre: 7 }, res: 'O parafuso vira a peça central do dossiê. A reitoria vai suar frio quando ele aparecer na mesa.' },
    ] },
  { id: 'chuva', peso: 2,
    titulo: 'Frente fria no campus',
    texto: 'Chuva de cortar atividade. A quadra de panfletagem virou piscina e o pessoal do som olha pro céu com ódio.',
    op: [
      { txt: 'Recolher tudo e remarcar',
        fx: { mob: -3 }, res: 'Dia perdido. O pessoal volta pra casa encharcado e meio desanimado.' },
      { txt: 'Comprar capas de chuva e seguir o baile', custo: 60,
        fx: { cash: -60, mob: 3 }, res: 'A cena dos militantes de capa amarela panfletando na chuva vira foto icônica da campanha.' },
    ] },
  { id: 'churrasco', once: true, peso: 2,
    titulo: 'Churrasco beneficente',
    texto: 'Os veteranos da engenharia oferecem um churrasco em apoio à luta. Perguntam se podem cobrar entrada "pra ajudar o caixa".',
    op: [
      { txt: 'Cobrar entrada simbólica',
        fx: { cash: 220 }, res: 'Casa cheia, caixa reforçado. O mestre churrasqueiro discursa segurando a espátula.' },
      { txt: 'Entrada livre: churrasco é direito',
        fx: { mob: 4 }, res: 'Vem gente que nunca apareceu em nada. Sai sem dinheiro, mas com vinte contatos novos no grupo.' },
    ] },
  { id: 'editorial', greve: true, peso: 2,
    titulo: 'Editorial contra a greve',
    texto: 'Um jornalão publica editorial chamando a greve de "baderna de privilegiados". O grupo da família já encaminhou pra todo mundo.',
    op: [
      { txt: 'Responder com nota dura e dados do PAPFE',
        fx: { pre: 4, mob: -1 }, res: 'A nota circula bem e desmonta o editorial ponto por ponto. A reitoria percebe que a narrativa escapou.' },
      { txt: 'Ignorar: jornal de ontem embrulha peixe',
        fx: { mob: -3 }, res: 'Sem resposta, o editorial gruda. Alguns estudantes começam a repetir o argumento no corredor.' },
    ] },
  { id: 'infiltrado', greve: true, once: true, peso: 1,
    titulo: 'Tem alguém estranho na assembleia',
    texto: 'Um "estudante" de 45 anos, jaqueta de couro e crachá virado pra dentro anota tudo no fundo da assembleia. Ninguém nunca o viu em aula.',
    op: [
      { txt: 'Expor publicamente, com direito a coro',
        fx: { mob: 5 }, res: '"OLHA O OLHEIRO, OLHA O OLHEIRO!" Ele sai escoltado por vaias. A assembleia vira festa.' },
      { txt: 'Deixar quieto e plantar informação falsa',
        fx: { pre: 6 }, res: 'No dia seguinte, a reitoria se prepara para um trancaço que nunca existiu. O comando de greve dá risada por uma semana.' },
    ] },
  { id: 'pm', greve: true, once: true, peso: 2,
    titulo: 'Viatura na portaria',
    texto: 'A polícia militar estaciona na portaria 1 "a pedido da administração". Os piqueteiros olham pra você esperando uma ordem.',
    op: [
      { txt: 'Recuar o piquete por hoje',
        fx: { pre: -6 }, res: 'Ninguém se machuca, mas a reitoria sente o recuo e respira aliviada.' },
      { txt: 'Resistência pacífica, câmeras ligadas',
        fx: { pre: 8, mob: -3 }, res: 'Estudantes sentados, braços dados, transmissão ao vivo. A imagem corre o país e a reitoria vira a vilã da história.' },
    ] },
  { id: 'migalha', greve: true, once: true, peso: 2, minPre: 35,
    titulo: 'A proposta-migalha',
    texto: 'A reitoria oferece, por baixo dos panos: 5% no PAPFE e fim imediato da greve. "É pegar ou largar", diz o chefe de gabinete.',
    op: [
      { txt: 'Levar à assembleia e recusar de pé',
        fx: { mob: 6 }, res: '"MIGALHA NÃO!" A recusa coletiva vira combustível. A reitoria entende que vai ter que oferecer coisa de verdade.' },
      { txt: 'Aceitar e encerrar a greve',
        fx: { fimGreve: true, pre: -999, mob: 4, flag: 'migalha' },
        res: 'A greve acaba com um acordo magro. Parte da base comemora o descanso; outra parte não esquece.' },
    ] },
  { id: 'provas', greve: true, peso: 2,
    titulo: 'Provas em plena greve',
    texto: 'Uma congregação resolve manter a semana de provas "independentemente do contexto". A base entra em pânico silencioso.',
    op: [
      { txt: 'Exigir a suspensão do calendário',
        fx: { pre: 4, mob: -2 }, res: 'A briga é feia, mas o calendário trava. Alguns estudantes aproveitam pra estudar escondido mesmo assim.' },
      { txt: 'Liberar a base pra estudar essa semana',
        fx: { mob: -4 }, res: 'Compreensível, mas o piquete fica ralo. A reitoria anota a fraqueza no caderninho.' },
    ] },
  { id: 'viral', once: true, peso: 2,
    titulo: 'O vídeo do bandejão viralizou',
    texto: 'Um estudante filmou a bandeja rangendo como porta de filme de terror. Três milhões de visualizações e subindo.',
    op: [
      { txt: 'Surfar a onda com a pauta completa',
        fx: { mob: 9 }, res: 'O DCE responde o vídeo com a pauta de reivindicações. Chove apoio até de gente de outra universidade.' },
      { txt: 'Encaminhar pra grande imprensa',
        fx: { pre: 6 }, res: 'Matéria de dois minutos no jornal da noite. A assessoria da reitoria cancela o fim de semana.' },
    ] },
  { id: 'som', peso: 2,
    titulo: 'A caixa de som morreu',
    texto: 'A lendária caixa de som do DCE, veterana de doze greves, soltou fumaça no meio do ato. Minuto de silêncio (literalmente).',
    op: [
      { txt: 'Pagar o conserto no técnico da vila', custo: 120,
        fx: { cash: -120 }, res: 'O técnico solda, benze e devolve. "Aguenta mais umas três greves", garante.' },
      { txt: 'Seguir no grito mesmo',
        fx: { mob: -2 }, res: 'O coro até funciona, mas quem está atrás não ouve nada e vai embora mais cedo.' },
    ] },
  { id: 'boato', greve: true, peso: 2,
    titulo: 'Boato: "a greve acabou"',
    texto: 'Surge nos grupos um print dizendo que a greve foi encerrada "por decisão da diretoria". É falso, mas está voando.',
    op: [
      { txt: 'Edição-relâmpago do desmentido', custo: 40,
        fx: { cash: -40, mob: 4 }, res: 'Panfleto na mão de todo mundo antes do almoço: "A GREVE ESTÁ DE PÉ". O boato morre na praia.' },
      { txt: 'Deixar o boato morrer sozinho',
        fx: { mob: -5 }, res: 'Boato não morre sozinho. Duas unidades voltam às aulas antes do desmentido chegar.' },
    ] },
  { id: 'atletica', once: true, peso: 2,
    titulo: 'A atlética quer conversar',
    texto: 'A atlética propõe uma festa conjunta: metade da renda pro fundo de greve, metade pra eles. "Luta e resenha, presida."',
    op: [
      { txt: 'Fechar a parceria',
        fx: { cash: 180, mob: 2 }, res: 'A festa lota. Militante e atleta dividindo o mesmo refrão é a cena mais improvável do semestre.' },
      { txt: 'Recusar: agora é momento de seriedade',
        fx: { pre: 1 }, res: 'A diretoria mais à esquerda aprova a firmeza. A atlética faz a festa sozinha e não divide nada.' },
    ] },
  { id: 'calouros', once: true, peso: 2, maxDia: 35,
    titulo: 'Chegaram os ingressantes do meio do ano',
    texto: 'Turma nova no campus, mapa na mão, sem saber onde fica nada. Energia de sobra e nenhum vício de assembleia.',
    op: [
      { txt: 'Mutirão de acolhida com panfleto da pauta',
        fx: { mob: 6 }, res: 'Os ingressantes descobrem o DCE antes de descobrir a biblioteca. Vários aparecem na atividade seguinte.' },
      { txt: 'Churrasco de integração por conta do DCE', custo: 80,
        fx: { cash: -80, mob: 9 }, res: 'Nada conquista um ingressante como comida de graça. Sai do churrasco uma comissão inteira de calouros.' },
    ] },
  { id: 'bolsas', greve: true, once: true, peso: 2,
    titulo: 'Ameaça às bolsas',
    texto: 'Circula um memorando interno: a reitoria estuda "rever os auxílios" dos estudantes que participam dos piquetes.',
    op: [
      { txt: 'Denunciar ao Ministério Público',
        fx: { pre: 7 }, res: 'O MP abre apuração por assédio institucional. O memorando some misteriosamente dos arquivos.' },
      { txt: 'Vaquinha de proteção aos bolsistas', custo: 150,
        fx: { cash: -150, mob: 6 }, res: 'Ninguém solta a mão de ninguém: o fundo cobre quem for cortado. Os bolsistas seguram o piquete com o dobro da força.' },
    ] },
  { id: 'tv', greve: true, once: true, peso: 2,
    titulo: 'Convite pro debate ao vivo',
    texto: 'Uma emissora chama a presidência do DCE pra debater com o porta-voz da reitoria, ao vivo, no horário do almoço.',
    op: [
      { txt: 'Ir pessoalmente, com dossiê embaixo do braço',
        fx: { pre: 5, mob: 2 }, res: 'Você cita o parafuso, o porta-voz gagueja, o apresentador pede o dossiê emprestado. Vitória no ibope e na mesa.' },
      { txt: 'Mandar a vice, que é melhor de retórica',
        fx: { mob: 3 }, res: 'A vice destrói no debate e ainda manda um salve pro bandejão. O ego aguenta; o movimento agradece.' },
    ] },
  { id: 'caramelo', once: true, peso: 2,
    titulo: 'Um caramelo no piquete',
    texto: 'Um vira-lata caramelo adotou a portaria como casa e o piquete como família. Já tem apelido: Breque.',
    op: [
      { txt: 'Adotar oficialmente: agora ele é patrimônio do DCE', custo: 30,
        fx: { cash: -30, mob: 6 }, res: 'Breque ganha bandana vermelha e crachá de "diretor de moral". A foto dele rende mais adesão que qualquer panfleto.' },
      { txt: 'Só garantir o bandejão dele',
        fx: { mob: 3 }, res: 'Breque almoça com a comissão de frente todos os dias. Extraoficialmente, já é da diretoria.' },
    ] },
];

/* ---------- FINAIS ---------- */
const FINAIS = {
  historica: {
    carimbo: 'VITÓRIA', titulo: 'A gestão que entrou pra história',
    texto: 'Três conquistas ou mais arrancadas da reitoria. A chapa da situação vence a eleição do DCE com folga histórica, e a foto da assinatura do acordo vai parar no corredor do diretório — ao lado das fotos de 1968, 1979 e 2016. Daqui a dez anos, calouro vai jurar que estava lá.' },
  vitoria: {
    carimbo: 'VITÓRIA', titulo: 'Vitória nas urnas',
    texto: 'Duas conquistas no papel e uma greve que terminou de cabeça erguida. A chapa vence a eleição com margem tranquila. O bandejão ainda não é perfeito, mas pelo menos a lasanha vem sem ferragem.' },
  apertada: {
    carimbo: 'UFA', titulo: 'Vitória no detalhe',
    texto: 'Foi no voto a voto, recontagem e tudo. A chapa se reelege por um fio, carregada pela memória da luta — e pela promessa de terminar o serviço. A oposição já marcou assembleia pra semana que vem.' },
  derrota_honrosa: {
    carimbo: 'DERROTA', titulo: 'Derrota de cabeça erguida',
    texto: 'A luta foi real, mas o saldo não convenceu a maioria. A oposição leva o DCE prometendo "gestão técnica e diálogo". A militância já se reorganiza na base: oposição também se faz com trabalho.' },
  derrota: {
    carimbo: 'DERROTA', titulo: 'A oposição leva o DCE',
    texto: 'Sem conquistas pra mostrar, a chapa da situação naufraga nas urnas. Os novos diretores assumem prometendo "menos ideologia e mais boleto pago". O caderno de atas é entregue em silêncio constrangedor.' },
  esvaziou: {
    carimbo: 'FIM DA GREVE', titulo: 'A greve esvaziou',
    texto: 'Piquete sem gente é só um cone na portaria. Com a base de volta às aulas, a reitoria encerra qualquer negociação e a oposição transforma a greve fracassada em plataforma eleitoral. Fica a lição: greve se sustenta todo dia, não só no dia da assembleia.' },
  sem_greve: {
    carimbo: 'MELANCIA', titulo: 'O semestre acabou e a greve ficou pra depois',
    texto: 'Noventa dias de reunião, ofício e panfleto — mas a assembleia que importava nunca aconteceu. A eleição passa em branco, a reitoria arquiva a pauta e o parafuso segue firme na lasanha. A próxima gestão herda a tarefa.' },
};
