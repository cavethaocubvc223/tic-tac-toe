# Makefile for Caro Online Game

# Variables
DOCKER_COMPOSE = docker-compose
DOCKER = docker
APP_NAME = caro-game
REDIS_NAME = redis

# Default target
.PHONY: help
help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development commands
.PHONY: dev
dev: ## Start development server with yarn
	yarn dev

.PHONY: start
start: ## Start production server
	yarn start

.PHONY: install
install: ## Install dependencies with yarn
	yarn install

# Docker commands
.PHONY: build
build: ## Build Docker image
	$(DOCKER_COMPOSE) build

.PHONY: up
up: ## Start services with docker-compose
	$(DOCKER_COMPOSE) up -d

.PHONY: down
down: ## Stop services
	$(DOCKER_COMPOSE) down

.PHONY: restart
restart: down up ## Restart services

.PHONY: logs
logs: ## View logs from all services
	$(DOCKER_COMPOSE) logs -f

.PHONY: logs-app
logs-app: ## View logs from app service only
	$(DOCKER_COMPOSE) logs -f caro-game

.PHONY: logs-redis
logs-redis: ## View logs from redis service only
	$(DOCKER_COMPOSE) logs -f redis

.PHONY: ps
ps: ## Show running containers
	$(DOCKER_COMPOSE) ps

.PHONY: shell
shell: ## Get shell access to app container
	$(DOCKER_COMPOSE) exec caro-game sh

.PHONY: redis-cli
redis-cli: ## Access Redis CLI
	$(DOCKER_COMPOSE) exec redis redis-cli

# Maintenance commands
.PHONY: clean
clean: ## Remove containers and images
	$(DOCKER_COMPOSE) down -v --rmi all

.PHONY: clean-volumes
clean-volumes: ## Remove all volumes (WARNING: data loss)
	$(DOCKER_COMPOSE) down -v

.PHONY: pull
pull: ## Pull latest images
	$(DOCKER_COMPOSE) pull

.PHONY: health
health: ## Check container health
	$(DOCKER) ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Production deployment
.PHONY: deploy
deploy: ## Deploy to production
	$(DOCKER_COMPOSE) -f docker-compose.yml up -d --build

.PHONY: prod-logs
prod-logs: ## View production logs
	$(DOCKER_COMPOSE) logs -f --tail=100

# Backup and restore
.PHONY: backup-redis
backup-redis: ## Backup Redis data
	$(DOCKER_COMPOSE) exec redis redis-cli SAVE
	$(DOCKER) cp $$($(DOCKER_COMPOSE) ps -q redis):/data/dump.rdb ./backup-$$(date +%Y%m%d_%H%M%S).rdb

.PHONY: test-connection
test-connection: ## Test Redis connection
	$(DOCKER_COMPOSE) exec redis redis-cli ping

.PHONY: monitor
monitor: ## Monitor resource usage
	$(DOCKER) stats $$($(DOCKER_COMPOSE) ps -q)

# Development helpers
.PHONY: format
format: ## Format code (if prettier is available)
	@if command -v prettier >/dev/null 2>&1; then \
		prettier --write "**/*.{js,json,md}"; \
	else \
		echo "Prettier not installed. Run: yarn add -D prettier"; \
	fi

.PHONY: check-env
check-env: ## Check if .env file exists
	@if [ ! -f .env ]; then \
		echo "⚠️  .env file not found. Create one based on .env.example"; \
		echo "Example .env content:"; \
		echo "PORT=3000"; \
		echo "REDIS_HOST=localhost"; \
		echo "REDIS_PORT=6379"; \
	else \
		echo "✅ .env file exists"; \
	fi
