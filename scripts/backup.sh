#!/bin/bash

# Caro Game Backup Script
# Usage: ./scripts/backup.sh [environment] [backup-type]
# Examples:
#   ./scripts/backup.sh production full
#   ./scripts/backup.sh staging redis-only

set -e

ENVIRONMENT=${1:-production}
BACKUP_TYPE=${2:-redis-only}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="./backups"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Create backup directory
mkdir -p $BACKUP_DIR

echo "🗄️ Starting backup for $ENVIRONMENT environment..."
echo "Backup type: $BACKUP_TYPE"
echo "Timestamp: $TIMESTAMP"

# Determine container names based on environment
case $ENVIRONMENT in
    "production"|"prod")
        REDIS_CONTAINER="caro_redis_prod"
        APP_CONTAINER="caro_game_prod"
        COMPOSE_FILE="docker-compose.prod.yml"
        ;;
    "staging")
        REDIS_CONTAINER="caro_redis_staging"
        APP_CONTAINER="caro_game_staging"
        COMPOSE_FILE="docker-compose.staging.yml"
        ;;
    "development"|"dev")
        REDIS_CONTAINER="caro_redis"
        APP_CONTAINER="caro_game"
        COMPOSE_FILE="docker-compose.yml"
        ;;
    *)
        print_error "Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

# Check if containers are running
if ! docker ps | grep -q $REDIS_CONTAINER; then
    print_error "Redis container $REDIS_CONTAINER is not running"
    exit 1
fi

# Backup Redis data
backup_redis() {
    print_status "Backing up Redis data..."
    
    # Create Redis snapshot
    docker exec $REDIS_CONTAINER redis-cli SAVE
    
    # Copy the dump file
    docker cp $REDIS_CONTAINER:/data/dump.rdb $BACKUP_DIR/redis_${ENVIRONMENT}_${TIMESTAMP}.rdb
    
    # Create a JSON export as well
    docker exec $REDIS_CONTAINER redis-cli --rdb /tmp/backup.rdb >/dev/null 2>&1 || true
    docker cp $REDIS_CONTAINER:/data/dump.rdb $BACKUP_DIR/redis_${ENVIRONMENT}_${TIMESTAMP}.rdb
    
    print_status "Redis backup completed: redis_${ENVIRONMENT}_${TIMESTAMP}.rdb"
}

# Backup application logs
backup_logs() {
    print_status "Backing up application logs..."
    
    # Get container logs
    docker logs $APP_CONTAINER > $BACKUP_DIR/app_logs_${ENVIRONMENT}_${TIMESTAMP}.log 2>&1
    docker logs $REDIS_CONTAINER > $BACKUP_DIR/redis_logs_${ENVIRONMENT}_${TIMESTAMP}.log 2>&1
    
    print_status "Logs backup completed"
}

# Backup configuration files
backup_config() {
    print_status "Backing up configuration files..."
    
    BACKUP_CONFIG_DIR="$BACKUP_DIR/config_${ENVIRONMENT}_${TIMESTAMP}"
    mkdir -p $BACKUP_CONFIG_DIR
    
    # Copy important config files
    cp docker-compose*.yml $BACKUP_CONFIG_DIR/ || true
    cp Dockerfile $BACKUP_CONFIG_DIR/ || true
    cp package.json $BACKUP_CONFIG_DIR/ || true
    cp yarn.lock $BACKUP_CONFIG_DIR/ || true
    cp .env.example $BACKUP_CONFIG_DIR/ || true
    
    # Copy environment file (without secrets)
    if [[ -f ".env" ]]; then
        grep -v "PASSWORD\|SECRET\|KEY" .env > $BACKUP_CONFIG_DIR/env_sanitized || true
    fi
    
    # Create archive
    tar -czf $BACKUP_DIR/config_${ENVIRONMENT}_${TIMESTAMP}.tar.gz -C $BACKUP_DIR config_${ENVIRONMENT}_${TIMESTAMP}
    rm -rf $BACKUP_CONFIG_DIR
    
    print_status "Configuration backup completed"
}

# Full system backup
backup_full() {
    print_status "Performing full system backup..."
    
    backup_redis
    backup_logs  
    backup_config
    
    # Create combined archive
    FULL_BACKUP_NAME="full_backup_${ENVIRONMENT}_${TIMESTAMP}.tar.gz"
    tar -czf $BACKUP_DIR/$FULL_BACKUP_NAME -C $BACKUP_DIR \
        redis_${ENVIRONMENT}_${TIMESTAMP}.rdb \
        app_logs_${ENVIRONMENT}_${TIMESTAMP}.log \
        redis_logs_${ENVIRONMENT}_${TIMESTAMP}.log \
        config_${ENVIRONMENT}_${TIMESTAMP}.tar.gz
    
    print_status "Full backup completed: $FULL_BACKUP_NAME"
}

# Execute backup based on type
case $BACKUP_TYPE in
    "redis-only"|"redis")
        backup_redis
        ;;
    "logs-only"|"logs")
        backup_logs
        ;;
    "config-only"|"config")
        backup_config
        ;;
    "full")
        backup_full
        ;;
    *)
        print_error "Unknown backup type: $BACKUP_TYPE"
        echo "Supported types: redis-only, logs-only, config-only, full"
        exit 1
        ;;
esac

# Cleanup old backups (keep last 7 days)
print_status "Cleaning up old backups..."
find $BACKUP_DIR -name "*_${ENVIRONMENT}_*.rdb" -mtime +7 -delete || true
find $BACKUP_DIR -name "*_${ENVIRONMENT}_*.log" -mtime +7 -delete || true
find $BACKUP_DIR -name "*_${ENVIRONMENT}_*.tar.gz" -mtime +7 -delete || true

# Show backup summary
echo ""
echo "📊 Backup Summary:"
echo "Environment: $ENVIRONMENT"
echo "Type: $BACKUP_TYPE"
echo "Location: $BACKUP_DIR"
echo ""

ls -lh $BACKUP_DIR/*${ENVIRONMENT}_${TIMESTAMP}* 2>/dev/null || true

echo ""
print_status "Backup completed successfully! 🎉"

# Optional: Upload to cloud storage
if [[ -n "$S3_BACKUP_BUCKET" ]] && command -v aws >/dev/null 2>&1; then
    print_status "Uploading to S3..."
    aws s3 sync $BACKUP_DIR s3://$S3_BACKUP_BUCKET/caro-backups/ --exclude "*" --include "*${ENVIRONMENT}_${TIMESTAMP}*"
    print_status "S3 upload completed"
fi
