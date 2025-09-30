#!/usr/bin/env node

/**
 * 12 人自動化遊戲模擬，用於接近真人的互動節奏測試。
 */

const path = require('path');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ROOM_CODE = '9123';
const PORT = process.env.PORT || '43001';
const PLAYER_NAMES = [
    '亞瑟', '蘭斯洛', '桂妮薇兒', '梅林', '凱瑟琳', '雷蒙',
    '摩甘娜', '莫德雷德', '加拉哈德', '崔斯坦', '艾蓮', '珀西瓦爾'
];

const TEAM_SIZES = {
    6: [2, 3, 4, 3, 4],
    7: [2, 3, 3, 4, 4],
    8: [3, 4, 4, 5, 5],
    9: [3, 4, 4, 5, 5],
    10: [3, 4, 4, 5, 5],
    11: [3, 4, 4, 5, 5],
    12: [3, 4, 4, 5, 5]
};

const randomDelay = (min = 60, max = 220) => new Promise(resolve => {
    const duration = Math.floor(Math.random() * (max - min + 1)) + min;
    setTimeout(resolve, duration);
});

class GameController {
    constructor(roomCode, names) {
        this.roomCode = roomCode;
        this.names = names;
        this.players = new Map();
        this.connected = 0;
        this.joined = 0;
        this.gameStarted = false;
        this.playersOrder = [];
        this.currentLeaderId = null;
        this.currentMission = 1;
        this.pendingTeamSelectionMission = 0;
        this.pendingVotes = new Set();
        this.lakeLadyHolderName = null;
        this.consecutiveRejects = 0;
        this.totalPlayers = names.length;
        this.resolveGame = null;
        this.gameDonePromise = new Promise(resolve => {
            this.resolveGame = resolve;
        });
        this.serverProcess = null;
        this.gameOver = false;
        this.waitingPlayers = [];
        this.hostReady = false;
    }

    async start() {
        await this.startServer();
        this.spawnPlayers();
        await this.gameDonePromise;
    }

    startServer() {
        return new Promise((resolve, reject) => {
            this.serverProcess = spawn('node', ['server.js'], {
                cwd: PROJECT_ROOT,
                stdio: ['ignore', 'pipe', 'pipe'],
                env: { ...process.env, PORT }
            });

            const onReady = (data) => {
                const text = data.toString();
                process.stdout.write(`[伺服器] ${text}`);
                if (text.includes('運行在端口')) {
                    this.serverProcess.stdout.off('data', onReady);
                    resolve();
                }
            };

            this.serverProcess.stdout.on('data', onReady);
            this.serverProcess.stderr.on('data', (data) => {
                process.stderr.write(`[伺服器錯誤] ${data}`);
            });

            this.serverProcess.on('exit', (code) => {
                if (!this.gameStarted && code !== 0) {
                    reject(new Error(`伺服器提前結束，代碼 ${code}`));
                }
            });
        });
    }

    stopServer() {
        if (this.serverProcess && !this.serverProcess.killed) {
            this.serverProcess.kill();
        }
    }

    spawnPlayers() {
        this.names.forEach((name, index) => {
            const isHost = index === 0;
            const player = new PlayerSim({
                name,
                roomCode: this.roomCode,
                isHost,
                controller: this,
                autoConnect: isHost
            });
            this.players.set(name, player);
            if (!isHost) {
                this.waitingPlayers.push(player);
            }
        });
    }

    onConnected(player) {
        this.connected += 1;
        console.log(`⚔️  ${player.name} 已連線 (${this.connected}/${this.totalPlayers})`);
    }

    onJoined(player) {
        this.joined += 1;
        console.log(`🏰  ${player.name} 進入房間 (${this.joined}/${this.totalPlayers})`);
        if (this.joined === this.totalPlayers && !this.gameStarted) {
            const host = this.players.get(this.names[0]);
            setTimeout(() => host.startGame(), 800);
        }
    }

    onHostReady() {
        if (this.hostReady) return;
        this.hostReady = true;
        this.waitingPlayers.forEach((player, index) => {
            const delay = 150 + index * 80;
            player.connectWithDelay(delay);
        });
    }

    onGameStarted(player, payload) {
        if (!this.gameStarted) {
            this.gameStarted = true;
            this.playersOrder = payload.gameData.playersOrder;
            console.log('🎬  遊戲開始，座位順序：');
            this.playersOrder.forEach((id, idx) => {
                const p = Array.from(this.players.values()).find(pl => pl.id === id);
                console.log(`    ${idx + 1}. ${p ? p.name : id}`);
            });
        }
    }

