let board = Array(9).fill(null);
let currentPlayer = "X";
let gameMode = "local";
let difficulty = "easy";
let movesX = [];
let movesO = [];
let socket;
let gameId;
const maxMoves = 3;
const gameBoard = document.getElementById("gameBoard");
const winnerMessage = document.getElementById("winnerMessage");



function startOnlineGame(action) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            if (action === 'create') {
                socket.send(JSON.stringify({ type: 'create' }));
            }
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);

            switch (data.type) {
                case 'gameCreated':
                    gameId = data.gameId;
                    showGameCode(gameId);
                    break;

                case 'startGame':
                    currentPlayer = data.player;
                    showPlayerInfo(currentPlayer);
                    resetGame();
                    break;

                case 'move':
                    board[data.index] = data.player;
                    renderBoard();
                    const winningPattern = checkWin();
                    if (winningPattern) {
                        displayWinner(data.player);
                        renderBoard(winningPattern);
                    }
                    currentPlayer = currentPlayer === "X" ? "O" : "X";
                    break;

                case 'error':
                    showError(data.message);
                    break;

                case 'opponentLeft':
                    showError("Tu oponente ha abandonado la partida");
                    returnToMenu();
                    break;
            }
        };

        socket.onclose = () => {
            showError("Conexión perdida. Volviendo al menú principal...");
            setTimeout(returnToMenu, 2000);
        };

        socket.onerror = () => {
            showError("Error de conexión. Volviendo al menú principal...");
            setTimeout(returnToMenu, 2000);
        };
    }
}

function showGameCode(code) {
    const codeDisplay = document.createElement('div');
    codeDisplay.className = 'game-code';
    codeDisplay.innerHTML = `
        <h3>Código de la partida:</h3>
        <div class="code">${code}</div>
        <p>Comparte este código con tu oponente</p>
        <div class="loading">Esperando oponente...</div>
    `;
    document.getElementById('game').appendChild(codeDisplay);
}

function showPlayerInfo(player) {
    const playerInfo = document.createElement('div');
    playerInfo.className = 'player-info';
    playerInfo.innerHTML = `<h3>Tu símbolo: ${player}</h3>`;
    document.getElementById('game').appendChild(playerInfo);
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

function joinGame() {
    const code = prompt("Introduce el código de la partida:");
    if (code) {
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;
            socket = new WebSocket(wsUrl);
            socket.onopen = () => {
                socket.send(JSON.stringify({ type: 'join', gameId: code }));
            };
        }
    }
}

function handleClick(index) {
    if (board[index] || checkWin()) return;

    if (gameMode === "online") {
        if (currentPlayer === "X" && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'move', gameId, index, player: currentPlayer }));
        }
    } else if (gameMode === "local") {
        if (currentPlayer === "X") {
            if (movesX.length === maxMoves) {
                board[movesX.shift()] = null; // Eliminar la figura "X" más antigua
            }
            board[index] = "X";
            movesX.push(index);
        } else {
            if (movesO.length === maxMoves) {
                board[movesO.shift()] = null; // Eliminar la figura "O" más antigua
            }
            board[index] = "O";
            movesO.push(index);
        }
        const winningPattern = checkWin();
        if (winningPattern) {
            displayWinner(currentPlayer); // Pasar el jugador actual como ganador
            renderBoard(winningPattern); // Resaltar la línea ganadora
            return;
        }
        currentPlayer = currentPlayer === "X" ? "O" : "X";
    } else if (gameMode === "bot") {
        playerMove(index);
        const winningPattern = checkWin();
        if (winningPattern) {
            displayWinner("X"); // Si el jugador "X" gana, mostrarlo
            renderBoard(winningPattern); // Resaltar la línea ganadora
            return;
        }
        setTimeout(botMove, 500); // Esperar medio segundo antes de que el bot mueva
    }
    renderBoard();
}

function playerMove(index) {
    if (board[index]) return; // Asegúrate de que la celda no esté ocupada
    if (movesX.length === maxMoves) board[movesX.shift()] = null;
    board[index] = "X";
    movesX.push(index);
    currentPlayer = "O"; // Cambia el turno al bot
}

