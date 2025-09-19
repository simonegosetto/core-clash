import { generateCharacter } from "./character.js";
import { discoverHost, startHostResponder } from "./discovery.js";
import { startHost } from "./host.js";
import { startClient } from "./client.js";


const HOST_PORT = 3000;


const me = await generateCharacter();


// Utilizzo delle funzioni async di discovery
await discoverHost(
    ({ hostIp, hostPort }) => {
        console.log("Host trovato:", hostIp, hostPort);
        startClient(hostIp, hostPort, me);
    },
    async () => {
        console.log("Nessun host, divento io host");
        const { hostIp } = await startHostResponder(HOST_PORT);
        startHost(hostIp, HOST_PORT, me);
// avvio anche un client locale, ma senza auto–start della partita
        setTimeout(() => startClient(hostIp, HOST_PORT, { ...me, ready: true }), 300);
    }
);
