#!/bin/sh
# Bootstrap placeholder TLS certificate.
#
# nginx refuses to start when ssl_certificate files are missing, but before
# the first Let's Encrypt issuance the certbot volume is empty. Install a
# throwaway self-signed placeholder (valid 1 day) so nginx can boot and serve
# the ACME webroot challenge on :80; the real certificate is issued into the
# same volume by `docker compose run --rm certbot certonly --webroot ...` and
# picked up on `nginx -s reload`.

set -eu

CERT_DIR=/etc/letsencrypt/live/fit.idone.co.il
FULLCHAIN="$CERT_DIR/fullchain.pem"

if [ ! -f "$FULLCHAIN" ]; then
  echo "bootstrap-certs: no certificate yet, generating placeholder..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout "$CERT_DIR/privkey.pem" \
    -out "$FULLCHAIN" \
    -subj "/CN=fit.idone.co.il" >/dev/null 2>&1
fi

exit 0
