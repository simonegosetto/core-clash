<img width="1024" height="1024" alt="core-clash" src="https://github.com/user-attachments/assets/23fe0861-ac7a-43a3-aa59-0b02d9bbd294" />

# ⚔️ Core CLASH

**Core CLASH** is a turn-based RPG that runs entirely in the **console** and plays over LAN with no central server.
Each PC becomes a character whose stats are generated from real hardware (CPU, RAM, GPU, Disk).
Lobby and turns are managed serverlessly via UDP broadcast and socket.io.

---

## 🎮 Gameplay
- **Turn-based combat**: players act one by one in a round-robin order.
- Available actions:
  - **ATTACK** → deals damage based on CPU power.
  - **DEFEND** → reduces incoming damage this turn.
  - **PASS** → skip your turn.
  - *(planned: **SPELLS** based on RAM, **SPECIALS** based on GPU, status effects like Memory Leak or Blue Screen).*
- Winner: the last PC standing with HP > 0.

---

## 🧬 Character Generation
Each character is automatically generated from real hardware specs using [`systeminformation`](https://www.npmjs.com/package/systeminformation):

- **Name** = `${username}-${cpuBrand}`
- **HP (Health)** = proportional to the main disk capacity
- **Force (Attack)** = based on CPU cores and max frequency
- **Mana (Energy)** = based on RAM size and average RAM clock
- **GPU (Special)** = score depending on GPU type (integrated, gaming, workstation)
- **Status** = current conditions (Overheat, Stun, etc. – *WIP*)

Example character card:

```
========================
  simone-AMD
  HP:   [███████████████░░░] 180/200
  Force 17 ⚔
  Mana  12 ✨
  GPU   15 🎮
  Status: -
========================
```

---

## 🌐 Multiplayer in LAN (serverless)
- **Auto-discovery** of players using UDP broadcast.
- If a client finds an existing host → it connects.
- If no host responds → it becomes the **host**.
- The host manages the lobby, turn order, and action validation, but also plays as a character.
- Real-time synchronization powered by [`socket.io`](https://socket.io/).

---

## 🖥️ Console UI
- Pure ANSI console output:
  - ASCII player cards
  - HP/Mana bars `[████░░░░░░]`
  - Colored logs for actions (ATTACK in red, DEFEND in cyan, PASS in yellow)
- Each player sees:
  - Their own character card
  - The full list of players with updated stats
  - Action logs during the battle
- Input: simple **numeric choice + Enter**

---

## 🖼️ Example Gameplay

### Screenshot
![LAN Hardware Wars - Screenshot](./Screenshot%202025-09-19%20084333.png)

### Console log sample
```
=== GAME START ===

========================
  simone-AMD
  HP:   [███████████░░░░] 120/180
  Force 17 ⚔
  Mana  12 ✨
  GPU   15 🎮
  Status: -
========================

Turn: luca-Intel (20s)
[ATTACK] luca-Intel hits simone-AMD for 7 damage!
[DEFEND] simone-AMD defends, reducing incoming damage.
```

---

## ⚙️ Code Architecture
- `character.js` → generates characters from hardware
- `discovery.js` → UDP auto-discovery and host election
- `host.js` → lobby logic, turn order, action validation
- `client.js` → console UI, player input, updates from host
- `ui.js` → ASCII rendering utilities
- `index.js` → entrypoint, decides whether to become host or client

---

## 🚀 Installation & Run
Clone the repo and install dependencies:

```bash
git clone https://github.com/simonegosetto/core-clash.git
cd core-clash
npm install
```

Start the game:

```bash
node index.js
```

- If no host exists → you become the host.
- If a host exists → you connect automatically.

---

## 🚧 Current State
✅ LAN lobby with auto-discovery  
✅ Host participates as a player  
✅ Round-robin turn system  
✅ Character stats generated from real hardware  
✅ Console input with Enter  
✅ ASCII UI with HP/Mana bars  
✅ Colored action logs

---

## 🔮 Roadmap
- RAM-based spells (*Memory Leak*, *Garbage Collector*)
- GPU-based specials with cooldown
- Real status effects (*Overheat* if CPU temperature is high, *Blue Screen*, etc.)
- Competitive presets (casual / ranked / turbo)
- Improved console UI using [blessed](https://github.com/chjj/blessed)
- Multi-target actions (choose which opponent to attack)
- Deterministic replays with seeded RNG

---

## 📜 License
MIT License
