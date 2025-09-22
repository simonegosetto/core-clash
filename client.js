import { io } from "socket.io-client";
import readline from "readline";
import { renderPlayerCard, renderPlayersPanel } from "./ui.js";

export function startClient(hostIp, port, character) {
    const socket = io(`http://${hostIp}:${port}`);

    let currentTurnId = null; let lastRenderedResultTurnId = null; let lastPlayers = [];
    const myId = character.id; let awaitingAction = false; let hostId = null; let inGame = false;

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, historySize: 0, prompt: "" });
    const promptIdle = () => { rl.setPrompt("> "); rl.prompt(true); };
    const promptAction = () => { rl.setPrompt("Azione? [1=ATTACK ⚔️] [2=DEFEND 🛡️] [3=PASS ⏭️] > "); rl.prompt(true); };

    // stato aggiuntivo
    let mode = "idle"; // "idle" | "await_action" | "await_target"
    let pendingAction = null;

    function listEnemies() {
        const enemies = lastPlayers.filter(p => p.id !== myId && p.hp > 0);
        if (!enemies.length) return [];
        console.log("\nScegli il bersaglio:");
        enemies.forEach((e, i) => {
            console.log(`  ${i + 1}) ${e.name}  HP:${e.hp}/${e.maxHp}`);
        });
        return enemies;
    }

    rl.on("line", (line) => {
        const txt = (line || "").trim().toLowerCase();

        // Comando host in lobby
        if (!inGame && myId === hostId && (txt === "start" || txt === "s")) {
            socket.emit("lobby:start", { playerId: myId });
            return promptIdle();
        }

        if (mode === "await_target") {
            const enemies = lastPlayers.filter(p => p.id !== myId && p.hp > 0);
            const idx = parseInt(txt, 10);
            if (!Number.isInteger(idx) || idx < 1 || idx > enemies.length) {
                console.log("Numero non valido. Riprova.");
                rl.prompt(true);
                return;
            }
            const target = enemies[idx - 1];
            const action = { ...pendingAction, targetId: target.id };
            pendingAction = null;
            mode = "idle";
            socket.emit("turn:action", { turnId: currentTurnId, playerId: myId, action });
            return promptIdle();
        }

        if (!awaitingAction || currentTurnId == null) {
            return promptIdle();
        }

        // scelta azione
        if (txt === "1") {            // ATTACK → chiedi target
            const enemies = listEnemies();
            if (!enemies.length) {
                console.log("Nessun bersaglio disponibile. PASS.");
                mode = "idle";
                socket.emit("turn:action", { turnId: currentTurnId, playerId: myId, action: { type: "PASS" } });
                return promptIdle();
            }
            pendingAction = { type: "ATTACK" };
            mode = "await_target";
            rl.setPrompt("Target # > ");
            return rl.prompt(true);
        }

        if (txt === "2") {            // DEFEND
            mode = "idle";
            socket.emit("turn:action", { turnId: currentTurnId, playerId: myId, action: { type: "DEFEND" } });
            return promptIdle();
        }

        if (txt === "3") {            // PASS
            mode = "idle";
            socket.emit("turn:action", { turnId: currentTurnId, playerId: myId, action: { type: "PASS" } });
            return promptIdle();
        }

        console.log("Usa 1/2/3. Se scegli 1, poi indica il numero del bersaglio.");
        rl.prompt(true);
    });

    rl.on("SIGINT", () => { try { rl.pause(); rl.close(); } catch {} console.log("[client] input chiuso."); });

    socket.on("connect", () => { socket.emit("lobby:join", { ...character, ready: true }); });

    socket.on("lobby:update", ({ players, hostId: hId, started }) => {
        hostId = hId; inGame = !!started; lastPlayers = players;
        if (!currentTurnId) {
            console.clear();
            console.log("=== LOBBY ===");
            console.log(renderPlayersPanel(players));
            if (myId === hostId) console.log("\nYou are the HOST. Type 'start' (or 's') to begin the match. (min 2 players)");
            promptIdle();
        }
    });

    socket.on("lobby:waiting", ({ total, readyCount, minPlayers }) => { console.log(`In attesa: ready ${readyCount}/${total} (min ${minPlayers})`); });
    socket.on("lobby:error", ({ message }) => { console.log(`\n[ERROR] ${message}`); });

    socket.on("game:start", ({ players, hostId: hId }) => {
        hostId = hId; inGame = true; lastPlayers = players; currentTurnId = null; lastRenderedResultTurnId = null;
        console.clear(); console.log("=== GAME START ==="); players.forEach(p => console.log(renderPlayerCard(p))); promptIdle();
    });

    socket.on("turn:begin", ({ turnId, activePlayerId, activePlayerName, timeAllowed }) => {
        currentTurnId = turnId;
        console.log(`\n▶️  Turno di ${activePlayerName} (${timeAllowed}s)`);
        awaitingAction = (activePlayerId === myId);
        pendingAction = null;
        mode = awaitingAction ? "await_action" : "idle";
        if (awaitingAction) promptAction(); else promptIdle();
    });
    /*socket.on("turn:begin", ({ turnId, activePlayerId, activePlayerName, timeAllowed }) => {
        currentTurnId = turnId; console.log(`\n▶️ Turno di ${activePlayerName} (${timeAllowed}s)`);
        awaitingAction = (activePlayerId === myId); if (awaitingAction) promptAction(); else promptIdle();
    });*/

    socket.on("turn:result", ({ results, players, actorId }) => {
        if (currentTurnId && lastRenderedResultTurnId === currentTurnId) return; lastRenderedResultTurnId = currentTurnId;
        lastPlayers = players.map(p => ({ ...p, _acted: p.id === actorId }));
        results.forEach(r => console.log(r)); console.log(renderPlayersPanel(lastPlayers)); promptIdle();
    });

    socket.on("game:end", ({ winnerName }) => { console.log(`\n🏁 FINE PARTITA — Vince ${winnerName}`); try { rl.pause(); rl.close(); } catch {} });
    socket.on("disconnect", () => { console.log("[client] disconnesso."); try { rl.pause(); rl.close(); } catch {} });
}
