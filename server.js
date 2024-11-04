const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.static('public')); // Sirve la carpeta 'public' como archivos estáticos

// Resto de la configuración del servidor (lógica de sockets, etc.)

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

// server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });

// Almacenar partidas
const games = {};

// Escuchar conexiones
wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        switch (data.type) {
            case 'create':
                const gameId = generateGameId();
                games[gameId] = { players: [ws], board: Array(9).fill(null) };
                ws.send(JSON.stringify({ type: 'gameCreated', gameId }));
                break;

            case 'join':
                const game = games[data.gameId];
                if (game && game.players.length === 1) {
                    game.players.push(ws);
                    game.players.forEach((player, index) =>
                        player.send(JSON.stringify({ type: 'startGame', player: index === 0 ? 'X' : 'O' }))
                    );
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Game not found or already full.' }));
                }
                break;

            case 'move':
                const currentGame = games[data.gameId];
                if (currentGame) {
                    currentGame.board[data.index] = data.player;
                    currentGame.players.forEach((player) =>
                        player.send(JSON.stringify({ type: 'move', index: data.index, player: data.player }))
                    );
                }
                break;
        }
    });
});

function generateGameId() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

console.log("WebSocket server is running on ws://localhost:8080");
