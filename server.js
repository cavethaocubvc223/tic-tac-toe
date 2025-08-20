const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
const { createClient } = require('redis');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files từ thư mục public
app.use(express.static(path.join(__dirname, 'public')));

// Redis Client Configuration
const redisClient = createClient({
    url: `redis://${process.env.REDIS_PASSWORD ? `:${process.env.REDIS_PASSWORD}@` : ''}${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}/${process.env.REDIS_DB || 0}`,
    socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
    },
    legacyMode: false
});

// Redis connection events
redisClient.on('connect', () => {
    console.log('📦 Redis connected successfully');
});

redisClient.on('error', (err) => {
    console.error('❌ Redis connection error:', err);
});

redisClient.on('ready', () => {
    console.log('✅ Redis client ready');
});

// Connect to Redis and clear all data on startup
redisClient.connect().then(async () => {
    try {
        // Clear all game-related data from Redis on server start
        console.log('🧹 Clearing all Redis data...');
        
        // Get all keys with game prefix
        const keys = await redisClient.keys('game:*');
        if (keys.length > 0) {
            await redisClient.del(keys);
            console.log(`🗑️ Cleared ${keys.length} Redis keys`);
        } else {
            console.log('✅ No Redis keys to clear');
        }
        
        console.log('🚀 Redis cleared and ready for new game data');
    } catch (error) {
        console.error('❌ Error clearing Redis data:', error);
    }
}).catch(console.error);

// Redis Keys
const REDIS_KEYS = {
    ONLINE_USERS: 'game:online_users',
    USER_SESSIONS: 'game:user_sessions:',
    ROOMS: 'game:rooms:',
    ROOM_LIST: 'game:room_list',
    USER_ROOM: 'game:user_room:'
};

// Store room information (fallback for Redis)
const rooms = new Map();

// Redis Utility Functions

// User Management
async function isUserOnline(username) {
    try {
        const exists = await redisClient.sIsMember(REDIS_KEYS.ONLINE_USERS, username);
        return exists;
    } catch (error) {
        console.error('Error checking user online status:', error);
        return false;
    }
}

async function addUserOnline(username, socketId) {
    try {
        await redisClient.multi()
            .sAdd(REDIS_KEYS.ONLINE_USERS, username)
            .hSet(REDIS_KEYS.USER_SESSIONS + username, 'socketId', socketId, 'timestamp', Date.now())
            .expire(REDIS_KEYS.USER_SESSIONS + username, process.env.SESSION_EXPIRY || 86400)
            .exec();
        console.log(`✅ User ${username} added to online users`);
        return true;
    } catch (error) {
        console.error('Error adding user online:', error);
        return false;
    }
}

async function removeUserOnline(username) {
    try {
        await redisClient.multi()
            .sRem(REDIS_KEYS.ONLINE_USERS, username)
            .del(REDIS_KEYS.USER_SESSIONS + username)
            .del(REDIS_KEYS.USER_ROOM + username)
            .exec();
        console.log(`🚪 User ${username} removed from online users`);
        return true;
    } catch (error) {
        console.error('Error removing user online:', error);
        return false;
    }
}

async function getUserSocketId(username) {
    try {
        const socketId = await redisClient.hGet(REDIS_KEYS.USER_SESSIONS + username, 'socketId');
        return socketId;
    } catch (error) {
        console.error('Error getting user socket ID:', error);
        return null;
    }
}

// Room Management
async function saveRoomToRedis(roomId, roomData) {
    try {
        await redisClient.multi()
            .hSet(REDIS_KEYS.ROOMS + roomId, 'data', JSON.stringify(roomData))
            .sAdd(REDIS_KEYS.ROOM_LIST, roomId)
            .expire(REDIS_KEYS.ROOMS + roomId, process.env.ROOM_EXPIRY_TIME || 3600)
            .exec();
        
        // Save user-room mapping
        for (const player of roomData.players) {
            await redisClient.set(REDIS_KEYS.USER_ROOM + player.name, roomId, {
                EX: process.env.ROOM_EXPIRY_TIME || 3600
            });
        }
        
        console.log(`💾 Room ${roomId} saved to Redis`);
        return true;
    } catch (error) {
        console.error('Error saving room to Redis:', error);
        return false;
    }
}

