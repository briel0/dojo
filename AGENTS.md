# AGENTS.md

Instruções para agentes de IA (Claude Code, Codex, Antigravity etc.) trabalhando neste repositório.

## O que é

**Dojo** (*DOJO's Obviously Just Overkill*, acrônimo recursivo): painel pessoal, uma página com informações do ecossistema pessoal (ALICE, Treinos, Planner e o que vier). Começa por
um **quadrinho de frequência**, como o do GitHub, juntando várias fontes num só: cada dia ganha uma cor
conforme a combinação de atividades feitas.

> Status: **no ar na VPS** (coleta de hora em hora; instalação e operação em `deploy/README.md`). Falta
> decidir as estatísticas do topo.
>
> Ver no PC: rode o coletor (o JSON vai para `web/activity.json`, ignorado pelo Git) e
> `python -m http.server 8090 --bind 127.0.0.1 -d web`, depois abra `http://localhost:8090`.
>
> Rodar no PC: `.env` na raiz (ver `.env.example`) e `GITHUB_TOKEN="$(gh auth token)" python collector/collect.py`.
> Para os treinos, abrir antes o túnel da API (`ssh -N -L 8781:127.0.0.1:5265 alice-vm`) e usar
> `TREINOS_API_URL=http://localhost:8781`.

## Repositório público, dados fora dele (regra principal)

O repositório é público e tem só código e exemplos. Os dados (o JSON gerado), os tokens e o usuário do
Codeforces ficam na VPS, fora do Git.

- Nunca coloque dados pessoais no código, nos docs, nos exemplos ou nas mensagens de commit.
- Nunca commite `.env`, tokens nem arquivos de `data/`.

## Decisões

Mesma regra dos outros projetos: ao implementar algo que dependa de uma decisão, relembre o dono qual caminho
foi escolhido, quais eram as alternativas e os prós e contras. Se outro caminho parecer melhor, proponha antes
de seguir.

| # | Decisão | Escolha | Alternativas descartadas |
|---|---|---|---|
| 1 | Onde fica | VPS, servido pelo nginx só em `127.0.0.1:8082`, acesso por túnel SSH (como o Planner) | GitHub Pages (tudo público), domínio com login (exposto), Cloudflare Tunnel; Tailscale está no backlog da ALICE |
| 2 | Como os dados chegam à página | um coletor roda por timer (de hora em hora) e grava um JSON; a página só lê o arquivo | API própria (processo sempre ligado; GitHub e Codeforces precisariam de cache por causa do limite de chamadas), tabelas no Postgres (ainda precisaria de algo para servir) |
| 3 | Atividades do quadrinho | três: **codar** (contribuições do GitHub, inclusive privadas, ou submissões do Codeforces), **treinar** (qualquer treino no Treinos, inclusive cardio) e **dar aula** (aulas ao vivo dos demonstrativos de repasse) | uma atividade por fonte; peso, tarefas e gastos ficam para outras partes do painel |
| 4 | Cores | cada atividade tem a sua cor: código vermelho `#FF3B4E`, treino âmbar `#FFB000`, aula azul `#3D7BFF`; um dia com mais de uma é a célula dividida em faixas diagonais iguais, na ordem código, treino, aula; nada `#23232D`. Antes a aula era verde `#1FC79A` e o código azul (paleta Okabe-Ito, segura para daltônicos), mas no tema escuro verde e azul ficavam parecidos demais | uma cor por combinação (com três atividades seriam 7 cores para decorar); um quadrinho por atividade |
| 5 | Intensidade | a cor não mostra quantidade; passar o mouse mostra o detalhe do dia | tons por quantidade, como no GitHub |
| 6 | Dia | calendário de Brasília (`America/Sao_Paulo`) para todas as fontes | UTC |
| 7 | Formato do JSON | contagens por fonte e por dia (`{"github": 3, "codeforces": 2, "workout": 1}`); a cor é regra da página | só a combinação do dia (perderia o detalhe e prenderia a regra das cores) |
| 8 | Coletor | Python só com a biblioteca padrão (`urllib`, `json`), roda com o `python3` do sistema na VPS (3.12) | `httpx` e um ambiente do `uv` (dependência e venv para poucas chamadas HTTP) |
| 9 | O que conta como codar no Codeforces | qualquer submissão, com qualquer veredito | só as aceitas (tentar e errar também é codar) |
| 10 | Fonte que falha | mantém as contagens da execução anterior e registra o erro em `sources` no JSON; as outras seguem | falhar tudo (uma API fora do ar apagaria o quadrinho) |
| 11 | Fuso de Brasília no código | deslocamento fixo de -03:00, sem a base de fusos (o Python no Windows não a traz). Não há horário de verão desde 2019 | `zoneinfo` + pacote `tzdata` (dependência só para isso) |
| 12 | Período do quadrinho | os últimos 12 meses (53 semanas), terminando hoje | a temporada (janeiro a dezembro), como no mockup: em janeiro o quadrinho estaria quase vazio |
| 13 | Visual | segue o mockup "Dojo · placar" (só local, em `refs/`): tema escuro, Big Shoulders Display e Martian Mono do Google Fonts, cantos retos e cortes diagonais. Reproduzido em HTML, CSS e JavaScript puro, sem o React do mockup | — |
| 14 | Fonte das aulas | demonstrativos mensais de repasse em PDF, lidos no PC por `collector/import_aulas.py` (`pdftotext`). Só entram aulas ao vivo (vídeos gravados ficam de fora); guarda só dia e horário, nunca valores nem turmas. O JSON vai para `/var/lib/dojo/aulas.json` na VPS | digitar os dias à mão; guardar o demonstrativo inteiro |
| 15 | Favicon | SVG com quatro células do quadrinho (código, treino, aula e um dia com as três) | letra ou logotipo (a fonte do título não carrega num SVG de favicon) |

Adiado: as estatísticas do topo do mockup (sequência atual, recorde, dias completos). Falta decidir o que conta
para cada uma.

Limite conhecido: o GitHub já entrega o total por dia, no calendário dele, e não dá para reagrupar no fuso de
Brasília. Uma contribuição perto da meia-noite pode cair num dia diferente das outras fontes.

Ao tomar uma decisão nova, acrescente-a nesta tabela.

## Estrutura

```
dojo/
├── collector/   # coletor: busca as fontes e grava o JSON
├── web/         # página estática (HTML, CSS e JavaScript, sem framework)
├── deploy/      # timer do systemd e site do nginx (a criar)
├── docs/        # design.md: identidade visual decidida (a criar)
└── refs/        # referências visuais, só local (ignorada pelo Git)
```

## Fontes

- **GitHub**: calendário de contribuições pela API GraphQL, com token (as contribuições privadas exigem).
- **Codeforces**: submissões pela API pública (`user.status`), sem token.
- **Treinos**: treinos por período pela API (`GET /api/workouts?since=&until=`), dentro da VPS.

## Configuração

Variáveis de ambiente, nunca no código (exemplo em `.env.example`). Na VPS, ficam num arquivo lido pelo
serviço do systemd, fora do repositório.

## Backlog

1. Outras partes do painel: peso corporal, tarefas concluídas, cartões do Planner, gastos. Dados ao vivo podem
   passar pelo nginx até as APIs que já existem, sem serviço novo.
2. Guardar o histórico no Postgres, se as fontes externas começarem a perder dados antigos.

## Convenções

- Código e comentários em português, como nos outros projetos.
- Commits em inglês, no padrão Conventional Commits.
- Nunca commitar sem aprovação explícita do dono do projeto.
- Dependências novas: conferir a licença antes (preferir MIT/Apache/BSD).
