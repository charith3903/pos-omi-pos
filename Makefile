.PHONY: infra-up infra-down infra-reset install dev build test migrate lint format help

## Start Postgres + Redis
infra-up:
	docker compose up -d

## Stop infrastructure containers
infra-down:
	docker compose down

## Destroy containers + volumes (wipes DB data)
infra-reset:
	docker compose down -v

## Install all workspace dependencies
install:
	npm install

## Build shared types package
types:
	npm run build -w packages/types

## Generate Prisma client (run after schema changes)
db-generate:
	npm run db:generate -w apps/api

## Run Prisma migrations in dev mode
migrate: infra-up
	npm run migrate -w apps/api

## Start API + Dashboard dev servers (infra must be up first)
dev: infra-up
	npm run dev

## Build all apps
build: types
	npm run build

## Run tests
test:
	npm run test

## Lint all TypeScript workspaces
lint:
	npm run lint

## Format with Prettier
format:
	npm run format

## Full local setup from scratch
setup: install types db-generate migrate
	@echo "\n✅ OmniPOS ready. Run: make dev"

help:
	@grep -E '^## ' Makefile | sed 's/## //'
