# Build multi-estágio: compila o SPA React (Vite) e serve os arquivos
# estáticos resultantes via nginx. A URL do gateway é embutida no bundle em
# build time (Vite só expõe VITE_* no momento do build, não em runtime) -
# ver ARG/ENV VITE_API_URL abaixo, configurável pelo docker-compose.yml.

# Node 24: versão LTS com suporte ativo (o Node 20 saiu de suporte em abril de 2026).
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=http://localhost:3000
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:1.28-alpine AS runtime
# O mesmo endereço do gateway entra na Content-Security-Policy (connect-src): a imagem do nginx
# troca ${API_ORIGIN} no template de /etc/nginx/templates/ ao subir o container.
ARG VITE_API_URL=http://localhost:3000
ENV API_ORIGIN=${VITE_API_URL}
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