    onRolesReady() {
        // 角色確認後等待系統進入隊長抽選
    }

    onStartLeaderSelection() {
        const host = this.players.get(this.names[0]);
        const randomIndex = Math.floor(Math.random() * this.playersOrder.length);
        const chosenId = this.playersOrder[randomIndex];
        const chosenPlayer = this.findPlayerById(chosenId);
        console.log(`🎯  房主抽選首位隊長：${chosenPlayer.name}`);
        host.confirmLeader(chosenId);
    }

    onLeaderSelected(data) {
        if (this.gameOver) return;
        this.currentLeaderId = data.leaderId;
        this.lakeLadyHolderName = data.lakeLadyHolderName;
        console.log(`👑  ${data.leaderName} 成為隊長，湖中女神暫由 ${data.lakeLadyHolderName} 持有`);
        this.scheduleTeamSelection(data.currentMission || 1);
    }

    onGameStateUpdate(data) {
        if (this.gameOver) return;
        if (typeof data.currentMission === 'number') {
            this.currentMission = data.currentMission;
        }
        if (data.currentLeader) {
            this.currentLeaderId = data.currentLeader;
        }
        if (data.lakeLadyHolderName) {
            this.lakeLadyHolderName = data.lakeLadyHolderName;
        }

        if (data.consecutiveRejects !== undefined) {
            this.consecutiveRejects = data.consecutiveRejects;
        }

        if (data.currentPhase === 'teamSelection') {
            this.scheduleTeamSelection(this.currentMission);
        }
    }

    scheduleTeamSelection(missionNumber) {
        if (this.pendingTeamSelectionMission >= missionNumber) {
            return; // 已經處理過
        }
        if (this.gameOver) return;
        const leader = this.findPlayerById(this.currentLeaderId);
        if (!leader) return;

        const teamSize = TEAM_SIZES[this.totalPlayers][missionNumber - 1];
        const team = [];
        const order = this.playersOrder;
        const leaderIndex = order.indexOf(this.currentLeaderId);
        let offset = 0;
        while (team.length < teamSize) {
            const playerId = order[(leaderIndex + offset) % order.length];
            team.push(playerId);
            offset += 1;
        }

        this.pendingTeamSelectionMission = missionNumber;
        setTimeout(() => {
            leader.selectTeam(team);
            const readable = team.map(id => this.findPlayerById(id)?.name || id);
            console.log(`🤝  ${leader.name} 提出任務 ${missionNumber} 隊伍：${readable.join('、')}`);
        }, 200 + Math.random() * 200);
    }

    onTeamVotingStart(data) {
        if (this.gameOver) return;
        this.consecutiveRejects = data.consecutiveRejects || 0;
        this.pendingVotes.clear();
        console.log(`🗳️  隊伍投票開始（拒絕累計：${this.consecutiveRejects}）`);
        this.players.forEach(player => {
            player.voteForTeam(data.teamMembers);
        });
    }

    onMissionVotingStart(data) {
        if (this.gameOver) return;
        console.log(`🎲  任務投票開始：${data.teamMembers.join('、')}`);
        this.players.forEach(player => {
            player.voteForMission(data.teamMembers);
        });
    }

    onLakeLadyStart(data) {
        if (this.gameOver) return;
        console.log(`🏔️  湖中女神 - ${data.holderName} 正在選擇目標（${data.availableTargets.join('、')}）`);
        const holder = this.players.get(data.holderName);
        if (holder) {
            holder.useLakeLady(data.availableTargets);
        }
    }

    onVoteResult(data) {
        const lines = data.message.split('\n').map(line => line.trim()).filter(Boolean);
        lines.forEach(line => console.log(`📜  ${line}`));
    }

    onMissionUpdate(data) {
        const results = data.missionResults.map((r, idx) => `任務${idx + 1}:${r ? '成功' : '失敗'}`);
        console.log(`📈  任務進度 => ${results.join(' / ')}`);
    }

    onLakeLadyResult(data) {
        if (this.gameOver) return;
        if (data.isEvil === null) {
            console.log(`🔍  ${data.holderName} 查驗了 ${data.targetName}（結果祕密）`);
        } else {
            console.log(`🔍  ${data.holderName} 查驗結果：${data.targetName} 為 ${data.isEvil ? '邪惡' : '好人'}`);
            const holder = this.players.get(data.holderName);
            if (holder) {
                holder.confirmLakeLady();
            }
        }
    }

