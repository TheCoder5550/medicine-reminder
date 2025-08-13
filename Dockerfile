FROM node:24-alpine3.21 AS development

RUN apk add git

FROM development AS production

USER root

COPY . .

RUN npm install

EXPOSE 8080

RUN chmod +x entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]