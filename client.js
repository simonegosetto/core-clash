import { io } from "socket.io-client";
import readline from "readline";
import { renderPlayerCard, renderPlayersList } from "./ui.js";

export function startClient(hostIp, port, character) {
    const socket = io(`http://${hostIp}:${port}`);

    let currentTurnId = null;
    let lastPlayers = [];

    socket.on("connect", () => {
        socket.emit("lobby:join", { ...character, ready: false });
        // auto-ready dopo 1s (puoi mettere input manuale se vuoi)
        setTimeout(() => socket.emit("lobby:ready", { playerId: character.id }), 1000);
    });

    socket.on("lobby:update", ({ players }) => {
        lastPlayers = players;
        console.clear();
        console.log("=== LOBBY ===");
        console.log(renderPlayersList(players));
    });

    // nel client, aggiungi:
    socket.on("lobby:waiting", ({ total, readyCount, minPlayers }) => {
        console.log(`In attesa: ready ${readyCount} (min ${minPlayers})`);
    });

    socket.on("game:start", ({ players }) => {
        lastPlayers = players;
        console.clear();
        console.log("=== GAME START ===");
        players.forEach(p => console.log(renderPlayerCard(p)));
    });

    socket.on("turn:begin", ({ turnId, activePlayerId, activePlayerName, timeAllowed }) => {
        currentTurnId = turnId;
        console.log(`\nTurno di (${activePlayerId}) ${activePlayerName} (${timeAllowed}s)`);
        if (activePlayerId === character.id) chooseAction(socket, () => currentTurnId, () => lastPlayers, character.id);
    });

    socket.on("turn:result", ({ results, players }) => {
        lastPlayers = players;
        results.forEach(r => console.log(r));
        players.forEach(p => console.log(renderPlayerCard(p)));
    });

    socket.on("game:end", ({ winnerName }) => {
        console.log(`\n== FINE PARTITA == Vince ${winnerName}`);
    });
}

function chooseAction(socket, getTurnId, getPlayers, myId) {
    const enemies = getPlayers().filter(p => p.id !== myId && p.hp > 0);
    const defaultTarget = enemies[0]?.id;

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const prompt = `Azione: [1=ATTACK, 2=DEFEND] ${defaultTarget ? `(target default: ${enemies[0].name})` : ''} > `;
    rl.question(prompt, ans => {
        let action = { type: "DEFEND" };
        if (ans.trim() === "1" && defaultTarget) action = { type: "ATTACK", targetId: defaultTarget };
        socket.emit("turn:action", { turnId: getTurnId(), playerId: myId, action });
        rl.close();
    });
}
