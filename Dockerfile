# Dashboard statique servi par nginx, derrière le Caddy partagé du VPS.
# Construit et déployé par GitHub Actions à chaque push sur main (cf. .github/workflows/deploy.yml).
FROM nginx:alpine

# Seuls les assets nécessaires au runtime (app.js lit window.MPP_DATA depuis data.js,
# aucune requête réseau vers les CSV — ceux-ci ne servent qu'au build local).
COPY index.html app.js data.js styles.css /usr/share/nginx/html/
COPY vendor/ /usr/share/nginx/html/vendor/
