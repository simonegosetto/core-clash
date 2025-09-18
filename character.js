// character.js
import si from "systeminformation";
import os from "os";
import crypto from "crypto";

const clamp = (min, v, max) => Math.max(min, Math.min(max, v));

/**
 * Forza CPU (1–20)
 * - Base su log2(core) per non far esplodere Threadripper
 * - Bonus su speedMax (boost reale) rispetto a 3.0 GHz
 */
function computeForce(cores, speed, speedMax) {
    const sMax = speedMax || speed || 3.5;
    const base = 5 + 2.5 * Math.log2(Math.max(1, cores));     // core impact
    const boost = 1.5 * Math.max(0, sMax - 3.0);               // GHz over 3.0
    const force = Math.round(base + boost);
    return clamp(6, force, 20);
}

/**
 * Mana RAM (5–25)
 * - Log2 sui GB per crescere bene da 8→16→32→64→128
 * - Piccolo bonus sul clock RAM (es. DDR4-3200 ~ +1, DDR5-5600 ~ +3)
 */
function computeMana(ramGB, ramClockMHzAvg) {
    const logPart = 5 + 3 * Math.log2(Math.max(1, ramGB / 8)); // 8GB≈5, 16≈8, 32≈11, 64≈14, 128≈17
    const clock = ramClockMHzAvg || 2400;
    const clockBonus = Math.max(0, Math.round((clock - 2666) / 800)); // 2666→0, 3200→+1, 3600→+1, 5200→+3
    const mana = Math.round(logPart) + clockBonus;
    return clamp(5, mana, 25);
}

export async function generateCharacter() {
    const [cpu, mem, fsSize, gpuList] = await Promise.all([
        si.cpu(),
        si.mem(),
        si.fsSize(),
        si.graphics()
    ]);

    const username = os.userInfo().username || "player";
    const cpuBrand = (cpu.brand || "CPU").split(" ")[0];

    // DISK (HP)
    const mainDisk = fsSize.find(d => d.mount === "C:" || d.mount === "/" )
        || fsSize.sort((a,b) => b.size - a.size)[0];

    const diskGB = mainDisk ? Math.round(mainDisk.size / 1024 / 1024 / 1024) : 128;
    const hp = clamp(80, Math.round(diskGB * 0.5), 220);

    // CPU
    const cores = cpu.cores || 2;
    const speed = cpu.speed || 3.0;
    const speedMax = cpu.speedmax || cpu.speedMax || speed;
    const force = computeForce(cores, speed, speedMax);

    // RAM (MANA)
    // RAM
    const ramGB = Math.round(mem.total / 1024 / 1024 / 1024);
    let ramClockAvg = 0;
    try {
        const memLayout = await si.memLayout();
        const clocks = (memLayout || []).map(m => m.clockSpeed).filter(Boolean);
        if (clocks.length) {
            ramClockAvg = Math.round(clocks.reduce((a,b)=>a+b,0) / clocks.length);
        }
    } catch {}
    const mana = computeMana(ramGB, ramClockAvg);

    const gpuModel = gpuList.controllers?.[0]?.model || "integrated";
    const gpuScore = gpuModel.includes("NVIDIA") ? 15 : gpuModel.includes("AMD") ? 12 : 5;

    // id unico per processo (stabile per match, non timestamp chilometrico)
    const short = crypto.randomBytes(2).toString("hex");
    const id = `${os.hostname()}-${username}-${short}`;

    return {
        id,
        name: `${username}-${cpuBrand}`,
        hp,
        maxHp: hp,
        force,
        mana,
        gpu: gpuScore,
        status: "-"
    };
}
