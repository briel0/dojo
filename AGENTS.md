# AGENTS.md

Instruções para agentes de IA (Claude Code, Codex, Antigravity etc.) trabalhando neste repositório.

## O que é

**Painel**: página com informações do ecossistema pessoal (ALICE, Treinos, Planner e o que vier). Começa por
um **quadrinho de frequência**, como o do GitHub, juntando várias fontes num só: cada dia ganha uma cor
conforme a combinação de atividades feitas.

> Status: **estrutura inicial**. Ainda sem coletor nem página.

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
| 3 | Atividades do quadrinho | duas: **codar** (contribuições do GitHub, inclusive privadas, ou submissões do Codeforces) e **treinar** (qualquer treino no Treinos, inclusive cardio) | uma atividade por fonte (até 8 combinações); peso, tarefas e gastos ficam para outras partes do painel |
| 4 | Cores | uma por combinação: nada (cinza), só codou (verde), só treinou (azul), os dois (dourado) | célula dividida em pedaços, um por atividade |
| 5 | Intensidade | a cor não mostra quantidade; passar o mouse mostra o detalhe do dia | tons por quantidade, como no GitHub |
| 6 | Dia | calendário de Brasília (`America/Sao_Paulo`) para todas as fontes | UTC |
| 7 | Formato do JSON | contagens por fonte e por dia (`{"github": 3, "codeforces": 2, "workout": 1}`); a cor é regra da página | só a combinação do dia (perderia o detalhe e prenderia a regra das cores) |
| 8 | Coletor | Python só com a biblioteca padrão (`urllib`, `json`), roda com o `python3` do sistema na VPS (3.12) | `httpx` e um ambiente do `uv` (dependência e venv para poucas chamadas HTTP) |

Ao tomar uma decisão nova, acrescente-a nesta tabela.

## Estrutura

```
painel/
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
