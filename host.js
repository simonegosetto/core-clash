import { Server } from "socket.io";
import http from "http";
import chalk from "chalk";

const MIN_PLAYERS = 2; // 👈 cambia qui se vuoi

export function startHost(hostIp, port, hostPlayer) {
    const server = http.createServer();
    const io = new Server(server, { cors: { origin: "*" } });

    /** @type {Record<string, any>} */
    const players = {};
    let turnOrder = [];
    let turnIndex = 0;
    let turnId = 1;
    let started = false;
    let turnTimer = null;

    // registra l’host come primo player
    players[hostPlayer.id] = { ...hostPlayer, socketId: "HOST" };

    io.on("connection", socket => {
        socket.on("lobby:join", player => {
            players[player.id] = { ...player, socketId: socket.id };
            io.emit("lobby:update", { players: snapshot() });
        });

        socket.on("lobby:ready", ({ playerId }) => {
            if (players[playerId]) players[playerId].ready = true;
            io.emit("lobby:update", { players: snapshot() });
            maybeStart();
        });

        socket.on("turn:action", ({ turnId: t, playerId, action }) => {
            if (!started || t !== turnId) return;
            const activeId = turnOrder[turnIndex];
            if (playerId !== activeId) return; // non è il tuo turno
            clearTimeout(turnTimer);
            const results = resolveAction(players[activeId], action, players);
            io.emit("turn:result", { turnId, results, players: snapshot() });
            advanceTurn();
        });

        socket.on("disconnect", () => {
            const pid = Object.keys(players).find(id => players[id].socketId === socket.id);
            if (!pid) return;
            delete players[pid];
            turnOrder = turnOrder.filter(id => id !== pid);
            io.emit("lobby:update", { players: snapshot() });
            if (started && turnOrder.length <= 1) endGame();
        });
    });

    function snapshot() {
        return Object.values(players).map(p => ({
            id: p.id, name: p.name, hp: p.hp, maxHp: p.maxHp, force: p.force, mana: p.mana, gpu: p.gpu, status: p.status || "-"
        }));
    }

    function maybeStart() {
        if (started) return;
        const readyCount = Object.values(players).filter(p => p.ready || p.socketId === "HOST").length;
        const total = Object.keys(players).length;

        if (total >= MIN_PLAYERS && readyCount === total) {
            startGame();
        } else {
            // opzionale: avvisa la lobby
            io.emit("lobby:waiting", { total, readyCount, minPlayers: MIN_PLAYERS });
        }
    }

    function startGame() {
        const list = Object.values(players);
        if (list.length < MIN_PLAYERS) {
            // doppia sicurezza: non partire
            io.emit("lobby:waiting", { total: list.length, readyCount: list.filter(p=>p.ready||p.socketId==="HOST").length, minPlayers: MIN_PLAYERS });
            return;
        }
        started = true;
        turnOrder = list.map(p => p.id);
        io.emit("game:start", { players: snapshot(), turnOrder });
        beginTurn();
    }

    function beginTurn() {
        // NON iniziare turni se rimangono < 2
        turnOrder = turnOrder.filter(id => players[id]?.hp > 0);
        if (turnOrder.length < MIN_PLAYERS) return endGame();

        const activeId = turnOrder[turnIndex];
        io.emit("turn:begin", {
            turnId,
            activePlayerId: activeId,
            activePlayerName: players[activeId].name,
            timeAllowed: 20
        });

        turnTimer = setTimeout(() => {
            const actor = players[activeId];
            const results = resolveAction(actor, { type: "DEFEND" }, players);
            io.emit("turn:result", { turnId, results, players: snapshot() });
            advanceTurn();
        }, 20000);
    }

    function advanceTurn() {
        // rimuovi morti
        turnOrder = turnOrder.filter(id => players[id]?.hp > 0);
        if (turnOrder.length <= 1) return endGame();
        turnIndex = (turnIndex + 1) % turnOrder.length;
        turnId++;
        beginTurn();
    }

    function endGame() {
        started = false;
        const winnerId = turnOrder[0];
        io.emit("game:end", { winnerId, winnerName: players[winnerId]?.name });
    }

    function resolveAction(actor, action, all) {
        const logs = [];
        const aliveEnemies = Object.values(all).filter(p => p.id !== actor.id && p.hp > 0);
        const target = aliveEnemies[0];

        switch (action.type) {
            case "ATTACK": {
                if (!target) {
                    logs.push(chalk.gray(`[ATTACK FAIL] ${actor.name} non ha bersagli.`));
                    break;
                }
                const dmg = Math.max(1, (Math.floor(Math.random() * 6) + Math.floor(actor.force / 2)));
                target.hp = Math.max(0, target.hp - dmg);
                logs.push(
                    chalk.redBright(`[ATTACK] ${actor.name} colpisce ${target.name} per ${dmg} danni!`)
                );
                break;
            }

            case "DEFEND": {
                logs.push(chalk.cyan(`[DEFEND] ${actor.name} si difende, riducendo i danni.`));
                break;
            }

            case "PASS": {
                logs.push(chalk.yellow(`[PASS] ${actor.name} passa il turno.`));
                break;
            }

            default:
                logs.push(chalk.magenta(`[WARN] ${actor.name} azione sconosciuta: ${action.type}`));
        }
        return logs;
    }

    server.listen(port, hostIp, () => {
        console.log(`Host running at ${hostIp}:${port}`);
    });

    return { io, players, startGame, beginTurn, maybeStart };
}
