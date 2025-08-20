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
            timerDisplay: document.getElementById('timerDisplay'),
            timerBar: document.getElementById('timerBar'),
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
            // Nếu game đã bắt đầu, chuyển thẳng tới game screen
            this.elements.currentRoomId.textContent = this.roomId;
            this.updatePlayersDisplay();
            this.initializeGameBoard();
            this.updateBoard(data.board);
            this.showGameScreen();
        } else {
            // Nếu chưa bắt đầu, vào waiting room
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
            // Game continues - update timer display
            this.currentTimeLeft = data.turnTimeLeft || 30;
            this.updateTimer();
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
        
        // If game is already started (2 players), show ready message
        if (data.gameStarted && this.players.length === 2) {
            this.showToast('New game starting...', 'success');
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
        this.showToast('Time up! Turn switched.', 'info');
    }

    // Timer management
    updateTimer() {
        this.elements.timerDisplay.textContent = this.currentTimeLeft;
        
        // Update timer circle color
        const timerCircle = document.querySelector('.timer-circle');
        timerCircle.className = 'timer-circle';
        
        if (this.currentTimeLeft <= 5) {
            timerCircle.classList.add('danger');
        } else if (this.currentTimeLeft <= 10) {
            timerCircle.classList.add('warning');
        }
        
        // Update progress bar
        const percentage = (this.currentTimeLeft / 30) * 100;
        this.elements.timerBar.style.width = percentage + '%';
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    // UI Updates
    updatePlayersDisplay() {
        const player1Element = this.elements.player1.querySelector('.player-name');
        const player2Element = this.elements.player2.querySelector('.player-name');

        if (this.players.length >= 1) {
            player1Element.textContent = this.players[0].name;
            this.elements.player1.classList.remove('active');
        } else {
            player1Element.textContent = 'Waiting...';
        }

        if (this.players.length >= 2) {
            player2Element.textContent = this.players[1].name;
            this.elements.player2.classList.remove('active');
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
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new CaroGameClient();
});