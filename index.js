import { generateCharacter } from "./character.js";
import { discoverHost, startHostResponder } from "./discovery.js";
import { startHost } from "./host.js";
import { startClient } from "./client.js";

const HOST_PORT = 3000;

const me = await generateCharacter();

discoverHost(
    // On host found → client puro
    ({ hostIp, hostPort }) => {
        console.log("Host trovato:", hostIp, hostPort);
        startClient(hostIp, hostPort, me);
    },
    // No host → divento host E mi collego come client a me stesso
    () => {
        console.log("Nessun host, divento io host");
        const { hostIp } = startHostResponder(HOST_PORT);
        const { startGame, maybeStart } = startHost(hostIp, HOST_PORT, me);
        // collego il mio client a me stesso
        setTimeout(() => {
            startClient(hostIp, HOST_PORT, { ...me, ready: true });
            // avvia auto-start quando arrivano gli altri e sono ready.
            // come fallback, start tra 8s se almeno 2 in lobby:
            // index.js (opzionale, polling che NON forza)
            const poll = setInterval(() => {
                // chiama solo maybeStart, che rispetta MIN_PLAYERS
                try { maybeStart(); } catch {}
            }, 10000);
        }, 300);
    }
);
