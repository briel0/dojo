# Deploy na VPS

Código em `/opt/dojo/app` (clone do repositório, dono `dojo`), JSON em `/var/lib/dojo`, configuração em
`/etc/dojo/dojo.env` (root, `600`; modelo em `.env.example`, com `OUTPUT_PATH=/var/lib/dojo/activity.json` e
`TREINOS_API_URL=http://127.0.0.1:5265`).

Instalação (uma vez):

```bash
sudo useradd --system --home-dir /opt/dojo --shell /usr/sbin/nologin dojo
sudo install -d -o dojo -g dojo -m 755 /opt/dojo /var/lib/dojo
sudo -u dojo git clone https://github.com/briel0/dojo.git /opt/dojo/app
sudo cp deploy/dojo-collector.service deploy/dojo-collector.timer /etc/systemd/system/
sudo cp deploy/nginx-dojo.conf /etc/nginx/sites-available/dojo
sudo ln -s /etc/nginx/sites-available/dojo /etc/nginx/sites-enabled/dojo
sudo nginx -t && sudo systemctl reload nginx
sudo systemctl daemon-reload && sudo systemctl enable --now dojo-collector.timer
```

- Atualizar: `sudo -u dojo git -C /opt/dojo/app pull --ff-only` (a página muda na hora; o coletor, na próxima coleta).
- Coletar agora: `sudo systemctl start dojo-collector`. Ver o resultado: `journalctl -u dojo-collector -n 20`.
- Abrir no PC: `ssh -N -L 8082:127.0.0.1:8082 alice-vm` e `http://localhost:8082`.
- "For you" (decisão 17): definições em `/etc/dojo/treinos.json` (modelo em `collector/treinos.example.json`),
  legível pelo coletor (`sudo install -o root -g dojo -m 640 treinos.json /etc/dojo/treinos.json`), e
  `TREINOS_PLANO_PATH=/etc/dojo/treinos.json` no `dojo.env`.
- GRUB (decisões 18 e 19): `GRUB_USER_ID=<id do perfil>` no `dojo.env`. O site do nginx repassa o problema do
  dia para `api.grubufabc.com`; depois de atualizar `deploy/nginx-dojo.conf`, copie de novo para
  `/etc/nginx/sites-available/dojo` e rode `sudo nginx -t && sudo systemctl reload nginx`.
- AULA (decisão 20): clone do repositório (privado) de planejamento das aulas em `/var/lib/dojo/aulas-plano`,
  atualizado pelo serviço antes de cada coleta com uma deploy key só de leitura:

  ```bash
  sudo -u dojo install -d -m 700 /var/lib/dojo/.ssh
  sudo -u dojo ssh-keygen -t ed25519 -N "" -C dojo-aulas -f /var/lib/dojo/.ssh/aulas-plano
  # cadastrar a chave pública como deploy key (só leitura) no repositório, então:
  sudo -u dojo sh -c 'ssh-keyscan github.com > /var/lib/dojo/.ssh/known_hosts'
  sudo -u dojo env GIT_SSH_COMMAND="ssh -i /var/lib/dojo/.ssh/aulas-plano -o IdentitiesOnly=yes -o UserKnownHostsFile=/var/lib/dojo/.ssh/known_hosts" \
    git clone git@github.com:<dono>/<repositório>.git /var/lib/dojo/aulas-plano
  ```

  E `AULAS_PLANO_REPO=/var/lib/dojo/aulas-plano` no `dojo.env`. Depois de atualizar o
  `deploy/dojo-collector.service`, copie de novo para `/etc/systemd/system/` e rode `sudo systemctl daemon-reload`.
- O token do GitHub expira: quando o rodapé da página disser que o GitHub falhou, gere outro e troque em
  `/etc/dojo/dojo.env`.
