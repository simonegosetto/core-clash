import si from "systeminformation";
import os from "os";


const clamp = (min, v, max) => Math.max(min, Math.min(max, v));


function computeForce(cores, speed, speedMax) {
    const sMax = speedMax || speed || 3.5;
    const base = 5 + 2.5 * Math.log2(Math.max(1, cores));
    const boost = 1.5 * Math.max(0, sMax - 3.0);
    return clamp(6, Math.round(base + boost), 20);
}
function computeMana(ramGB, ramClockMHzAvg) {
    const logPart = 5 + 3 * Math.log2(Math.max(1, ramGB / 8));
    const clock = ramClockMHzAvg || 2400;
    const clockBonus = Math.max(0, Math.round((clock - 2666) / 800));
    return clamp(5, Math.round(logPart) + clockBonus, 25);
}


export async function generateCharacter() {
    const cpu = await si.cpu();
    const mem = await si.mem();
    const fsSize = await si.fsSize();
    const gpuList = await si.graphics();


    const username = os.userInfo().username || "player";
    const cpuBrand = (cpu.brand || "CPU").split(" ")[0];


    const mainDisk = fsSize.find(d => d.mount === "/" || d.mount === "C:" || d.fs?.startsWith("\\\\?\\")) || fsSize[0];
    const diskGB = Math.max(1, Math.round((mainDisk?.size || 64 * 1024 ** 3) / 1024 / 1024 / 1024));


    const hp = Math.min(220, Math.max(80, Math.round(diskGB * 0.5)));


    const cores = cpu.cores || 2;
    const speed = cpu.speed || 3.0;
    const speedMax = cpu.speedmax || cpu.speedMax || speed;
    const force = computeForce(cores, speed, speedMax);


    const ramGB = Math.round(mem.total / 1024 / 1024 / 1024);
    let ramClockAvg = 0;
    try {
        const memLayout = await si.memLayout();
        const clocks = (memLayout || []).map(m => m.clockSpeed).filter(Boolean);
        if (clocks.length) ramClockAvg = Math.round(clocks.reduce((a,b)=>a+b,0) / clocks.length);
    } catch {}
    const mana = computeMana(ramGB, ramClockAvg);


    const gpuModel = gpuList.controllers?.[0]?.model || "integrated";
    const special = gpuModel.includes("NVIDIA") ? 15 : gpuModel.includes("AMD") ? 12 : 5;


    const id = `${username}-${Date.now()}`;


    return {
        id,
        name: `${username}-${cpuBrand}`,
        hp, maxHp: hp,
        force, mana,
        gpu: special,
        status: "-",
    };
}
