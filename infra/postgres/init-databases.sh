#!/bin/sh
# Cria um banco e um usuário por microsserviço (isolamento de dados: nenhum
# serviço consegue acessar o banco de outro). Roda uma única vez, na primeira
# inicialização do volume do Postgres (docker-entrypoint-initdb.d).
#
# O schema dentro de cada banco é criado aqui; as TABELAS são criadas pelo
# TypeORM de cada serviço (synchronize fora de produção).
set -e

criar_banco() {
  nome="$1"      # auth | eligibility | scheduling | notification
  senha="$2"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres <<SQL
CREATE ROLE ${nome}_svc LOGIN PASSWORD '${senha}';
CREATE DATABASE ${nome}_db OWNER ${nome}_svc;
REVOKE ALL ON DATABASE ${nome}_db FROM PUBLIC;
SQL
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "${nome}_db" <<SQL
CREATE SCHEMA ${nome} AUTHORIZATION ${nome}_svc;
SQL
}

criar_banco auth "${AUTH_DB_PASSWORD:-auth_svc}"
criar_banco eligibility "${ELIGIBILITY_DB_PASSWORD:-eligibility_svc}"
criar_banco scheduling "${SCHEDULING_DB_PASSWORD:-scheduling_svc}"
criar_banco notification "${NOTIFICATION_DB_PASSWORD:-notification_svc}"
