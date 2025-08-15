FROM node:24-alpine3.21 AS development

# Install git
RUN apk add git

# Install ngrok
# from (https://github.com/shkoliar/docker-ngrok/blob/913a0d66ca542836f6452adfa61e755e50470873/Dockerfile)
RUN apk add --no-cache --virtual .bootstrap-deps ca-certificates && \
  wget -O /tmp/ngrok.tgz https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz && \
  tar -xvzf /tmp/ngrok.tgz -C / && \
  # wget -O /tmp/ngrok.zip https://bin.equinox.io/c/4VmDzA7iaHb/ngrok-stable-linux-amd64.zip && \
  # unzip -o /tmp/ngrok.tgz -d / && \
  apk del .bootstrap-deps && \
  rm -rf /tmp/* && \
  rm -rf /var/cache/apk/* && \
  ln -s /ngrok /bin/ngrok

FROM development AS production

USER root

COPY . .

RUN npm install

EXPOSE 8080

RUN chmod +x entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]