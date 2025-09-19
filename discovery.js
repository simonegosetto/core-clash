import dgram from "dgram";
import os from "os";
import fs from "fs";
import path from "path";
import readline from "readline";

const DISC_PORT = 41234;
const CONFIG_FILE = path.join(process.cwd(), "network-config.json");

// Funzione per ottenere tutte le interfacce di rete disponibili
function getNetworkInterfaces() {
    const ifaces = os.networkInterfaces();
    const interfaces = [];

    for (const name of Object.keys(ifaces)) {
        for (const iface of ifaces[name] || []) {
            if (iface.family === "IPv4" && !iface.internal) {
                interfaces.push({
                    name,
                    address: iface.address,
                    netmask: iface.netmask,
                    cidr: iface.cidr
                });
            }
        }
    }

    return interfaces;
}

// Funzione per permettere all'utente di scegliere l'interfaccia di rete
async function chooseNetworkInterface() {
    const interfaces = getNetworkInterfaces();

    if (interfaces.length === 0) {
        console.log("Nessuna interfaccia di rete disponibile. Utilizzo localhost.");
        return "127.0.0.1";
    }

    // Controlla se esiste una configurazione salvata
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            const savedInterface = interfaces.find(iface => iface.address === config.selectedInterface);
            if (savedInterface) {
                console.log(`Utilizzo interfaccia salvata: ${savedInterface.name} (${savedInterface.address})`);
                return savedInterface.address;
            }
        }
    } catch (err) {
        console.error("Errore nel leggere la configurazione salvata:", err.message);
    }

    // Mostra le interfacce disponibili
    console.log("Interfacce di rete disponibili:");
    interfaces.forEach((iface, index) => {
        console.log(`${index + 1}. ${iface.name} - ${iface.address}`);
    });

    // Creazione dell'interfaccia di readline
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Richiesta all'utente
    const answer = await new Promise(resolve => {
        rl.question("Seleziona l'interfaccia di rete da utilizzare (numero) [1]: ", resolve);
    });
    rl.close();

    // Gestione della risposta
    let selectedIndex = parseInt(answer) - 1 || 0;
    if (selectedIndex < 0 || selectedIndex >= interfaces.length) {
        console.log("Selezione non valida, utilizzo la prima interfaccia.");
        selectedIndex = 0;
    }

    const selectedInterface = interfaces[selectedIndex];
    console.log(`Hai selezionato: ${selectedInterface.name} (${selectedInterface.address})`);

    // Salva la configurazione
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify({ selectedInterface: selectedInterface.address }));
        console.log("Configurazione salvata per usi futuri.");
    } catch (err) {
        console.error("Errore nel salvare la configurazione:", err.message);
    }

    return selectedInterface.address;
}

async function getLocalIp() {
    return await chooseNetworkInterface();
}

export async function discoverHost(onHost, onTimeout) {
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

export async function startHostResponder(hostPort) {
    const hostIp = await getLocalIp();
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
