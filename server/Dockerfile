FROM node:20-alpine

WORKDIR /app

COPY server/package.json ./package.json
RUN npm install --omit=dev

COPY server/src ./src
COPY db ../db

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
