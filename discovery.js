import dgram from "dgram";
import os from "os";

const DISC_PORT = 41234;

function getLocalIp() {
    const ifaces = os.networkInterfaces();
    for (const name of Object.keys(ifaces)) {
        for (const i of ifaces[name] || []) {
            if (i.family === "IPv4" && !i.internal) return i.address;
        }
    }
    return "127.0.0.1";
}

export function discoverHost(onHost, onTimeout) {
    // reuseAddr aiuta su Windows per riaprire/riusare la porta
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });

    let found = false;
    let closed = false;
    const timers = [];

    const cleanup = () => {
        if (closed) return;
        closed = true;
        // cancella TUTTI i timer pendenti
        for (const t of timers) clearTimeout(t);
        timers.length = 0;
        try { sock.close(); } catch (_) {}
    };

    sock.on("message", (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === "HOST" && data.hostIp) {
                found = true;
                onHost(data);
                cleanup();
            }
        } catch {
            /* ignore parse errors */
        }
    });

    sock.on("error", (err) => {
        // Non voglio far esplodere il processo per un errore UDP
        // Logga e chiudi pulito
        console.error("[discovery] UDP error:", err.code);
        if (!found) onTimeout?.();
        cleanup();
    });

    sock.on("close", () => {
        closed = true;
    });

    sock.bind(() => {
        try { sock.setBroadcast(true); } catch (_) {}
        const msg = Buffer.from(JSON.stringify({ type: "DISCOVER" }));
        // Schedula 3 broadcast ravvicinati; salva i timer per eventuale clear
        for (let i = 0; i < 3; i++) {
            const t = setTimeout(() => {
                if (closed) return;
                try {
                    sock.send(msg, 0, msg.length, DISC_PORT, "255.255.255.255");
                } catch (_) {
                    // se il socket è stato chiuso nel frattempo, ignoriamo
                }
            }, i * 200);
            timers.push(t);
        }
    });

    // Timeout complessivo: se nessuno risponde, promuoviti a host
    const to = setTimeout(() => {
        if (!found) onTimeout?.();
        cleanup();
    }, 1300);
    timers.push(to);
}

export function startHostResponder(hostPort) {
    const hostIp = getLocalIp();
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });

    sock.on("message", (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === "DISCOVER") {
                const reply = Buffer.from(JSON.stringify({ type: "HOST", hostIp, hostPort }));
                sock.send(reply, 0, reply.length, rinfo.port, rinfo.address);
            }
        } catch {
            /* ignore */
        }
    });

    sock.on("error", (err) => {
        console.error("[responder] UDP error:", err.code);
    });

    sock.bind(DISC_PORT);
    return { hostIp };
}
