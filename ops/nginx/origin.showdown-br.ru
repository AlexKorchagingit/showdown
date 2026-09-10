# Isolated same-origin frontend/API canary.
#
# The SPA and every Supabase protocol share one public origin. This removes
# browser CORS preflights and all frontend-side endpoint racing from the canary.

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name origin.showdown-br.ru;

    access_log /var/log/nginx/showdown-origin-canary.access.log showdown_safe;
    root /var/www/showdown-origin-canary/current;
    index index.html;
    client_max_body_size 50m;

    add_header Alt-Svc "clear" always;

    location = /__health {
        default_type text/plain;
        return 200 "ok\n";
    }

    location ~ ^/(?:auth|rest|realtime|storage|functions|graphql)/v1(?:/|$) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 3600s;
        proxy_buffering off;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate" always;
        add_header Alt-Svc "clear" always;
        try_files $uri =404;
    }

    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Alt-Svc "clear" always;
        try_files $uri =404;
    }

    location / {
        add_header Cache-Control "no-cache, must-revalidate" always;
        add_header Alt-Svc "clear" always;
        try_files $uri /index.html;
    }

    location ~ /\. {
        deny all;
    }

    ssl_certificate /etc/letsencrypt/live/origin.showdown-br.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/origin.showdown-br.ru/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

server {
    listen 80;
    listen [::]:80;
    server_name origin.showdown-br.ru;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
