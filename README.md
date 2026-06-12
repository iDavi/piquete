# ✊ Piquete Simulator

> Faltam 90 dias para a eleição do DCE. O PAPFE não paga nem a passagem, acharam
> *mais um* parafuso na lasanha do bandejão e a reitoria responde os ofícios com
> carimbo de "ciente". O plano: deflagrar a greve geral estudantil e arrancar a
> pauta inteira na mesa de negociação — sem perder a eleição no caminho.

Jogo de estratégia por turnos em que você assume a presidência do DCE de uma
grande universidade paulista. Construa a base, deflagre a greve, sustente o
piquete e negocie com a reitoria antes que a urna decida o seu futuro.

## Como jogar

Abra o `index.html` em qualquer navegador moderno — não há build, dependências
nem servidor obrigatório. Para servir localmente (opcional):

```sh
npx serve .
# ou
python3 -m http.server 8000
```

Funciona em desktop e celular (a interface é responsiva e o mural de táticas
navega por arrasto/scroll). O progresso é salvo automaticamente no navegador.

## Mecânicas

- **Mural de táticas** — uma árvore de objetivos no estilo *focus tree*: cada
  tática leva alguns dias, tem pré-requisitos e às vezes caminhos mutuamente
  exclusivos (ocupar a reitoria *ou* marchar até a Paulista — escolha um lado
  da história).
- **Mobilização ✊** — sua base. Precisa de 55 para aprovar a greve em
  assembleia. Durante a greve ela se desgasta todo dia; se zerar, o piquete
  vira só um cone na portaria.
- **Pressão ▲** — o quanto a reitoria está acuada. Sobe sozinha durante a
  greve e é a moeda da mesa de negociação: cada conquista da pauta consome
  pressão acumulada.
- **Caixa R$** — paga panfleto, carro de som e capa de chuva. Festival
  pró-fundo de greve e churrasco beneficente reabastecem.
- **Eventos** — parafuso na lasanha, viatura na portaria, boato de fim de
  greve, vira-lata caramelo no piquete. Cada escolha tem consequência.
- **A pauta** — verba pro bandejão, vagas na moradia, reajuste do PAPFE e
  ampliação das cotas. No dia 90, a urna conta o que foi assinado em ata, não
  o que ficou no discurso. Conquistar as quatro rende o final histórico — mas
  só quem souber encerrar a greve por cima chega lá.

## Tecnologia

HTML, CSS e JavaScript puros, sem framework e sem build.

```
index.html      estrutura das telas
css/style.css   identidade visual (cartaz serigrafado / jornal de mimeógrafo)
js/data.js      árvore de táticas, eventos, pauta e finais
js/game.js      regras, passagem de dia, eleição e persistência
js/ui.js        renderização do mural, modais e HUD
```

O balanceamento foi calibrado com simulações automatizadas de partidas
completas (jogador passivo, aleatório, bom e expert) para garantir que cada
perfil de jogo encontre um final diferente.

---

*impresso no mimeógrafo do DCE — tiragem: a que der*
