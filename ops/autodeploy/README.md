# Production auto-deploy

The Bryansk server polls the public GitHub `main` branch every two minutes. A
new commit is built in an isolated temporary directory. The active
`/var/www/showdown-brn/current` symlink is changed only after the build passes;
failed local health checks restore the previous symlink. Existing releases are
retained for manual rollback.

The service runs as the unprivileged `showdown-deploy` user. Its executable is
root-owned; it has read/write access only to `/opt/showdown-autodeploy/state`
and `/var/www/showdown-brn` through systemd hardening. The server receives no
GitHub write credential or deploy private key because the repository is public.

Runtime build values live in the root-managed
`/etc/showdown-autodeploy.env`. It must contain the public frontend variables,
including the Supabase anon key, but must never be committed. The file mode is
`0640` and its group is `showdown-deploy`.

The host uses Ubuntu's Node.js 22 package and Corepack with npm 11.6.2 pinned
in the deployment script. No third-party package repository is installed.

Useful operational commands:

```bash
sudo systemctl status showdown-autodeploy.timer
sudo systemctl start showdown-autodeploy.service
sudo journalctl -u showdown-autodeploy.service --since today
```

Disable automatic deployment without changing the currently served release:

```bash
sudo systemctl disable --now showdown-autodeploy.timer
```
