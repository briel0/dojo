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
- O token do GitHub expira: quando o rodapé da página disser que o GitHub falhou, gere outro e troque em
  `/etc/dojo/dojo.env`.
