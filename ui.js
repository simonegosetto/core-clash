import chalk from "chalk";


const lpad = (s, len) => ((" ".repeat(len) + s).slice(-len));
const pad = (s, len) => (s + " ".repeat(len)).slice(0, len);


function hpBar(current, max, width = 20) {
    const ratio = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(ratio * width);
    const empty = width - filled;
    let color = chalk.green;
    if (ratio <= 0.33) color = chalk.redBright; else if (ratio <= 0.66) color = chalk.yellow;
    return chalk.white("[") + color("█".repeat(filled)) + chalk.gray("░".repeat(empty)) + chalk.white("]");
}

function statusColor(status) {
    const s = String(status || "-");
    if (s === "-" || s.trim() === "") return chalk.gray("-");
    if (/overheat/i.test(s)) return chalk.hex("#ff8800")("Overheat");
    if (/stun/i.test(s)) return chalk.magenta(`Stunned(${s.match(/\((\d+)\)/)?.[1] ?? "1"})`);
    if (/dot|poison/i.test(s)) return chalk.greenBright(s);
    return chalk.cyan(s);
}

export function renderPlayerCard(p) {
    const bar = hpBar(p.hp, p.maxHp, 20);
    return `
========================
${p.name}
HP: ${bar} ${p.hp}/${p.maxHp}
Force ${p.force} ⚔
Mana ${p.mana} ✨
GPU ${p.gpu} 🎮
Status: ${p.status ?? "-"}
========================`.trim();
}

export function renderPlayersPanel(players) {
    const header = chalk.cyanBright(`>>> Players in match (${players.length}):`);
    const lines = players.map((p, idx) => {
        const badge = p._acted ? chalk.whiteBright("★ ") : " ";
        const force = `⚔: ${p.force}`;
        const hpTxt = `${p.hp}/${p.maxHp}`;
        const hpStr = lpad(hpTxt, 7);
        const bar = hpBar(p.hp, p.maxHp, 20);
        const mana = chalk.cyan(`Mana:${p.mana}`);
        const st = `Status: ${statusColor(p.status)}`;
        return `${badge}${chalk.gray(String(idx + 1).padStart(2))}) ${chalk.magenta(p.name.padEnd(14))} ${force} HP:${hpStr} ${bar} ${mana.padEnd(10)} ${st}`;
    });
    return `${header}\n${lines.join("\n")}`;
}
