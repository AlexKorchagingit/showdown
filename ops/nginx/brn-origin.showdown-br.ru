# Isolated Bryansk frontend/API clone.
#
# TLS is expected to terminate on the external gateway. This server receives
# only private-network HTTP and keeps the SPA and every Supabase protocol on
# one browser origin.

map $http_upgrade $showdown_brn_connection {
    default upgrade;
    ''      close;
}

map $http_x_forwarded_proto $showdown_brn_proto {
    default $http_x_forwarded_proto;
    ''      $scheme;
}

server {
    listen 80;
    server_name brn-origin.showdown-br.ru showdown-br.ru www.showdown-br.ru 10.102.2.22;

    access_log /var/log/nginx/showdown-brn.access.log;
    error_log /var/log/nginx/showdown-brn.error.log warn;
    root /var/www/showdown-brn/current;
    index index.html;
    client_max_body_size 50m;

    location = /__health {
        default_type text/plain;
        add_header Cache-Control "no-store" always;
        return 200 "ok\n";
    }

    location ~ ^/(?:auth|rest|realtime|storage|functions|graphql)/v1(?:/|$) {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $showdown_brn_proto;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $showdown_brn_connection;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 3600s;
        proxy_buffering off;
    }

    location = /index.html {
        add_header Cache-Control "no-cache, must-revalidate" always;
        try_files $uri =404;
    }

    location ^~ /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        try_files $uri =404;
    }

    location / {
        add_header Cache-Control "no-cache, must-revalidate" always;
        try_files $uri /index.html;
    }

    location ~ /\. {
        deny all;
    }
}