async function getRoomFromRedis(roomId) {
    try {
        const roomDataStr = await redisClient.hGet(REDIS_KEYS.ROOMS + roomId, 'data');
        if (roomDataStr) {
            return JSON.parse(roomDataStr);
        }
        return null;
    } catch (error) {
        console.error('Error getting room from Redis:', error);
        return null;
    }
}

async function removeRoomFromRedis(roomId) {
    try {
        const roomData = await getRoomFromRedis(roomId);
        if (roomData && roomData.players) {
            // Remove user-room mappings
            for (const player of roomData.players) {
                await redisClient.del(REDIS_KEYS.USER_ROOM + player.name);
            }
        }
        
        await redisClient.multi()
            .del(REDIS_KEYS.ROOMS + roomId)
            .sRem(REDIS_KEYS.ROOM_LIST, roomId)
            .exec();
        
        console.log(`🗑️ Room ${roomId} removed from Redis`);
        return true;
    } catch (error) {
        console.error('Error removing room from Redis:', error);
        return false;
    }
}

async function getRoomListFromRedis() {
    try {
        const roomIds = await redisClient.sMembers(REDIS_KEYS.ROOM_LIST);
        const rooms = [];
        
        for (const roomId of roomIds) {
            const roomDataStr = await redisClient.hGet(REDIS_KEYS.ROOMS + roomId, 'data');
            if (roomDataStr) {
                const roomData = JSON.parse(roomDataStr);
                rooms.push({
                    id: roomId,
                    playerCount: roomData.players ? roomData.players.length : 0,
                    maxPlayers: 2,
                    players: roomData.players ? roomData.players.map(p => p.name) : [],
                    status: roomData.players && roomData.players.length < 2 ? 'waiting' : 'full',
                    gameStarted: roomData.gameStarted || false
                });
            }
        }
        
        return rooms.filter(room => room.status === 'waiting');
    } catch (error) {
        console.error('Error getting room list from Redis:', error);
        return [];
    }
}

async function getUserCurrentRoom(username) {
    try {
        const roomId = await redisClient.get(REDIS_KEYS.USER_ROOM + username);
        return roomId;
    } catch (error) {
        console.error('Error getting user current room:', error);
        return null;
    }
}

// Helper function để get room list (legacy support + Redis)
async function getRoomListForBroadcast() {
    const redisRooms = await getRoomListFromRedis();
    const memoryRooms = Array.from(rooms.values()).map(room => ({
        id: room.id,
        playerCount: room.game.players.length,
        maxPlayers: 2,
        players: room.game.players.map(p => p.name),
        status: room.game.players.length < 2 ? 'waiting' : 'full',
        gameStarted: room.game.gameStarted
    }));
    
    // Combine and deduplicate
    const allRooms = [...redisRooms];
    for (const memRoom of memoryRooms) {
        if (!allRooms.find(r => r.id === memRoom.id)) {
            allRooms.push(memRoom);
        }
    }
    
    return allRooms.filter(room => room.status === 'waiting');
}

// Game logic
class CaroGame {
    constructor() {
        this.board = Array(15).fill().map(() => Array(15).fill(null));
        this.currentPlayer = 'X';
        this.players = [];
        this.gameEnded = false;
        this.winner = null;
        this.gameStarted = false;
        this.turnTimer = null;
        this.turnTimeLeft = 30; // 30 seconds per turn
        this.turnStartTime = null;
    }

    addPlayer(playerId, playerName) {
        if (this.players.length < 2) {
            const symbol = this.players.length === 0 ? 'X' : 'O';
            this.players.push({ id: playerId, name: playerName, symbol });
            return true;
        }
        return false;
    }

