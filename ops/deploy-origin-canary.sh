#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 || ! "$1" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  echo "Usage: $0 <release-id>" >&2
  exit 64
fi

readonly release_id="$1"
readonly release_root="/var/www/showdown-origin/releases"
readonly release_dir="${release_root}/${release_id}"
readonly current_link="/var/www/showdown-origin/current"
readonly archive="/tmp/showdown-origin-${release_id}.tar.gz"
readonly candidate="/tmp/api.showdown-br.ru.conf"
readonly active_config="/etc/nginx/sites-available/api.showdown-br.ru"
readonly backup_config="/etc/nginx/sites-available/api.showdown-br.ru.bak-${release_id}"

for required in "${archive}" "${candidate}" "${active_config}"; do
  if [[ ! -f "${required}" ]]; then
    echo "Required file is missing: ${required}" >&2
    exit 1
  fi
done

if [[ -e "${release_dir}" ]]; then
  echo "Release already exists; refusing to overwrite: ${release_dir}" >&2
  exit 1
fi

if [[ -e "${backup_config}" ]]; then
  echo "Backup already exists; refusing to overwrite: ${backup_config}" >&2
  exit 1
fi

install -d -m 0755 "${release_root}" "${release_dir}"
tar -xzf "${archive}" -C "${release_dir}"
test -f "${release_dir}/index.html"

cp --preserve=mode,ownership,timestamps "${active_config}" "${backup_config}"
install -m 0644 "${candidate}" "${active_config}"

if ! nginx -t; then
  install -m 0644 "${backup_config}" "${active_config}"
  nginx -t
  echo "Candidate rejected; original Nginx configuration restored." >&2
  exit 1
fi

ln -sfn "${release_dir}" "${current_link}.next"
mv -Tf "${current_link}.next" "${current_link}"

if ! systemctl reload nginx; then
  install -m 0644 "${backup_config}" "${active_config}"
  nginx -t
  systemctl reload nginx
  echo "Nginx reload failed; original configuration restored." >&2
  exit 1
fi

echo "Origin canary activated: ${release_dir}"
