#!/usr/bin/env bash
set -Eeuo pipefail

SRC_BRANCH="${1:-review-jules-latest}"
DST_BRANCH="${2:-main}"

STAMP="$(date +%Y%m%d-%H%M%S)"
TMP_BRANCH="premerge-${SRC_BRANCH//\//-}-into-${DST_BRANCH}-${STAMP}"
BACKUP_DST="backup/${DST_BRANCH}-${STAMP}"
BACKUP_SRC="backup/${SRC_BRANCH//\//-}-${STAMP}"

die() {
  echo "ERROR: $*" >&2
  exit 1
}

info() {
  echo
  echo "==> $*"
}

# 1) Validaciones básicas
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "No estás dentro de un repositorio Git."

git show-ref --verify --quiet "refs/heads/${SRC_BRANCH}" || die "No existe la rama local '${SRC_BRANCH}'."
git show-ref --verify --quiet "refs/heads/${DST_BRANCH}" || die "No existe la rama local '${DST_BRANCH}'."

# Árbol limpio: importante para poder abortar con seguridad si hace falta
git diff --quiet || die "Hay cambios sin guardar en el working tree. Haz commit o stash primero."
git diff --cached --quiet || die "Hay cambios staged pendientes. Haz commit o unstage primero."

CURRENT_BRANCH="$(git branch --show-current)"

# 2) Actualizar referencias remotas si existe origin (no obliga a mergear nada remoto)
if git remote get-url origin >/dev/null 2>&1; then
  info "Actualizando referencias remotas"
  git fetch --prune origin
fi

# 3) Resumen antes de tocar nada
info "Resumen entre ${DST_BRANCH} y ${SRC_BRANCH}"

COUNTS="$(git rev-list --left-right --count "${DST_BRANCH}...${SRC_BRANCH}")"
LEFT_COUNT="$(awk '{print $1}' <<< "${COUNTS}")"
RIGHT_COUNT="$(awk '{print $2}' <<< "${COUNTS}")"

echo "Commits únicos en ${DST_BRANCH}: ${LEFT_COUNT}"
echo "Commits únicos en ${SRC_BRANCH}: ${RIGHT_COUNT}"

echo
echo "-- Commits únicos (hasta 50) --"
git log --left-right --cherry-pick --oneline "${DST_BRANCH}...${SRC_BRANCH}" | head -n 50 || true

echo
echo "-- Archivos afectados --"
git diff --name-status "${DST_BRANCH}..${SRC_BRANCH}" || true

echo
echo "-- Resumen de cambios --"
git diff --stat "${DST_BRANCH}..${SRC_BRANCH}" || true

# 4) Respaldos inmutables
info "Creando respaldos"
git tag -f "${BACKUP_DST}" "${DST_BRANCH}"
git tag -f "${BACKUP_SRC}" "${SRC_BRANCH}"

echo "Backup ${DST_BRANCH}: ${BACKUP_DST}"
echo "Backup ${SRC_BRANCH}: ${BACKUP_SRC}"

# 5) Rama temporal de integración desde main
info "Creando rama temporal de integración"
git checkout -B "${TMP_BRANCH}" "${DST_BRANCH}"

# 6) Pre-merge revisable: deja el merge listo, pero sin commit
info "Ejecutando pre-merge revisable"
if git merge --no-ff --no-commit "${SRC_BRANCH}"; then
  echo
  echo "MERGE PREPARADO SIN COMMIT."
  echo
  echo "-- Estado --"
  git status --short

  echo
  echo "-- Resumen staged del merge preparado --"
  git diff --cached --stat

  cat <<EOF

Siguiente paso (revisión):
  1) Inspecciona cambios:
     git diff --cached
  2) Corre tus pruebas / build:
     npm install
     npm test
     npm start
  3) Si TODO está bien, consolida en ${DST_BRANCH} con:
     git commit -m "Merge branch '${SRC_BRANCH}' into ${DST_BRANCH}"
     git checkout ${DST_BRANCH}
     git merge --ff-only ${TMP_BRANCH}

Si NO te convence y quieres deshacer este pre-merge:
  git merge --abort
  git checkout ${DST_BRANCH}
  git branch -D ${TMP_BRANCH}

Respaldos creados:
  ${BACKUP_DST}
  ${BACKUP_SRC}

EOF
else
  echo
  echo "HAY CONFLICTOS. El pre-merge quedó abierto para revisión."
  echo
  echo "-- Archivos en conflicto --"
  git diff --name-only --diff-filter=U || true

  cat <<EOF

Opciones ahora:
  A) Resolver conflictos en esta rama temporal (${TMP_BRANCH}), luego:
     git add <archivos-resueltos>
     git commit -m "Merge branch '${SRC_BRANCH}' into ${DST_BRANCH}"
     git checkout ${DST_BRANCH}
     git merge --ff-only ${TMP_BRANCH}

  B) Abortar sin perder nada:
     git merge --abort
     git checkout ${DST_BRANCH}
     git branch -D ${TMP_BRANCH}

Respaldos creados:
  ${BACKUP_DST}
  ${BACKUP_SRC}

EOF
fi

# 7) Volver a la rama en la que estabas al empezar (si sigue existiendo y no estamos en medio del merge)
if git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1; then
  :
else
  if git show-ref --verify --quiet "refs/heads/${CURRENT_BRANCH}"; then
    git checkout "${CURRENT_BRANCH}" >/dev/null 2>&1 || true
  fi
fi

