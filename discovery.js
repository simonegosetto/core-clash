import dgram from "dgram";
import os from "os";

const DISC_PORT = 41234;

function getLocalIp() {
    const ifaces = os.networkInterfaces();
    console.log(ifaces);
    for (const name of Object.keys(ifaces)) {
        for (const i of ifaces[name] || []) {
            if (i.family === "IPv4" && !i.internal) return i.address;
        }
    }
    return "127.0.0.1";
}

export function discoverHost(onHost, onTimeout) {
    const sock = dgram.createSocket({ type: "udp4", reuseAddr: true });
    let found = false; let closed = false; const timers = [];

    const cleanup = () => { if (closed) return; closed = true; timers.forEach(clearTimeout); timers.length = 0; try { sock.close(); } catch {} };

    sock.on("message", (msg, rinfo) => {
        try {
            const data = JSON.parse(msg.toString());
            if (data.type === "HOST" && data.hostIp) { found = true; onHost(data); cleanup(); }
        } catch {}
    });

    sock.on("error", () => { if (!found) onTimeout?.(); cleanup(); });
    sock.on("close", () => { closed = true; });


    sock.bind(() => {
        try { sock.setBroadcast(true); } catch {}
        const msg = Buffer.from(JSON.stringify({ type: "DISCOVER" }));
        for (let i = 0; i < 3; i++) {
            const t = setTimeout(() => { if (closed) return; try { sock.send(msg, 0, msg.length, DISC_PORT, "255.255.255.255"); } catch {} }, i * 200);
            timers.push(t);
        }
    });

    const to = setTimeout(() => { if (!found) onTimeout?.(); cleanup(); }, 1300);
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
        } catch {}
    });
    sock.on("error", () => {});
    sock.bind(DISC_PORT);
    return { hostIp };
}
