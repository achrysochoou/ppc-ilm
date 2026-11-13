FROM node:24.11.1-alpine
WORKDIR /app
COPY package.json ./
COPY ilm ./ilm
RUN mkdir /app/runtime && chown node:node /app/runtime
USER node
ENV ILM_HOST=0.0.0.0
EXPOSE 8000
CMD ["node", "ilm/server.js"]
