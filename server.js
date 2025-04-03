// server.js
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Servir archivos estáticos desde la carpeta public
app.use(express.static(path.join(__dirname, 'public')));

const games = new Map();

function generateGameId() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'create':
                const gameId = generateGameId();
                games.set(gameId, {
                    creator: ws,
                    opponent: null,
                    board: Array(9).fill(null)
                });
                ws.gameId = gameId;
                ws.send(JSON.stringify({ type: 'gameCreated', gameId }));
                break;

            case 'join':
                const game = games.get(data.gameId);
                if (game && !game.opponent) {
                    game.opponent = ws;
                    ws.gameId = data.gameId;
                    
                    // Notificar a ambos jugadores
                    game.creator.send(JSON.stringify({ type: 'startGame', player: 'X' }));
                    game.opponent.send(JSON.stringify({ type: 'startGame', player: 'O' }));
                } else {
                    ws.send(JSON.stringify({ 
                        type: 'error', 
                        message: 'Partida no encontrada o llena' 
                    }));
                }
                break;

            case 'move':
                const currentGame = games.get(data.gameId);
                if (currentGame && currentGame.board[data.index] === null) {
                    currentGame.board[data.index] = data.player;
                    
                    // Enviar el movimiento a ambos jugadores
                    currentGame.creator.send(JSON.stringify({
                        type: 'move',
                        index: data.index,
                        player: data.player
                    }));
                    currentGame.opponent.send(JSON.stringify({
                        type: 'move',
                        index: data.index,
                        player: data.player
                    }));
                }
                break;
        }
    });

    ws.on('close', () => {
        if (ws.gameId) {
            const game = games.get(ws.gameId);
            if (game) {
                if (game.creator === ws) {
                    if (game.opponent) {
                        game.opponent.send(JSON.stringify({ 
                            type: 'opponentLeft',
                            message: 'Tu oponente ha abandonado la partida'
                        }));
                    }
                } else if (game.opponent === ws) {
                    game.creator.send(JSON.stringify({ 
                        type: 'opponentLeft',
                        message: 'Tu oponente ha abandonado la partida'
                    }));
                }
                games.delete(ws.gameId);
            }
        }
    });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Servidor iniciado en el puerto ${PORT}`);
});
