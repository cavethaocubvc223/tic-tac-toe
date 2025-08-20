# 🎯 Caro Online Game

Online Caro (Tic-tac-toe) game built with Express.js, Socket.IO, Redis and HTML/CSS/JavaScript. Allows 2 players to create rooms and play together in real-time.

## ✨ Features

- 👤 **User Management**: Create username and manage sessions with Redis
- 🏠 **Room List**: View and join available waiting rooms
- 📋 **Create/Join Rooms**: Create new rooms or join by room code
- ⏳ **Waiting Room**: Screen for waiting for the second player (no board display)
- 🎮 **Real-time Gameplay**: 15x15 Caro with real-time synchronization
- ⏱️ **Timer**: 30-second countdown per turn with visual effects
- 🎯 **Auto Turn**: Automatically switch turns when time runs out
- 📱 **Responsive**: Beautiful interface on all devices
- 🔄 **Play Again**: Play multiple rounds consecutively
- 💬 **Notifications**: Modern toast notification system
- 🎨 **UI/UX**: Dynamic interface with many animations
- 🚫 **Duplicate Prevention**: Redis-based duplicate username prevention
- 💾 **Persistent Rooms**: Rooms saved in Redis with TTL
- 🐳 **Docker Support**: Full containerization with Docker and docker-compose

## 🛠️ Installation

### System Requirements
- Node.js (version 18+)
- Yarn (version 1.22+)
- Redis (via Docker or local installation)
- Docker & Docker Compose (optional, for containerized deployment)

### Installation Steps

#### Option 1: Docker Deployment (Recommended)

1. **Clone the repository**:
```bash
git clone <repository-url>
cd caro-online-game
```

2. **Start with Docker Compose**:
```bash
# Start all services (Redis + App)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

3. **Access the game**:
Open browser and go to: `http://localhost:3000`

#### Option 2: Local Development

1. **Clone the repository**:
```bash
git clone <repository-url>
cd caro-online-game
```

2. **Start Redis** (using Docker):
```bash
docker-compose up -d redis
```

3. **Install dependencies**:
```bash
yarn install
```

4. **Create environment file**:
```bash
# Create .env file with:
PORT=3000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

5. **Start development server**:
```bash
yarn dev
```

Or for production:
```bash
yarn start
```

6. **Access the game**:
Open browser and go to: `http://localhost:3000`

## 🎮 How to Play

### New Game Flow:

**1. 📝 Enter Username**
- When first accessing the game, enter your name
- This name will be used throughout the gaming session
- Redis prevents duplicate usernames from being online simultaneously

**2. 🏠 Room List**
- View list of rooms waiting for players
- Create new room or join existing room
- Can join by room code

**3. ⏳ Waiting Room**
- Room creator waits in "Waiting Room" screen
- Game board only displays when there are 2 players
- Can copy room code to share

**4. 🎯 Play Game with Timer**
- Each turn has 30 seconds to make a move
- Visual countdown timer with effects
- Automatically switches turns when time runs out
- First player is ❌ (X), second player is ⭕ (O)
- Create 5 consecutive marks to win (horizontal/vertical/diagonal)

**5. 🏆 Game End**
- Can play again or return to room list
- Room automatically updates status

## 🐳 Docker Commands

### Quick Start
```bash
# Start everything
make up

# View logs
make logs

# Stop everything
make down

# Restart services
make restart
```

### Development
```bash
# Local development
make dev

# Install dependencies
make install

# Check environment
make check-env
```

### Maintenance
```bash
# View container status
make ps

# Get shell access
make shell

# Access Redis CLI
make redis-cli

# Monitor resources
make monitor

# Backup Redis data
make backup-redis
```

## 🏗️ Project Structure

```
tic-tac-toe/
├── server.js                      # Express + Socket.IO server
├── package.json                   # Dependencies and scripts
├── yarn.lock                      # Yarn lock file
├── Dockerfile                     # Multi-stage Docker build
├── docker-compose.yml             # Development services
├── docker-compose.prod.yml        # Production with Docker Hub image
├── Makefile                       # Docker and development commands
├── .dockerignore                  # Docker build exclusions
├── README.md                      # This documentation
├── .github/workflows/             # GitHub Actions CI/CD
│   └── docker-build.yml           # Docker Hub build & push
└── public/                        # Static files
    ├── index.html                 # Game interface
    ├── style.css                  # CSS styling
    └── client.js                  # JavaScript client
```

## 🔧 Socket.IO API

### Client to Server Events
- `userLogin`: User authentication with duplicate prevention
- `getRoomList`: Get list of available rooms
- `createRoom`: Create new room
- `joinRoom`: Join existing room
- `makeMove`: Make a move on the board
- `resetGame`: Restart the current game

### Server to Client Events
- `loginSuccess`: Successful user login
- `loginError`: Login failed (duplicate username, etc.)
- `roomListUpdated`: Updated list of available rooms
- `roomCreated`: Room successfully created
- `roomJoined`: Successfully joined room
- `playerJoined`: New player joined the room
- `playerLeft`: Player left the room
- `gameStart`: Game started with 2 players (includes timer)
- `moveMade`: Move was made on the board
- `gameReset`: Game has been reset
- `timerUpdate`: Timer countdown update (every second)
- `turnTimeout`: Turn timeout, automatically switch turns
- `error`: Error message

## 🎨 Technical Features

