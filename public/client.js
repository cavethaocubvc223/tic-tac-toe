class CaroGameClient {
    constructor() {
        this.socket = io();
        this.currentScreen = 'userNameScreen';
        this.roomId = null;
        this.playerName = '';
        this.currentPlayer = null;
        this.mySymbol = null;
        this.gameBoard = null;
        this.players = [];
        this.gameStarted = false;
        this.timerInterval = null;
        this.currentTimeLeft = 30;
        
        this.initializeDOM();
        this.initializeSocketEvents();
    }

    initializeDOM() {
        // Lấy references đến các DOM elements
        this.screens = {
            userNameScreen: document.getElementById('userNameScreen'),
            roomListScreen: document.getElementById('roomListScreen'),
            waitingRoomScreen: document.getElementById('waitingRoomScreen'),
            gameScreen: document.getElementById('gameScreen')
        };

        this.elements = {
            playerName: document.getElementById('playerName'),
            currentUserName: document.getElementById('currentUserName'),
            roomsList: document.getElementById('roomsList'),
            roomCodeInput: document.getElementById('roomCodeInput'),
            waitingRoomId: document.getElementById('waitingRoomId'),
            waitingPlayer1Name: document.getElementById('waitingPlayer1Name'),
            currentRoomId: document.getElementById('currentRoomId'),
            gameBoard: document.getElementById('gameBoard'),
            player1: document.getElementById('player1'),
            player2: document.getElementById('player2'),
            turnIndicator: document.getElementById('turnIndicator'),
            
            // Player timers
            player1Timer: document.getElementById('player1Timer'),
            player2Timer: document.getElementById('player2Timer'),
            player1TimerBar: document.getElementById('player1TimerBar'),
            player2TimerBar: document.getElementById('player2TimerBar'),
            
            resultModal: document.getElementById('resultModal'),
            resultTitle: document.getElementById('resultTitle'),
            resultMessage: document.getElementById('resultMessage'),
            toast: document.getElementById('toast')
        };

        // Event listeners cho buttons
        document.getElementById('confirmNameBtn').addEventListener('click', () => this.confirmUserName());
        document.getElementById('changeNameBtn').addEventListener('click', () => this.showUserNameScreen());
        document.getElementById('createNewRoomBtn').addEventListener('click', () => this.createRoom());
        document.getElementById('refreshRoomsBtn').addEventListener('click', () => this.refreshRooms());
        document.getElementById('joinByCodeBtn').addEventListener('click', () => this.joinRoomByCode());
        document.getElementById('copyWaitingRoomBtn').addEventListener('click', () => this.copyRoomId());
        document.getElementById('leaveWaitingRoomBtn').addEventListener('click', () => this.leaveRoom());
        document.getElementById('copyRoomBtn').addEventListener('click', () => this.copyRoomId());
        document.getElementById('resetGameBtn').addEventListener('click', () => this.resetGame());
        document.getElementById('leaveRoomBtn').addEventListener('click', () => this.leaveRoom());
        document.getElementById('playAgainBtn').addEventListener('click', () => this.playAgain());
        document.getElementById('backToMenuResultBtn').addEventListener('click', () => this.backToRoomList());
        
        // Chat event listeners
        document.getElementById('sendChatBtn').addEventListener('click', () => this.sendChatMessage());
        document.getElementById('toggleChatBtn').addEventListener('click', () => this.toggleChat());
        document.getElementById('chatInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Enter key handlers
        this.elements.playerName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.confirmUserName();
        });

        this.elements.roomCodeInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoomByCode();
        });
    }

    initializeSocketEvents() {
        // Auth events
        this.socket.on('loginSuccess', (data) => this.onLoginSuccess(data));
        this.socket.on('loginError', (data) => this.onLoginError(data));

        // Room events
        this.socket.on('roomListUpdated', (data) => this.updateRoomList(data));
        this.socket.on('roomCreated', (data) => this.onRoomCreated(data));
        this.socket.on('roomJoined', (data) => this.onRoomJoined(data));
        this.socket.on('playerJoined', (data) => this.onPlayerJoined(data));
        this.socket.on('playerLeft', (data) => this.onPlayerLeft(data));

        // Game events
        this.socket.on('gameStart', (data) => this.onGameStart(data));
        this.socket.on('moveMade', (data) => this.onMoveMade(data));
        this.socket.on('gameReset', (data) => this.onGameReset(data));
        this.socket.on('timerUpdate', (data) => this.onTimerUpdate(data));
        this.socket.on('turnTimeout', (data) => this.onTurnTimeout(data));

        // Chat events
        this.socket.on('chatMessage', (data) => this.onChatMessage(data));

        // Error handling
        this.socket.on('error', (data) => this.showToast(data.message, 'error'));

        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('disconnect', () => {
            this.showToast('Lost connection to server', 'error');
        });
    }

    // Screen management
    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        this.screens[screenName].classList.add('active');
        this.currentScreen = screenName;
    }

    showUserNameScreen() {
        this.showScreen('userNameScreen');
        this.elements.playerName.focus();
    }

    showRoomListScreen() {
        this.showScreen('roomListScreen');
        this.refreshRooms();
    }

    showWaitingRoomScreen() {
        this.showScreen('waitingRoomScreen');
    }

    showGameScreen() {
        this.showScreen('gameScreen');
    }

    // User name management
    confirmUserName() {
        const name = this.elements.playerName.value.trim();
        if (!name) {
            this.showToast('Please enter your name', 'error');
            this.elements.playerName.focus();
            return;
        }
        
        if (name.length < 2 || name.length > 20) {
            this.showToast('Name must be 2-20 characters long', 'error');
            this.elements.playerName.focus();
            return;
        }

        // Send login request to server
        this.socket.emit('userLogin', { username: name });
        this.showToast('Checking username...', 'info');
    }

    // Auth event handlers
    onLoginSuccess(data) {
        this.playerName = data.username;
        this.elements.currentUserName.textContent = data.username;
        this.showRoomListScreen();
        this.showToast(`Hello, ${data.username}!`, 'success');
    }

    onLoginError(data) {
        this.showToast(data.message, 'error');
        this.elements.playerName.focus();
        this.elements.playerName.select();
    }

    // Room list management
    refreshRooms() {
        this.socket.emit('getRoomList');
    }

    updateRoomList(roomList) {
        const roomsListElement = this.elements.roomsList;
        
        if (roomList.length === 0) {
            roomsListElement.innerHTML = '<div class="no-rooms">No rooms available. Create a new room!</div>';
            return;
        }

        roomsListElement.innerHTML = '';
        roomList.forEach(room => {
            if (room.status === 'waiting') {
                const roomElement = document.createElement('div');
                roomElement.className = 'room-item';
                roomElement.innerHTML = `
                    <div class="room-info-item">
                        <div class="room-id">Room ${room.id}</div>
                        <div class="room-players">${room.players.join(', ')} (${room.playerCount}/2)</div>
                    </div>
                    <div class="room-status waiting">Waiting</div>
                `;
                roomElement.addEventListener('click', () => this.joinRoom(room.id));
                roomsListElement.appendChild(roomElement);
            }
        });

        if (roomsListElement.children.length === 0) {
            roomsListElement.innerHTML = '<div class="no-rooms">No empty rooms available. Create a new room!</div>';
        }
    }

    // Room management
    createRoom() {
        if (!this.playerName) {
            this.showToast('Please login first', 'error');
            this.showUserNameScreen();
            return;
        }

        this.socket.emit('createRoom', {});
        this.showToast('Creating room...', 'info');
    }

    joinRoom(roomId) {
        if (!this.playerName) {
            this.showToast('Please login first', 'error');
            this.showUserNameScreen();
            return;
        }

        this.socket.emit('joinRoom', { roomId: roomId });
        this.showToast('Joining room...', 'info');
    }

    joinRoomByCode() {
        const roomCode = this.elements.roomCodeInput.value.trim().toUpperCase();
        if (!roomCode) {
            this.showToast('Please enter room code', 'error');
            return;
        }

        this.joinRoom(roomCode);
    }

    leaveRoom() {
        if (confirm('Are you sure you want to leave the room?')) {
            this.socket.disconnect();
            this.socket.connect();
            this.showRoomListScreen();
            this.resetGameState();
        }
    }

    copyRoomId() {
        if (this.roomId) {
            navigator.clipboard.writeText(this.roomId).then(() => {
                this.showToast('Room code copied!', 'success');
            }).catch(() => {
                this.showToast('Unable to copy room code', 'error');
            });
        }
    }

    // Game board management
    initializeGameBoard() {
        this.elements.gameBoard.innerHTML = '';
        
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                const cell = document.createElement('button');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                cell.dataset.occupied = 'false';
                
                cell.addEventListener('click', () => this.makeMove(row, col));
                
                this.elements.gameBoard.appendChild(cell);
            }
        }
    }

    makeMove(row, col) {
        if (!this.gameStarted || !this.canMakeMove()) return;

        const cell = this.getCellElement(row, col);
        if (cell.dataset.occupied === 'true') {
            this.showToast('This cell has already been taken!', 'error');
            return;
        }

        this.socket.emit('makeMove', { row, col });
    }

    canMakeMove() {
        const myPlayer = this.players.find(p => p.name === this.playerName);
        if (!myPlayer) return false;
        
        return myPlayer.symbol === this.currentPlayer;
    }

    resetGame() {
        if (confirm('Are you sure you want to restart the game?')) {
            this.socket.emit('resetGame');
        }
    }

    playAgain() {
        this.hideModal();
        this.socket.emit('resetGame');
    }

    backToRoomList() {
        this.hideModal();
        this.leaveRoom();
    }

    // Socket event handlers
    onRoomCreated(data) {
        this.roomId = data.roomId;
        this.players = data.players;
        this.currentPlayer = data.currentPlayer;
        this.gameStarted = data.gameStarted;
        
        this.elements.waitingRoomId.textContent = this.roomId;
        this.elements.waitingPlayer1Name.textContent = this.playerName;
        this.showWaitingRoomScreen();
        
        this.showToast(`Room ${this.roomId} created!`, 'success');
    }

    onRoomJoined(data) {
        this.roomId = data.roomId;
        this.players = data.players;
        this.currentPlayer = data.currentPlayer;
        this.gameStarted = data.gameStarted;
        
        if (data.gameStarted) {
            // If game already started, go directly to game screen
            this.elements.currentRoomId.textContent = this.roomId;
            this.updatePlayersDisplay();
            this.initializeGameBoard();
            this.updateBoard(data.board);
            this.showGameScreen();
        } else {
            // If not started yet, go to waiting room
            this.elements.waitingRoomId.textContent = this.roomId;
            this.elements.waitingPlayer1Name.textContent = this.players[0].name;
            this.showWaitingRoomScreen();
        }
        
        this.showToast(`Joined room ${this.roomId}!`, 'success');
    }

    onPlayerJoined(data) {
        this.players = data.players;
        
        if (this.currentScreen === 'waitingRoomScreen') {
            // Update waiting room display if we're still waiting
            if (this.players.length === 2) {
                this.showToast('2 players ready! Game starting soon...', 'success');
            }
        }
    }

    onPlayerLeft(data) {
        this.players = data.players;
        this.showToast('A player has left the room', 'info');
        
        if (this.currentScreen === 'gameScreen') {
            this.showWaitingRoomScreen();
            this.gameStarted = false;
            this.stopTimer();
        }
    }

    onGameStart(data) {
        this.players = data.players;
        this.currentPlayer = data.currentPlayer;
        this.gameStarted = true;
        this.currentTimeLeft = data.turnTimeLeft || 30;
        
        this.elements.currentRoomId.textContent = this.roomId;
        this.updatePlayersDisplay();
        this.initializeGameBoard();
        this.updateTurnIndicator();
        this.showGameScreen();
        
        // Start client-side timer countdown
        this.updateTimer();
        this.startClientTimer();
        
        this.showToast('Game started!', 'success');
    }

    onMoveMade(data) {
        this.updateBoard(data.board);
        this.currentPlayer = data.currentPlayer;
        this.updateTurnIndicator();

        // Update cell with animation
        const cell = this.getCellElement(data.row, data.col);
        cell.textContent = data.symbol === 'X' ? '❌' : '⭕';
        cell.className = `cell ${data.symbol.toLowerCase()}`;
        cell.dataset.occupied = 'true';

        // Add move animation
        cell.style.animation = 'cellAppear 0.3s ease-out';

        // Check game end
        if (data.gameEnded || data.winner || data.draw) {
            console.log('🏁 Game ended:', { winner: data.winner, draw: data.draw });
            this.gameStarted = false;
            this.stopTimer();
            
            if (data.winner) {
                this.showGameResult(data.winner, false);
            } else if (data.draw) {
                this.showGameResult(null, true);
            }
        } else {
            // Game continues - update timer display and restart countdown
            this.currentTimeLeft = data.turnTimeLeft || 30;
            this.updateTimer();
            this.startClientTimer();
        }
    }

    onGameReset(data) {
        console.log('🔄 Game reset received:', data);
        
        this.players = data.players;
        this.currentPlayer = data.currentPlayer;
        this.gameStarted = data.gameStarted;
        
        // Reset game state
        this.updateBoard(data.board);
        this.updatePlayersDisplay();
        this.updateTurnIndicator();
        
        // Reset UI
        this.hideModal();
        this.stopTimer();
        this.currentTimeLeft = 30;
        this.updateTimer();
        
        // Clear any existing animations
        document.querySelectorAll('.cell').forEach(cell => {
            cell.style.animation = '';
        });
        
        this.showToast('Game has been reset!', 'info');
        
        // If game is already started (2 players), show ready message and start timer
        if (data.gameStarted && this.players.length === 2) {
            this.showToast('New game starting...', 'success');
            this.startClientTimer();
        }
    }

    onTimerUpdate(data) {
        this.currentTimeLeft = data.timeLeft;
        this.updateTimer();
    }

    onTurnTimeout(data) {
        this.currentPlayer = data.currentPlayer;
        this.currentTimeLeft = 30;
        this.updateTurnIndicator();
        this.updateTimer();
        this.startClientTimer();
        this.showToast('Time up! Turn switched.', 'info');
    }

    // Timer management
    updateTimer() {
        // Calculate progress percentage
        const percentage = (this.currentTimeLeft / 30) * 100;
        
        // Update player cards and board effects
        this.updatePlayerTimers();
        this.updateBoardEffects();
    }

    updatePlayerTimers() {
        const currentPlayerSymbol = this.getCurrentPlayerSymbol();
        const player1Card = this.elements.player1;
        const player2Card = this.elements.player2;
        const gameBoard = this.elements.gameBoard;
        
        // Clear all active states
        player1Card.classList.remove('active-player', 'warning', 'danger');
        player2Card.classList.remove('active-player', 'warning', 'danger');
        gameBoard.classList.remove('my-turn', 'warning', 'danger');
        
        // Hide all timers first
        const player1Timer = player1Card.querySelector('.player-timer');
        const player2Timer = player2Card.querySelector('.player-timer');
        player1Timer.style.display = 'none';
        player2Timer.style.display = 'none';
        
        // Progress percentage for border animation (reverse: 100 -> 0)
        const progressPercentage = (this.currentTimeLeft / 30) * 100;
        
        // Set active player and show their timer
        if (currentPlayerSymbol === 'X') {
            player1Card.classList.add('active-player');
            player1Card.style.setProperty('--progress', progressPercentage);
            player1Timer.style.display = 'flex';
            
            // Update timer display
            this.elements.player1Timer.textContent = this.currentTimeLeft;
            this.elements.player1TimerBar.style.width = progressPercentage + '%';
            
            if (this.currentTimeLeft <= 5) {
                player1Card.classList.add('danger');
            } else if (this.currentTimeLeft <= 10) {
                player1Card.classList.add('warning');
            }
        } else if (currentPlayerSymbol === 'O') {
            player2Card.classList.add('active-player');
            player2Card.style.setProperty('--progress', progressPercentage);
            player2Timer.style.display = 'flex';
            
            // Update timer display
            this.elements.player2Timer.textContent = this.currentTimeLeft;
            this.elements.player2TimerBar.style.width = progressPercentage + '%';
            
            if (this.currentTimeLeft <= 5) {
                player2Card.classList.add('danger');
            } else if (this.currentTimeLeft <= 10) {
                player2Card.classList.add('warning');
            }
        }
    }

    updateBoardEffects() {
        const gameBoard = this.elements.gameBoard;
        
        // Check if it's current player's turn
        if (this.isMyTurn()) {
            gameBoard.classList.add('my-turn');
            
            // Set progress for board border animation
            const progressPercentage = (this.currentTimeLeft / 30) * 100;
            gameBoard.style.setProperty('--progress', progressPercentage);
            
            if (this.currentTimeLeft <= 5) {
                gameBoard.classList.add('danger');
            } else if (this.currentTimeLeft <= 10) {
                gameBoard.classList.add('warning');
            }
        }
    }

    isMyTurn() {
        if (!this.gameStarted || !this.players || this.players.length < 2) return false;
        
        const myPlayer = this.players.find(p => p.name === this.playerName);
        if (!myPlayer) return false;
        
        return myPlayer.symbol === this.currentPlayer;
    }

    getCurrentPlayerSymbol() {
        return this.currentPlayer;
    }

    startClientTimer() {
        this.stopTimer(); // Clear any existing timer
        
        this.timerInterval = setInterval(() => {
            if (this.gameStarted && this.currentTimeLeft > 0) {
                this.currentTimeLeft--;
                this.updateTimer();
                
                // Play warning sound when time is low
                if (this.currentTimeLeft === 5) {
                    this.playWarningSound();
                }
                
                // If time reaches 0, the server will handle the timeout
                if (this.currentTimeLeft <= 0) {
                    this.stopTimer();
                }
            }
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // Clear all visual effects when timer stops
        this.clearTimerEffects();
    }

    clearTimerEffects() {
        // Clear board effects
        const gameBoard = this.elements.gameBoard;
        gameBoard.classList.remove('my-turn', 'warning', 'danger');
        gameBoard.style.removeProperty('--progress');
        
        // Clear player card effects
        this.elements.player1.classList.remove('active-player', 'warning', 'danger');
        this.elements.player2.classList.remove('active-player', 'warning', 'danger');
        this.elements.player1.style.removeProperty('--progress');
        this.elements.player2.style.removeProperty('--progress');
        
        // Hide all timers
        const player1Timer = this.elements.player1.querySelector('.player-timer');
        const player2Timer = this.elements.player2.querySelector('.player-timer');
        if (player1Timer) player1Timer.style.display = 'none';
        if (player2Timer) player2Timer.style.display = 'none';
        
        // Reset timer displays
        this.elements.player1Timer.textContent = '30';
        this.elements.player2Timer.textContent = '30';
        this.elements.player1TimerBar.style.width = '100%';
        this.elements.player2TimerBar.style.width = '100%';
    }

    playWarningSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            // Silent fail if audio context not supported
        }
    }

    // UI Updates
    updatePlayersDisplay() {
        const player1Element = this.elements.player1.querySelector('.player-name');
        const player2Element = this.elements.player2.querySelector('.player-name');

        // Clear all active states
        this.elements.player1.classList.remove('active-player', 'warning', 'danger');
        this.elements.player2.classList.remove('active-player', 'warning', 'danger');

        if (this.players.length >= 1) {
            player1Element.textContent = this.players[0].name;
        } else {
            player1Element.textContent = 'Waiting...';
        }

        if (this.players.length >= 2) {
            player2Element.textContent = this.players[1].name;
        } else {
            player2Element.textContent = 'Waiting...';
        }

        this.updateTurnIndicator();
    }

    updateTurnIndicator() {
        if (!this.gameStarted || this.players.length < 2) {
            this.elements.turnIndicator.textContent = 'Waiting for players...';
            this.elements.player1.classList.remove('active');
            this.elements.player2.classList.remove('active');
            return;
        }

        const currentPlayerObj = this.players.find(p => p.symbol === this.currentPlayer);
        if (currentPlayerObj) {
            this.elements.turnIndicator.textContent = `${currentPlayerObj.name}'s turn`;
            
            // Highlight current player
            this.elements.player1.classList.remove('active');
            this.elements.player2.classList.remove('active');
            
            if (currentPlayerObj.symbol === 'X') {
                this.elements.player1.classList.add('active');
            } else {
                this.elements.player2.classList.add('active');
            }
        }
    }

    updateBoard(board) {
        this.gameBoard = board;
        
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                const cell = this.getCellElement(row, col);
                const cellValue = board[row][col];
                
                if (cellValue) {
                    cell.textContent = cellValue === 'X' ? '❌' : '⭕';
                    cell.className = `cell ${cellValue.toLowerCase()}`;
                    cell.dataset.occupied = 'true';
                } else {
                    cell.textContent = '';
                    cell.className = 'cell';
                    cell.dataset.occupied = 'false';
                }
            }
        }
    }

    getCellElement(row, col) {
        return document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    }

    showGameResult(winner, isDraw) {
        let title, message;
        
        if (isDraw) {
            title = '🤝 Draw!';
            message = 'The game ended in a draw!';
        } else {
            const isWinner = winner.name === this.playerName;
            title = isWinner ? '🎉 You Win!' : '😢 You Lose!';
            message = `${winner.name} won the game!`;
        }

        this.elements.resultTitle.textContent = title;
        this.elements.resultMessage.textContent = message;
        this.showModal();
    }

    showModal() {
        this.elements.resultModal.classList.add('active');
    }

    hideModal() {
        this.elements.resultModal.classList.remove('active');
    }

    showToast(message, type = 'info') {
        this.elements.toast.textContent = message;
        this.elements.toast.className = `toast ${type}`;
        this.elements.toast.classList.add('show');

        setTimeout(() => {
            this.elements.toast.classList.remove('show');
        }, 3000);
    }

    resetGameState() {
        this.roomId = null;
        this.players = [];
        this.currentPlayer = null;
        this.gameBoard = null;
        this.gameStarted = false;
        this.stopTimer();
        this.currentTimeLeft = 30;
        this.clearChat();
        this.clearTimerEffects();
    }

    // Chat methods
    sendChatMessage() {
        const chatInput = document.getElementById('chatInput');
        const message = chatInput.value.trim();
        
        if (!message) return;
        if (message.length > 200) {
            this.showToast('Message too long (max 200 characters)', 'error');
            return;
        }
        if (!this.roomId) {
            this.showToast('You must be in a room to chat', 'error');
            return;
        }

        // Send message to server
        this.socket.emit('chatMessage', {
            roomId: this.roomId,
            message: message,
            sender: this.playerName
        });

        chatInput.value = '';
    }

    onChatMessage(data) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        
        // Handle system messages
        if (data.isSystem || data.sender === 'System') {
            messageDiv.className = 'system-message';
            messageDiv.textContent = data.message;
        } else {
            const isOwnMessage = data.sender === this.playerName;
            messageDiv.className = `chat-message ${isOwnMessage ? 'own' : 'other'}`;
            
            const time = new Date().toLocaleTimeString('vi-VN', { 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            
            messageDiv.innerHTML = `
                <div class="message-sender">${data.sender}</div>
                <div class="message-content">${this.escapeHtml(data.message)}</div>
                <div class="message-time">${time}</div>
            `;
            
            // Add notification sound effect for non-own messages
            if (!isOwnMessage) {
                this.playChatSound();
            }
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    toggleChat() {
        const chatContainer = document.querySelector('.chat-container');
        const toggleBtn = document.getElementById('toggleChatBtn');
        
        chatContainer.classList.toggle('collapsed');
        toggleBtn.textContent = chatContainer.classList.contains('collapsed') ? '🔼' : '🔽';
    }

    clearChat() {
        const chatMessages = document.getElementById('chatMessages');
        chatMessages.innerHTML = '<div class="system-message">Welcome! You can chat with your opponent here.</div>';
    }

    addSystemMessage(message) {
        const chatMessages = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'system-message';
        messageDiv.textContent = message;
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    playChatSound() {
        // Simple notification sound using Web Audio API
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.2);
        } catch (e) {
            // Silent fail if audio context not supported
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CaroGameClient();
});