function botMove() {
    if (movesO.length === 0) {
        const firstMove = getRandomMove();
        board[firstMove] = "O";
        movesO.push(firstMove);
    } else {
        let move;
        if (difficulty === "hard") {
            move = findBestMove("O");
            if (move === -1) move = getRandomMove();
        } else if (difficulty === "medium") {
            move = findBestMove("O");
            if (move === -1) move = getRandomMove();
        } else {
            move = getRandomMove();
        }

        if (movesO.length === maxMoves) board[movesO.shift()] = null;
        board[move] = "O";
        movesO.push(move);
    }

    const winningPattern = checkWin();
    if (winningPattern) {
        displayWinner("O"); // Si el bot "O" gana, mostrarlo
        renderBoard(winningPattern); // Resaltar la línea ganadora
    } else {
        currentPlayer = "X"; // Cambia el turno al jugador
    }
    renderBoard();
}

function getRandomMove() {
    const availableMoves = board.map((cell, i) => (cell ? null : i)).filter(i => i !== null);
    return availableMoves[Math.floor(Math.random() * availableMoves.length)];
}

function findBestMove(player) {
    if (difficulty === "hard") {
        return findBestMoveMinimax(player);
    } else if (difficulty === "medium") {
        // 80% de probabilidad de hacer un movimiento inteligente
        return Math.random() < 0.8 ? findBestMoveMinimax(player) : getRandomMove();
    }
    return getRandomMove();
}

function findBestMoveMinimax(player) {
    let bestScore = -Infinity;
    let bestMove = -1;
    
    for (let i = 0; i < 9; i++) {
        if (!board[i]) {
            board[i] = player;
            let score = minimax(board, 0, false, player);
            board[i] = null;
            
            if (score > bestScore) {
                bestScore = score;
                bestMove = i;
            }
        }
    }
    
    return bestMove;
}

function minimax(board, depth, isMaximizing, player) {
    const opponent = player === "X" ? "O" : "X";
    const result = checkWin();
    
    if (result) {
        return isMaximizing ? 10 - depth : depth - 10;
    }
    
    if (isMaximizing) {
        let bestScore = -Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = player;
                let score = minimax(board, depth + 1, false, player);
                board[i] = null;
                bestScore = Math.max(score, bestScore);
            }
        }
        return bestScore;
    } else {
        let bestScore = Infinity;
        for (let i = 0; i < 9; i++) {
            if (!board[i]) {
                board[i] = opponent;
                let score = minimax(board, depth + 1, true, player);
                board[i] = null;
                bestScore = Math.min(score, bestScore);
            }
        }
        return bestScore;
    }
}

function checkWin() {
    const winPatterns = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    
    for (const pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return pattern; // Devuelve el patrón ganador
        }
    }
    return null; // Si no hay ganador
}

function displayWinner(winner) {
    winnerMessage.textContent = `¡${winner} ha ganado!`;
    winnerMessage.style.color = winner === "X" ? "#0ff" : "#f0f";
}

function resetGame() {
    board = Array(9).fill(null);
    currentPlayer = "X";
    movesX = [];
    movesO = [];
    winnerMessage.textContent = "";
    renderBoard();
}

function startGame(mode) {
    gameMode = mode;
    document.getElementById("menu").style.display = "none";
    if (mode === "bot") {
        document.getElementById("difficultyMenu").style.display = "block";
    } else {
        document.getElementById("game").style.display = "block";
        resetGame();
    }
}

function setDifficulty(level) {
    difficulty = level;
    document.getElementById("difficultyMenu").style.display = "none";
    document.getElementById("game").style.display = "block";
    resetGame();
}

function returnToMenu() {
    document.getElementById("game").style.display = "none";
    document.getElementById("difficultyMenu").style.display = "none";
    document.getElementById("menu").style.display = "block";
}

function renderBoard(winningPattern = []) {
    gameBoard.innerHTML = "";
    board.forEach((cell, index) => {
        const cellElement = document.createElement("div");
        cellElement.classList.add("cell");

        if (cell === "X") {
            cellElement.classList.add("x");
            cellElement.textContent = "X";
        } else if (cell === "O") {
            cellElement.classList.add("o");
            cellElement.textContent = "O";
        }

        // Añadir la clase de parpadeo a la figura "X" que se va a eliminar
        if (currentPlayer === "X" && movesX[0] === index) {
            cellElement.classList.add("to-remove");
        } else if (currentPlayer === "O" && movesO[0] === index) {
            cellElement.classList.add("to-remove");
        }

        // Resaltar las celdas de la línea ganadora
        if (winningPattern.includes(index)) {
            cellElement.classList.add("winner");
        }

        cellElement.addEventListener("click", () => handleClick(index));
        gameBoard.appendChild(cellElement);
    });
}
