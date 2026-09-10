#!/usr/bin/env bash
set -Eeuo pipefail

readonly deploy_root="${SHOWDOWN_DEPLOY_ROOT:-/opt/showdown-autodeploy}"
readonly state_root="${deploy_root}/state"
readonly repository_url="${SHOWDOWN_REPOSITORY_URL:-https://github.com/AlexKorchagingit/showdown.git}"
readonly repository_dir="${state_root}/repository.git"
readonly work_root="${state_root}/work"
readonly web_root="${SHOWDOWN_WEB_ROOT:-/var/www/showdown-brn}"
readonly releases_root="${web_root}/releases"
readonly current_link="${web_root}/current"
readonly deployed_commit_file="${web_root}/.deployed-commit"
readonly health_host="${SHOWDOWN_HEALTH_HOST:-showdown-br.ru}"
readonly lock_file="${state_root}/deploy.lock"

export COREPACK_HOME="${state_root}/corepack"
export COREPACK_NPM_REGISTRY="https://registry.npmjs.org"
export NPM_CONFIG_CACHE="${state_root}/npm-cache"

for command_name in corepack curl flock git node tar; do
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "Required command is missing: ${command_name}" >&2
    exit 1
  fi
done

install -d -m 0755 "${state_root}" "${work_root}"
mkdir -p "${releases_root}"

exec 9>"${lock_file}"
if ! flock -n 9; then
  echo "Another deployment is already running; leaving it untouched."
  exit 0
fi

if [[ ! -d "${repository_dir}" ]]; then
  git clone --mirror "${repository_url}" "${repository_dir}"
fi

git --git-dir="${repository_dir}" fetch --quiet --prune origin \
  '+refs/heads/main:refs/remotes/origin/main'

commit="$(git --git-dir="${repository_dir}" rev-parse \
  'refs/remotes/origin/main^{commit}')"

if [[ ! "${commit}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Refusing to deploy an invalid commit id: ${commit}" >&2
  exit 1
fi

deployed_commit=""
if [[ -f "${deployed_commit_file}" ]]; then
  deployed_commit="$(tr -d '[:space:]' < "${deployed_commit_file}")"
fi

if [[ "${commit}" == "${deployed_commit}" ]]; then
  echo "Commit ${commit:0:12} is already active."
  exit 0
fi

readonly release_dir="${releases_root}/${commit}"
build_dir=""
candidate_dir=""

cleanup() {
  if [[ -n "${build_dir}" && "${build_dir}" == "${work_root}/build."* ]]; then
    rm -rf -- "${build_dir}"
  fi
  if [[ -n "${candidate_dir}" && "${candidate_dir}" == "${releases_root}/.${commit}.candidate."* ]]; then
    rm -rf -- "${candidate_dir}"
  fi
}
trap cleanup EXIT

if [[ ! -f "${release_dir}/index.html" ]]; then
  build_dir="$(mktemp -d "${work_root}/build.XXXXXXXX")"
  install -d -m 0755 "${build_dir}/source"
  git --git-dir="${repository_dir}" archive "${commit}" | \
    tar -x -C "${build_dir}/source"

  (
    cd "${build_dir}/source"
    corepack npm@11.6.2 ci --ignore-scripts --no-audit --no-fund
    SOURCE_COMMIT="${commit}" corepack npm@11.6.2 run build
  )

  test -s "${build_dir}/source/dist/index.html"

  candidate_dir="${releases_root}/.${commit}.candidate.$$"
  install -d -m 0755 "${candidate_dir}"
  cp -a "${build_dir}/source/dist/." "${candidate_dir}/"
  find "${candidate_dir}" -type d -exec chmod 0755 {} +
  find "${candidate_dir}" -type f -exec chmod 0644 {} +
  mv -- "${candidate_dir}" "${release_dir}"
  candidate_dir=""
fi

previous_release=""
if [[ -L "${current_link}" ]]; then
  previous_release="$(readlink "${current_link}")"
fi

next_link="${current_link}.next.$$"
ln -s "${release_dir}" "${next_link}"
mv -Tf -- "${next_link}" "${current_link}"

rollback() {
  echo "Health check failed; restoring the previous frontend release." >&2
  if [[ -n "${previous_release}" ]]; then
    rollback_link="${current_link}.rollback.$$"
    ln -s "${previous_release}" "${rollback_link}"
    mv -Tf -- "${rollback_link}" "${current_link}"
  fi
}

if ! curl --fail --silent --show-error --max-time 5 \
  --header "Host: ${health_host}" \
  http://127.0.0.1/__health >/dev/null; then
  rollback
  exit 1
fi

if ! curl --fail --silent --show-error --max-time 8 \
  --header "Host: ${health_host}" \
  http://127.0.0.1/ | grep -q '<div id="root"></div>'; then
  rollback
  exit 1
fi

commit_file_next="${deployed_commit_file}.next.$$"
printf '%s\n' "${commit}" > "${commit_file_next}"
mv -Tf -- "${commit_file_next}" "${deployed_commit_file}"

echo "Activated commit ${commit:0:12} at ${release_dir}."