    onWaitingForAssassination(data) {
        if (!this.gameOver) {
            console.log(`⏳  等待 ${data.assassinName} 進行刺殺`);
        }
    }

    onAssassinationStart(player, data) {
        if (this.gameOver) return;
        console.log(`🗡️  ${player.name} 取得刺殺權，可選目標：${data.targets.map(t => t.name).join('、')}`);
        player.performAssassination(data.targets);
    }

    onGameEnded(data) {
        if (this.gameOver) return;
        this.gameOver = true;
        console.log('🏁  遊戲結束');
        console.log(`結果：${data.goodWins ? '好人勝利' : '邪惡勝利'}`);
        console.log(data.message);
        console.log('角色揭示：');
        data.roles.forEach(role => {
            console.log(` - ${role.name}：${role.role}`);
        });
        setTimeout(() => {
            this.resolveGame();
        }, 150);
    }

    findPlayerById(id) {
        return Array.from(this.players.values()).find(player => player.id === id) || null;
    }

    async cleanup() {
        this.players.forEach(player => player.disconnect());
        await randomDelay(200, 400);
        this.stopServer();
    }
}

class PlayerSim {
    constructor({ name, roomCode, isHost, controller, autoConnect = true }) {
        this.name = name;
        this.roomCode = roomCode;
        this.isHost = isHost;
        this.controller = controller;
        this.socket = io(`http://localhost:${PORT}`, {
            transports: ['websocket'],
            autoConnect,
            reconnection: false
        });
        this.id = null;
        this.role = null;
        this.isEvil = false;
        this.hasVotedTeam = false;
        this.hasVotedMission = false;
        this.setupListeners();
    }

    connectWithDelay(delay) {
        setTimeout(() => {
            if (this.socket.disconnected) {
                this.socket.connect();
            }
        }, delay);
    }

    setupListeners() {
        this.socket.on('connect', () => {
            this.id = this.socket.id;
            this.controller.onConnected(this);
            if (this.isHost) {
                this.socket.emit('createRoom', {
                    playerName: this.name,
                    roomCode: this.roomCode
                });
            } else {
                this.socket.emit('joinRoom', {
                    playerName: this.name,
                    roomCode: this.roomCode
                });
            }
        });

        this.socket.on('roomCreated', () => {
            if (this.isHost) {
                this.controller.onHostReady();
            }
            this.controller.onJoined(this);
        });

        this.socket.on('roomJoined', () => {
            this.controller.onJoined(this);
        });

        this.socket.on('playerJoined', (data) => {
            console.log(`➕  玩家加入：${data.newPlayer}`);
        });

        this.socket.on('gameStarted', async (data) => {
            this.role = data.playerInfo.role;
            this.isEvil = data.playerInfo.isEvil;
            this.controller.onGameStarted(this, data);
            console.log(`🎭  ${this.name} 角色：${this.role}`);
            await randomDelay(120, 320);
            this.socket.emit('roleConfirmed', { roomCode: this.roomCode });
        });

        this.socket.on('startLeaderSelection', () => {
            if (this.isHost) {
                this.controller.onStartLeaderSelection();
            }
        });

        this.socket.on('leaderSelected', (data) => {
            this.controller.onLeaderSelected(data);
        });

        this.socket.on('gameStateUpdate', (data) => {
            this.controller.onGameStateUpdate(data);
            this.hasVotedTeam = false;
            this.hasVotedMission = false;
        });

        this.socket.on('teamVotingStart', (data) => {
            this.hasVotedTeam = false;
            this.controller.onTeamVotingStart(data);
        });

        this.socket.on('missionVotingStart', (data) => {
            if (data.teamMembers.includes(this.name)) {
                this.hasVotedMission = false;
            }
            this.controller.onMissionVotingStart(data);
        });

        this.socket.on('voteUpdate', (data) => {
            console.log(`📊  ${data.voteType === 'team' ? '隊伍' : '任務'}投票進度：${data.currentCount}/${data.totalCount}`);
        });

        this.socket.on('voteResult', (data) => {
            this.controller.onVoteResult(data);
        });

        this.socket.on('missionUpdate', (data) => {
            this.controller.onMissionUpdate(data);
        });

        this.socket.on('lakeLadyStart', (data) => {
            this.controller.onLakeLadyStart(data);
        });

        this.socket.on('lakeLadyResult', (data) => {
            this.controller.onLakeLadyResult(data);
        });

        this.socket.on('waitingForAssassination', (data) => {
            this.controller.onWaitingForAssassination(data);
        });

        this.socket.on('assassinationStart', (data) => {
            this.controller.onAssassinationStart(this, data);
        });

        this.socket.on('gameEnded', (data) => {
            this.controller.onGameEnded(data);
        });

        this.socket.on('error', (err) => {
            console.error(`❗  ${this.name} 收到錯誤：${err.message}`);
        });
    }

