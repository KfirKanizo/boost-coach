# Certbot with the Cloudflare DNS plugin for unattended DNS-01 issuance and
# renewal. Switch the compose `certbot` service from `image:` to `build: ./certbot`
# if the zone fit.idone.co.il is hosted on Cloudflare (see runbook "Phase 12.1").
# For other providers, swap the package for the matching certbot-dns-* plugin.
FROM certbot/certbot:latest
RUN pip install --no-cache-dir certbot-dns-cloudflare