    removePlayer(playerId) {
        this.players = this.players.filter(p => p.id !== playerId);
    }

    makeMove(playerId, row, col) {
        // Check turn
        const player = this.players.find(p => p.id === playerId);
        if (!player || player.symbol !== this.currentPlayer || this.gameEnded) {
            return { success: false, message: 'Not your turn or game has ended' };
        }

        // Check empty cell
        if (this.board[row][col] !== null) {
            return { success: false, message: 'This cell has already been taken' };
        }

        // Make move
        this.board[row][col] = player.symbol;

        // Check win
        if (this.checkWin(row, col, player.symbol)) {
            this.gameEnded = true;
            this.winner = player;
            return { success: true, winner: player, board: this.board };
        }

        // Check draw
        if (this.isBoardFull()) {
            this.gameEnded = true;
            return { success: true, draw: true, board: this.board };
        }

        // Switch turn
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';
        
        return { success: true, board: this.board, currentPlayer: this.currentPlayer };
    }

    checkWin(row, col, symbol) {
        const directions = [
            [0, 1],   // horizontal
            [1, 0],   // vertical
            [1, 1],   // main diagonal
            [1, -1]   // anti-diagonal
        ];

        for (let [dx, dy] of directions) {
            let count = 1;
            
            // Check one direction
            let r = row + dx, c = col + dy;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === symbol) {
                count++;
                r += dx;
                c += dy;
            }
            
            // Check opposite direction
            r = row - dx;
            c = col - dy;
            while (r >= 0 && r < 15 && c >= 0 && c < 15 && this.board[r][c] === symbol) {
                count++;
                r -= dx;
                c -= dy;
            }
            
            if (count >= 5) {
                return true;
            }
        }
        
