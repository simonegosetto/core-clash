export function renderPlayerCard(p) {
    const bar = (val, max, len) => {
        const filled = Math.round((val / max) * len);
        return "[" + "█".repeat(filled) + "░".repeat(len - filled) + `] ${val}/${max}`;
    };
    return `
========================
  ${p.name}
  HP:   ${bar(p.hp, p.maxHp, 20)}
  Forza ${p.force} ⚔
  Mana  ${p.mana} ✨
  GPU   ${p.gpu} 🎮
  Status: ${p.status}
========================`;
}

export function renderPlayersList(players) {
    const rows = players.map((p, i) => {
        const hpPct = Math.round((p.hp / p.maxHp) * 100);
        return `${String(i + 1).padStart(2, " ")}) ${p.name.padEnd(18)} HP:${String(p.hp).padStart(3)}/${String(p.maxHp).padEnd(3)} (${hpPct}%)`;
    });
    return rows.join("\n");
}