    startGame() {
        if (this.controller.gameOver) return;
        console.log('🚀  房主發起開始遊戲');
        this.socket.emit('startGame', {
            roomCode: this.roomCode,
            useDefaultRoles: true
        });
    }

    confirmLeader(leaderId) {
        if (this.controller.gameOver) return;
        this.socket.emit('confirmLeader', {
            roomCode: this.roomCode,
            leaderId
        });
    }

    selectTeam(teamMembers) {
        if (this.controller.gameOver) return;
        this.socket.emit('confirmTeam', {
            roomCode: this.roomCode,
            teamMembers
        });
    }

    async voteForTeam(teamMemberNames) {
        if (this.hasVotedTeam || this.controller.gameOver) return;
        this.hasVotedTeam = true;
        await randomDelay();
        const baseApprove = this.isEvil ? 0.55 : 0.8;
        const adjustedApprove = Math.min(0.95, baseApprove + this.controller.consecutiveRejects * 0.1);
        const vote = Math.random() < adjustedApprove;
        console.log(`🗳️  ${this.name} 對隊伍投下${vote ? '贊成' : '反對'}票`);
        this.socket.emit('teamVote', {
            roomCode: this.roomCode,
            vote
        });
    }

    async voteForMission(teamMemberNames) {
        if (!teamMemberNames.includes(this.name) || this.hasVotedMission || this.controller.gameOver) return;
        this.hasVotedMission = true;
        await randomDelay(150, 350);
        let successChance = 0.93;
        if (this.isEvil) {
            const missionIndex = this.controller.currentMission - 1;
            successChance = missionIndex >= 2 ? 0.35 : 0.55;
        }
        const voteForSuccess = Math.random() < successChance;
        console.log(`🎲  ${this.name} 選擇讓任務${voteForSuccess ? '成功' : '失敗'}`);
        this.socket.emit('missionVote', {
            roomCode: this.roomCode,
            vote: voteForSuccess
        });
    }

    async useLakeLady(targetNames) {
        if (this.controller.gameOver) return;
        if (targetNames.length === 0) {
            console.log(`🏔️  ${this.name} 無可查驗對象`);
            return;
        }
        await randomDelay(200, 400);
        const targetName = targetNames[Math.floor(Math.random() * targetNames.length)];
        console.log(`🏔️  ${this.name} 使用湖中女神查驗 ${targetName}`);
        this.socket.emit('lakeLadySelect', {
            roomCode: this.roomCode,
            targetName
        });
    }

    async confirmLakeLady() {
        if (this.controller.gameOver) return;
        await randomDelay(150, 300);
        this.socket.emit('lakeLadyConfirm', {
            roomCode: this.roomCode
        });
    }

    async performAssassination(targets) {
        if (this.controller.gameOver) return;
        if (!targets.length) return;
        await randomDelay(300, 600);
        // 優先找看似關鍵的角色名稱
        let target = targets.find(t => /梅林|Merlin/.test(t.name));
        if (!target) {
            target = targets[Math.floor(Math.random() * targets.length)];
        }
        console.log(`🗡️  ${this.name} 刺殺指向 ${target.name}`);
        this.socket.emit('assassinate', {
            roomCode: this.roomCode,
            targetId: target.id
        });
    }

    disconnect() {
        if (this.socket.connected) {
            this.socket.disconnect();
        }
    }
}

async function main() {
    const controller = new GameController(ROOM_CODE, PLAYER_NAMES);
    try {
        await controller.start();
        await controller.cleanup();
        console.log('🧹  模擬完成，伺服器與連線已關閉');
    } catch (err) {
        console.error('模擬失敗：', err);
        controller.stopServer();
        process.exitCode = 1;
    }
}

main();

process.on('beforeExit', () => {
    // 確保程式能夠結束，不留下懸掛的計時器
    setTimeout(() => process.exit(0), 50);
});