        return false;
    }

    isBoardFull() {
        return this.board.every(row => row.every(cell => cell !== null));
    }

    reset() {
        this.board = Array(15).fill().map(() => Array(15).fill(null));
        this.currentPlayer = 'X';
        this.gameEnded = false;
        this.winner = null;
        this.gameStarted = false;
        this.clearTimer();
        this.turnTimeLeft = 30;
        this.turnStartTime = null;
    }

    startGame() {
        this.gameStarted = true;
        this.startTurnTimer();
    }

    startTurnTimer() {
        this.clearTimer();
        this.turnTimeLeft = 30;
        this.turnStartTime = Date.now();
        
        this.turnTimer = setInterval(() => {
            this.turnTimeLeft--;
            if (this.turnTimeLeft <= 0) {
                this.timeOut();
            }
        }, 1000);
    }

    clearTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }

    timeOut() {
        this.clearTimer();
        
        // Find the current player who timed out
        const timedOutPlayer = this.players.find(p => p.symbol === this.currentPlayer);
        const winnerPlayer = this.players.find(p => p.symbol !== this.currentPlayer);
        
        // Game ends - the player who timed out loses
        this.gameEnded = true;
        this.winner = winnerPlayer;
        
        return {
            timeOut: true,
            gameEnded: true,
            winner: winnerPlayer,
            timedOutPlayer: timedOutPlayer,
            message: `${timedOutPlayer ? timedOutPlayer.name : 'Player'} ran out of time and lost the game!`
        };
    }

    getTurnTimeLeft() {
        if (!this.gameStarted || this.gameEnded) return 0;
        const elapsed = Math.floor((Date.now() - this.turnStartTime) / 1000);
        return Math.max(0, 30 - elapsed);
    }
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    let currentUsername = null;

    // Check user login and prevent duplicate
    socket.on('userLogin', async (data) => {
        const { username } = data;
        
        if (!username || username.trim() === '') {
            socket.emit('loginError', { message: 'Invalid username' });
            return;
        }

        // Check if user is already online
        const isOnline = await isUserOnline(username);
        if (isOnline) {
            socket.emit('loginError', { message: 'This username is already taken. Please choose another name!' });
            return;
        }

        // Check if user is in a room
        const currentRoom = await getUserCurrentRoom(username);
        if (currentRoom) {
            // User was in a room, clean up
            await removeRoomFromRedis(currentRoom);
        }

        // Add user to online users
        const success = await addUserOnline(username, socket.id);
        if (success) {
            currentUsername = username;
            socket.username = username;
            socket.emit('loginSuccess', { username });
            console.log(`👤 User ${username} logged in with socket ${socket.id}`);
        } else {
            socket.emit('loginError', { message: 'System error. Please try again!' });
        }
    });

    // Get room list
    socket.on('getRoomList', async () => {
        const roomList = await getRoomListForBroadcast();
        socket.emit('roomListUpdated', roomList);
    });

    // Create new room
    socket.on('createRoom', async (data) => {
        if (!currentUsername) {
            socket.emit('error', { message: 'You need to login before creating a room' });
            return;
        }

        // Check if user is already in a room
        const existingRoom = await getUserCurrentRoom(currentUsername);
        if (existingRoom) {
            socket.emit('error', { message: 'You are already in another room' });
            return;
        }

        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const game = new CaroGame();
        
        // Add to memory (for game logic)
        rooms.set(roomId, {
            id: roomId,
            game: game,
            sockets: new Set()
        });

        socket.join(roomId);
        socket.roomId = roomId;
        rooms.get(roomId).sockets.add(socket.id);

        // Add player to game
        if (game.addPlayer(socket.id, currentUsername)) {
            // Save to Redis
            const roomData = {
                id: roomId,
                players: game.players,
                board: game.board,
                currentPlayer: game.currentPlayer,
                gameStarted: game.gameStarted,
                createdAt: Date.now()
            };
            await saveRoomToRedis(roomId, roomData);

            socket.emit('roomCreated', { 
                roomId, 
                players: game.players,
                board: game.board,
                currentPlayer: game.currentPlayer,
                gameStarted: game.gameStarted
            });

            // Broadcast room list update
            const roomList = await getRoomListForBroadcast();
            io.emit('roomListUpdated', roomList);
        }
    });

    // Join room
    socket.on('joinRoom', async (data) => {
        const { roomId } = data;
        
        if (!currentUsername) {
            socket.emit('error', { message: 'You need to login before joining a room' });
            return;
        }

        // Check if user is already in a room
        const existingRoom = await getUserCurrentRoom(currentUsername);
        if (existingRoom && existingRoom !== roomId) {
            socket.emit('error', { message: 'You are already in another room' });
            return;
        }

        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room does not exist' });
            return;
        }

        if (room.game.players.length >= 2) {
            socket.emit('error', { message: 'Room is full' });
            return;
        }

        // Check if user already in this room
        const userInRoom = room.game.players.find(p => p.name === currentUsername);
        if (userInRoom) {
            socket.emit('error', { message: 'You are already in this room' });
            return;
        }

        socket.join(roomId);
        socket.roomId = roomId;
        room.sockets.add(socket.id);

        if (room.game.addPlayer(socket.id, currentUsername)) {
            // Update Redis
            const roomData = {
                id: roomId,
                players: room.game.players,
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                gameStarted: room.game.gameStarted,
                updatedAt: Date.now()
            };
            await saveRoomToRedis(roomId, roomData);

            socket.emit('roomJoined', { 
                roomId, 
                players: room.game.players,
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                gameStarted: room.game.gameStarted
            });

            socket.to(roomId).emit('playerJoined', { players: room.game.players });

            // Send chat notification
            io.to(roomId).emit('chatMessage', {
                sender: 'System',
                message: `${currentUsername} joined the room`,
                timestamp: Date.now(),
                isSystem: true
            });

            // If 2 players ready, start game
            if (room.game.players.length === 2) {
                room.game.startGame();
                
                // Update room status in Redis
                roomData.gameStarted = true;
                await saveRoomToRedis(roomId, roomData);
                
                io.to(roomId).emit('gameStart', { 
                    players: room.game.players,
                    currentPlayer: room.game.currentPlayer,
                    turnTimeLeft: room.game.turnTimeLeft
                });

                // Send game start notification to chat
                io.to(roomId).emit('chatMessage', {
                    sender: 'System',
                    message: `🎮 Game started! Have fun playing!`,
                    timestamp: Date.now(),
                    isSystem: true
                });
                
                // Start timer broadcast
                const timerInterval = setInterval(async () => {
                    if (room.game.gameEnded || room.game.players.length < 2) {
                        clearInterval(timerInterval);
                        return;
                    }
                    
                    const timeLeft = room.game.getTurnTimeLeft();
                    io.to(roomId).emit('timerUpdate', { 
                        timeLeft: timeLeft,
                        currentPlayer: room.game.currentPlayer
                    });
                    
                    if (timeLeft <= 0) {
                        const timeoutResult = room.game.timeOut();
                        
                        // Update room status in Redis
                        const roomData = {
                            id: roomId,
                            players: room.game.players,
                            board: room.game.board,
                            currentPlayer: room.game.currentPlayer,
                            gameStarted: room.game.gameStarted,
                            gameEnded: room.game.gameEnded,
                            winner: timeoutResult.winner,
                            updatedAt: Date.now()
                        };
                        await saveRoomToRedis(roomId, roomData);
                        
                        // Emit timeout result with game end
                        io.to(roomId).emit('turnTimeout', timeoutResult);
                        
                        // Send chat message about timeout
                        io.to(roomId).emit('chatMessage', {
                            sender: 'System',
                            message: `⏰ ${timeoutResult.timedOutPlayer.name} ran out of time and lost! ${timeoutResult.winner.name} wins!`,
                            timestamp: Date.now(),
                            isSystem: true
                        });
                        
                        // Disconnect the timed out player after a short delay
                        setTimeout(async () => {
                            const timedOutSocketId = await getUserSocketId(timeoutResult.timedOutPlayer.name);
                            if (timedOutSocketId) {
                                const timedOutSocket = io.sockets.sockets.get(timedOutSocketId);
                                if (timedOutSocket) {
                                    timedOutSocket.emit('error', { 
                                        message: 'You have been disconnected due to timeout.',
                                        disconnect: true 
                                    });
                                    timedOutSocket.disconnect(true);
                                }
                            }
                        }, 3000); // 3 second delay to show result
                        
                        clearInterval(timerInterval);
                    }
                }, 1000);
            }

            // Broadcast room list update
            const roomList = await getRoomListForBroadcast();
            io.emit('roomListUpdated', roomList);
        }
    });

    // Make move
    socket.on('makeMove', async (data) => {
        const { row, col } = data;
        const roomId = socket.roomId;
        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('error', { message: 'Room does not exist' });
            return;
        }

        const result = room.game.makeMove(socket.id, row, col);
        
        if (result.success) {
            // Handle timer based on game result
            if (result.winner || result.draw) {
                // Game ended - clear timer and update Redis
                room.game.clearTimer();
                console.log(`🏆 Game ended in room ${roomId}: ${result.winner ? `Winner: ${result.winner.name}` : 'Draw'}`);
                
                // Update room status in Redis
                const roomData = {
                    id: roomId,
                    players: room.game.players,
                    board: room.game.board,
                    currentPlayer: room.game.currentPlayer,
                    gameStarted: room.game.gameStarted,
                    gameEnded: true,
                    winner: result.winner,
                    updatedAt: Date.now()
                };
                await saveRoomToRedis(roomId, roomData);
            } else {
                // Game continues - restart timer for next turn
                room.game.startTurnTimer();
            }
            
            io.to(roomId).emit('moveMade', {
                row,
                col,
                symbol: room.game.players.find(p => p.id === socket.id).symbol,
                board: result.board,
                currentPlayer: result.currentPlayer,
                winner: result.winner,
                draw: result.draw,
                turnTimeLeft: room.game.turnTimeLeft,
                gameEnded: room.game.gameEnded
            });
        } else {
            socket.emit('error', { message: result.message });
        }
    });

    // Chat message
    socket.on('chatMessage', (data) => {
        const { roomId, message, sender } = data;
        
        if (!roomId || !message || !sender) {
            socket.emit('error', { message: 'Invalid chat message data' });
            return;
        }
        
        if (message.length > 200) {
            socket.emit('error', { message: 'Message too long (max 200 characters)' });
            return;
        }
        
        // Verify user is in the room
        if (socket.roomId !== roomId) {
            socket.emit('error', { message: 'You are not in this room' });
            return;
        }
        
        // Verify sender is current user
        if (currentUsername !== sender) {
            socket.emit('error', { message: 'Invalid sender' });
            return;
        }
        
        // Broadcast message to all users in the room
        const sanitizedMessage = message.replace(/[<>]/g, ''); // Basic XSS protection
        io.to(roomId).emit('chatMessage', {
            sender: sender,
            message: sanitizedMessage,
            timestamp: Date.now()
        });
        
        console.log(`💬 Chat in room ${roomId} - ${sender}: ${sanitizedMessage}`);
    });

    // Reset game
    socket.on('resetGame', async () => {
        const roomId = socket.roomId;
        const room = rooms.get(roomId);

        if (room) {
            room.game.reset();
            console.log(`🔄 Game reset in room ${roomId}`);
            
            // Update room status in Redis
            const roomData = {
                id: roomId,
                players: room.game.players,
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                gameStarted: room.game.gameStarted,
                gameEnded: false,
                winner: null,
                updatedAt: Date.now()
            };
            await saveRoomToRedis(roomId, roomData);
            
            io.to(roomId).emit('gameReset', { 
                board: room.game.board,
                currentPlayer: room.game.currentPlayer,
                players: room.game.players,
                gameStarted: room.game.gameStarted,
                gameEnded: room.game.gameEnded
            });
            
            // Start new game if there are 2 players
            if (room.game.players.length === 2) {
                room.game.startGame();
                io.to(roomId).emit('gameStart', { 
                    players: room.game.players,
                    currentPlayer: room.game.currentPlayer,
                    turnTimeLeft: room.game.turnTimeLeft
                });
            }
        }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
        console.log('User disconnected:', socket.id);
        
        if (currentUsername) {
            // Remove user from online users
            await removeUserOnline(currentUsername);
            console.log(`👤 User ${currentUsername} logged out`);
        }
        
        const roomId = socket.roomId;
        if (roomId) {
            const room = rooms.get(roomId);
            if (room) {
                room.sockets.delete(socket.id);
                room.game.removePlayer(socket.id);
                
                // Update Redis if there are still players
                if (room.game.players.length > 0) {
                    const roomData = {
                        id: roomId,
                        players: room.game.players,
                        board: room.game.board,
                        currentPlayer: room.game.currentPlayer,
                        gameStarted: room.game.gameStarted,
                        updatedAt: Date.now()
                    };
                    await saveRoomToRedis(roomId, roomData);
                }
                
                // Notify remaining players
                socket.to(roomId).emit('playerLeft', { 
                    players: room.game.players 
                });

                // Send chat notification
                if (currentUsername) {
                    socket.to(roomId).emit('chatMessage', {
                        sender: 'System',
                        message: `${currentUsername} left the room`,
                        timestamp: Date.now(),
                        isSystem: true
                    });
                }

                // Delete room if empty
                if (room.sockets.size === 0) {
                    rooms.delete(roomId);
                    await removeRoomFromRedis(roomId);
                }
                
                // Broadcast room list update
                const roomList = await getRoomListForBroadcast();
                io.emit('roomListUpdated', roomList);
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access game at: http://localhost:${PORT}`);
});