### Backend
- **Real-time Communication**: Socket.IO for instant game updates
- **Redis Integration**: Session management, room persistence, duplicate prevention
- **Room Management**: Dynamic room creation, joining, and cleanup
- **Game Logic**: Complete Caro game implementation with win detection
- **Timer System**: 30-second turn timer with automatic switching
- **Error Handling**: Comprehensive error handling and validation
- **Multi-stage Docker**: Optimized Docker build for production

### Frontend
- **Responsive Design**: Compatible with all devices
- **Modern UI/UX**: Beautiful interface with animations and effects
- **Real-time Updates**: Live game state synchronization
- **Toast Notifications**: Modern notification system
- **Multi-screen Flow**: Username → Room List → Waiting → Game
- **Timer Visualization**: Visual countdown with progress bars and color coding

### DevOps
- **Docker Support**: Full containerization with multi-stage builds
- **Docker Compose**: Redis + App services with health checks
- **Makefile**: Convenient development and deployment commands
- **Production Ready**: Environment variables, health checks, non-root user

## 🚀 Deployment

### Docker Production Deployment

#### Option 1: Using Docker Hub Image (Recommended)
```bash
# Use production compose with Docker Hub image
docker-compose -f docker-compose.prod.yml up -d

# Pull latest image and restart
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --force-recreate

# View production logs
docker-compose -f docker-compose.prod.yml logs -f tic-tac-toe-game
```

#### Option 2: Local Build
```bash
# Build and start production services locally
docker-compose up -d --build

# View logs
docker-compose logs -f caro-game
```

### VPS/Cloud Deployment
```bash
# On your server
git clone <your-repo-url>
cd caro-online-game

# Create production .env
cp .env.example .env
# Edit .env with your production values

# Start services
docker-compose -f docker-compose.yml up -d

# Setup reverse proxy (nginx example)
# Configure nginx to proxy to localhost:3000
```

### Heroku with Docker
```bash
# heroku.yml
build:
  docker:
    web: Dockerfile

# Deploy
heroku stack:set container
git push heroku main
```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
REDIS_HOST=redis-service-url
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password
TURN_TIME_LIMIT=30
ROOM_EXPIRY_TIME=3600
SESSION_EXPIRY=86400
```

## 🔄 CI/CD Pipeline

### GitHub Actions Setup

This project uses Docker Hub for image hosting with automated CI/CD:

#### Docker Build & Push (`docker-build.yml`)
- **Triggers**: Push to `main`, manual workflow dispatch
- **Features**:
  - Multi-arch Docker builds (amd64/arm64)
  - Docker Hub publishing as `chungdfly/tic-tac-toe:latest`
  - Security scanning with Trivy
  - Build caching for faster builds
  - Automatic cleanup to save disk space

### Setup CI/CD

1. **Required GitHub Secrets**:
   - `DOCKERHUB_USERNAME` - Your Docker Hub username (chungdfly)
   - `DOCKERHUB_TOKEN` - Docker Hub access token

2. **Create Docker Hub Access Token**:
   - Go to [Docker Hub Settings](https://hub.docker.com/settings/security)
   - Create new access token
   - Add to GitHub repository secrets

3. **Manual Trigger**:
   - Go to Actions tab in GitHub
   - Select "Build and Push Docker Image"
   - Click "Run workflow"

### Deployment Commands

```bash
# Production deployment with Docker Hub image
docker-compose -f docker-compose.prod.yml up -d

# Development deployment (local build)
make deploy

# Pull latest image and update production
docker-compose -f docker-compose.prod.yml pull tic-tac-toe-game
docker-compose -f docker-compose.prod.yml up -d --force-recreate tic-tac-toe-game

# Quick commands
make up                  # Start development environment
make down               # Stop all services
make logs               # View logs
make health             # Check container health
```

### Backup & Monitoring

```bash
# Backup commands
make backup              # Full production backup
make backup-staging      # Staging backup
make backup-dev         # Development Redis backup

# Manual backup
./scripts/backup.sh production full
./scripts/backup.sh staging redis-only

# Monitoring
make health             # Check container health
make monitor            # Resource usage monitoring
```

## 🐛 Recent Bug Fixes

### Game End Logic Fix (Critical)
**Problem**: Timer continued running after game ended, causing memory leaks and potential crashes.

**Root Cause**: 
- When a player won or game ended in draw, the turn timer wasn't properly cleared
- This led to timer events continuing to fire after game completion
- Redis wasn't updated with final game state

**Solution**:
```javascript
// Before (Buggy)
if (!result.winner && !result.draw) {
    room.game.startTurnTimer();
}

// After (Fixed)  
if (result.winner || result.draw) {
    // Game ended - clear timer and update Redis
    room.game.clearTimer();
    await saveRoomToRedis(roomId, roomData);
} else {
    // Game continues - restart timer
    room.game.startTurnTimer();
}
```

**Impact**: 
- ✅ Fixed memory leaks from uncleaned timers
- ✅ Proper game state persistence in Redis  
- ✅ Improved game end experience
- ✅ Better resource management

### Enhanced Game Reset
- Improved reset logic with proper Redis updates
- Better UI state management during reset
- Automatic game restart when 2 players are present

## 📝 License

MIT License - Free to use for personal and commercial purposes.

## 🤝 Contributing

All contributions are welcome! Please create issues or pull requests.

### Development Setup
```bash
# Clone and setup
git clone <repo-url>
cd caro-online-game
yarn install

# Start Redis
docker-compose up -d redis

# Start development server
yarn dev

# Or use Makefile
make dev
```

---

**Happy Gaming! 🎉🎮**

Built with ❤️ using Node.js, Express, Socket.IO, Redis, and Docker.
