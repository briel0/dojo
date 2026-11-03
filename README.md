# Dojo

Painel pessoal que junta informações de vários serviços. Começa por um quadrinho de frequência no estilo do
GitHub, em que a cor de cada dia mostra a combinação de atividades feitas (codar e treinar).

Um coletor roda de hora em hora, busca os dados no GitHub, no Codeforces e numa API própria de treinos e grava
um JSON. A página é estática e só lê esse arquivo.

Detalhes, decisões e convenções em [AGENTS.md](AGENTS.md).
