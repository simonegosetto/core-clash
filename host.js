import {Server} from "socket.io";
import http from "http";
import chalk from "chalk";


const MIN_PLAYERS = 2;


const ICON = {ATTACK: "⚔️", DEFEND: "🛡️", PASS: "⏭️", STUN: "🧊", OVERHEAT: "🔥", WARN: "❗"};
const logAttack = (a, t, d) => chalk.redBright(`[ATTACK] ${ICON.ATTACK} ${a.name} colpisce ${t.name} per ${d} danni!`);
const logDefend = (a) => chalk.cyan(`[DEFEND] ${ICON.DEFEND} ${a.name} si difende, riducendo i danni.`);
const logPass = (a) => chalk.yellow(`[PASS] ${ICON.PASS} ${a.name} passa il turno.`);
const logStun = (a, t, n = 1) => chalk.magenta(`[STUN] ${ICON.STUN} ${a.name} stunna ${t.name} (${n} turno).`);
const logWarn = (m) => chalk.magenta(`[WARN] ${ICON.WARN} ${m}`);


export function startHost(hostIp, port, hostPlayer) {
    const server = http.createServer();
    const io = new Server(server, {cors: {origin: "*"}});


    const players = {};
    let hostId = hostPlayer.id;
    let started = false;
    let turnOrder = [];
    let turnIndex = 0;
    let turnId = 1;
    let turnTimer = null;


    players[hostPlayer.id] = {...hostPlayer, socketId: "HOST", ready: true};


    const snapshot = () => Object.values(players).map(p => ({
        id: p.id,
        name: p.name,
        hp: p.hp,
        maxHp: p.maxHp,
        force: p.force,
        mana: p.mana,
        gpu: p.gpu,
        status: p.status || "-"
    }));


    io.on("connection", socket => {
        socket.on("lobby:join", player => {
            players[player.id] = {...player, socketId: socket.id};
            io.emit("lobby:update", {players: snapshot(), hostId, started});
        });
        socket.on("lobby:ready", ({playerId}) => {
            if (players[playerId]) players[playerId].ready = true;
            io.emit("lobby:update", {players: snapshot(), hostId, started});
        });
        socket.on("lobby:start", ({playerId}) => {
            if (playerId !== hostId || started) return;
            const total = Object.keys(players).length;
            if (total < MIN_PLAYERS) {
                io.to(players[playerId].socketId).emit("lobby:error", {message: `Servono almeno ${MIN_PLAYERS} giocatori.`});
                return;
            }
            startGame();
        });
        socket.on("turn:action", ({turnId: t, playerId, action}) => {
            if (!started || t !== turnId) return;
            const activeId = turnOrder[turnIndex];
            if (playerId !== activeId) return;
            clearTimeout(turnTimer);
            const results = resolveAction(players[activeId], action, players);
            const actor = players[activeId];
            io.emit("turn:result", {turnId, results, players: snapshot(), actorId: actor.id});
            advanceTurn();
        });
        socket.on("disconnect", () => {
            const pid = Object.keys(players).find(id => players[id].socketId === socket.id);
            if (!pid) return;
            delete players[pid];
            turnOrder = turnOrder.filter(id => id !== pid);
            io.emit("lobby:update", {players: snapshot(), hostId, started});
            if (started && turnOrder.length <= 1) endGame();
        });
    });


    function startGame() {
        const list = Object.values(players);
        if (list.length < MIN_PLAYERS) {
            io.emit("lobby:waiting", {
                total: list.length,
                readyCount: list.filter(p => p.ready).length,
                minPlayers: MIN_PLAYERS
            });
            return;
        }
        started = true;
        turnOrder = list.map(p => p.id);
        turnIndex = 0;
        turnId = 1;
        io.emit("game:start", {players: snapshot(), turnOrder, hostId});
        beginTurn();
    }

    function beginTurn() {
        turnOrder = turnOrder.filter(id => players[id]?.hp > 0);
        if (turnOrder.length < 2) return endGame();
        const activeId = turnOrder[turnIndex];
        io.emit("turn:begin", {
            turnId,
            activePlayerId: activeId,
            activePlayerName: players[activeId].name,
            timeAllowed: 20
        });
        turnTimer = setTimeout(() => {
            const actor = players[activeId];
            const results = resolveAction(actor, {type: "DEFEND"}, players);
            io.emit("turn:result", {turnId, results, players: snapshot(), actorId: actor.id});
            advanceTurn();
        }, 20000);
    }

    function advanceTurn() {
        turnOrder = turnOrder.filter(id => players[id]?.hp > 0);
        if (turnOrder.length <= 1) return endGame();
        turnIndex = (turnIndex + 1) % turnOrder.length;
        turnId++;
        beginTurn();
    }

    function endGame() {
        started = false;
        const winnerId = turnOrder[0];
        io.emit("game:end", {winnerId, winnerName: players[winnerId]?.name});
        io.emit("lobby:update", {players: snapshot(), hostId, started});
    }


    function resolveAction(actor, action, all) {
        const logs = [];
        const candidates = Object.values(all).filter(p => p.id !== actor.id && p.hp > 0);

        const pickTarget = () => {
            if (action?.targetId) {
                const t = all[action.targetId];
                if (t && t.id !== actor.id && t.hp > 0) return t;
            }
            return candidates[0]; // fallback
        };


        switch (action.type) {
            case "ATTACK": {
                const target = pickTarget();
                if (!target) { logs.push(logWarn(`${actor.name} non ha bersagli.`)); break; }
                const dmg = Math.max(1, Math.floor(Math.random() * 6) + Math.floor(actor.force / 2));
                target.hp = Math.max(0, target.hp - dmg);
                logs.push(logAttack(actor, target, dmg));
                break;
            }
            case "DEFEND": {
                logs.push(logDefend(actor));
                break;
            }
            case "PASS": {
                logs.push(logPass(actor));
                break;
            }
            case "STUN": {
                if (!target) {
                    logs.push(logWarn(`${actor.name} non ha bersagli.`));
                    break;
                }
                target.status = `Stunned(1)`;
                logs.push(logStun(actor, target, 1));
                break;
            }
            default:
                logs.push(logWarn(`${actor.name} azione sconosciuta: ${action.type}`));
        }
        return logs;
    }


    server.listen(port, hostIp, () => {
        console.log(`Host running at ${hostIp}:${port}`);
    });
    return {io, players, hostId};
}
