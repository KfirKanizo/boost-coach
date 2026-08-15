# Tiny production reverse-proxy image: official nginx + our site config and a
# cert-bootstrap hook that lets nginx boot before the first ACME issuance.
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY bootstrap-certs.sh /usr/local/bin/bootstrap-certs.sh
RUN chmod +x /usr/local/bin/bootstrap-certs.sh

# Keep the official entrypoint (envsubst templates etc.); run the cert
# bootstrap before exec'ing nginx.
CMD ["/bin/sh", "-c", "/usr/local/bin/bootstrap-certs.sh && exec nginx -g 'daemon off;'"]
