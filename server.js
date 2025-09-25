const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// 遊戲房間存儲
const rooms = new Map();

// 玩家資訊存儲
const players = new Map();

// 提供靜態文件
app.use(express.static(path.join(__dirname, '.')));

// 主路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 健康檢查端點
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: '阿瓦隆遊戲伺服器運行正常',
        rooms: rooms.size,
        players: players.size,
        timestamp: new Date().toISOString()
    });
});

// 根據人數獲取角色配置
function getRoleConfiguration(playerCount) {
    const configs = {
        6: { merlin: 1, mordred: 1, percival: 1, assassin: 1, minions: 1, servants: 1, failsRequired: [1,1,1,1,1] },
        7: { merlin: 1, mordred: 1, percival: 1, assassin: 1, minions: 1, servants: 2, failsRequired: [1,1,1,1,1] },
        8: { merlin: 1, mordred: 1, percival: 1, assassin: 1, minions: 2, servants: 2, failsRequired: [1,1,1,2,1] },
        9: { merlin: 1, mordred: 1, percival: 1, assassin: 1, minions: 2, servants: 3, failsRequired: [1,1,1,2,1] },
        10: { merlin: 1, mordred: 1, percival: 1, assassin: 1, minions: 3, servants: 3, failsRequired: [1,1,1,2,1] },
        11: { merlin: 1, mordred: 1, percival: 1, assassin: 1, morgana: 1, minions: 2, servants: 4, failsRequired: [1,1,1,2,1] },
        12: { merlin: 1, mordred: 1, percival: 1, assassin: 1, morgana: 1, oberon: 1, minions: 2, servants: 4, failsRequired: [1,1,1,2,1] }
    };
    return configs[playerCount];
}

// 獲取任務所需人數
function getMissionPlayerCount(playerCount, mission) {
    const missionConfigs = {
        6: [2,3,4,3,4],
        7: [2,3,3,4,4],
        8: [3,4,4,5,5],
        9: [3,4,4,5,5],
        10: [3,4,4,5,5],
        11: [3,4,4,5,5],
        12: [3,4,4,5,5]
    };
    return missionConfigs[playerCount][mission - 1];
}

// 分配角色
function assignRoles(playerCount) {
    const config = getRoleConfiguration(playerCount);
    let roleList = [];

    // 添加角色到列表
    roleList.push('梅林');
    roleList.push('刺客');
    roleList.push('莫德雷德');
    roleList.push('佩西瓦爾');

    // 根據配置添加其他角色
    for (let i = 0; i < config.minions; i++) {
        roleList.push('爪牙');
    }
    for (let i = 0; i < config.servants; i++) {
        roleList.push('亞瑟的忠臣');
    }

    if (config.morgana) roleList.push('摩甘娜');
    if (config.oberon) roleList.push('奧伯倫');

    // 洗牌分配
    return shuffleArray(roleList);
}

// 洗牌算法
function shuffleArray(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

// 判斷是否為邪惡角色
function isEvilRole(role) {
    return ['莫德雷德', '刺客', '摩甘娜', '爪牙', '奧伯倫'].includes(role);
}

// Socket.IO 連接處理
io.on('connection', (socket) => {
    console.log('玩家連接:', socket.id);

    // 創建房間
    socket.on('createRoom', (data) => {
        const { playerName, roomCode } = data;
        
        if (rooms.has(roomCode)) {
            socket.emit('error', { message: '房間號已存在，請選擇其他房間號' });
            return;
        }

        const room = {
            id: roomCode,
            hostId: socket.id,
            players: new Map(),
            gameState: 'waiting', // waiting, playing, finished
            gameData: null
        };

        // 添加房主到房間
        room.players.set(socket.id, {
            id: socket.id,
            name: playerName,
            isHost: true,
            role: null
        });

        rooms.set(roomCode, room);
        players.set(socket.id, { roomCode, playerName });

        socket.join(roomCode);
        socket.emit('roomCreated', { 
            roomCode, 
            isHost: true,
            players: Array.from(room.players.values())
        });

        console.log(`房間 ${roomCode} 創建成功，房主：${playerName}`);
    });

    // 加入房間
    socket.on('joinRoom', (data) => {
        const { playerName, roomCode } = data;
        
        const room = rooms.get(roomCode);
        if (!room) {
            socket.emit('error', { message: '房間不存在' });
            return;
        }

        if (room.gameState === 'playing') {
            socket.emit('error', { message: '遊戲已開始，無法加入' });
            return;
        }

        if (room.players.size >= 12) {
            socket.emit('error', { message: '房間已滿（最多12人）' });
            return;
        }

        // 檢查玩家名稱是否重複
        const existingNames = Array.from(room.players.values()).map(p => p.name);
        if (existingNames.includes(playerName)) {
            socket.emit('error', { message: '玩家名稱已存在' });
            return;
        }

        // 添加玩家到房間
        room.players.set(socket.id, {
            id: socket.id,
            name: playerName,
            isHost: false,
            role: null
        });

        players.set(socket.id, { roomCode, playerName });
        socket.join(roomCode);

        const playersList = Array.from(room.players.values());
        
        // 通知所有房間內的玩家
        io.to(roomCode).emit('playerJoined', {
            players: playersList,
            newPlayer: playerName
        });

        socket.emit('roomJoined', { 
            roomCode,
            isHost: false,
            players: playersList
        });

        console.log(`${playerName} 加入房間 ${roomCode}`);
    });

    // 開始遊戲
    socket.on('startGame', (data) => {
        const { roomCode } = data;
        const room = rooms.get(roomCode);

        if (!room || room.hostId !== socket.id) {
            socket.emit('error', { message: '只有房主可以開始遊戲' });
            return;
        }

        const playerCount = room.players.size;
        if (playerCount < 6) {
            socket.emit('error', { message: '至少需要6名玩家才能開始遊戲' });
            return;
        }

        // 分配角色
        const roles = assignRoles(playerCount);
        const playersArray = Array.from(room.players.values());
        
        // 為每個玩家分配角色
        playersArray.forEach((player, index) => {
            player.role = roles[index];
            player.isEvil = isEvilRole(roles[index]);
        });

        // 更新遊戲狀態
        room.gameState = 'playing';
        room.gameData = {
            currentPhase: 'roleReveal',
            currentMission: 1,
            currentLeader: 0,
            selectedPlayers: [],
            missionResults: [],
            votes: [],
            consecutiveRejects: 0
        };

        // 通知所有玩家遊戲開始
        room.players.forEach((player, socketId) => {
            io.to(socketId).emit('gameStarted', {
                playerInfo: {
                    name: player.name,
                    role: player.role,
                    isEvil: player.isEvil
                },
                gameData: room.gameData,
                allPlayers: playersArray.map(p => ({
                    id: p.id,
                    name: p.name,
                    isHost: p.isHost
                }))
            });
        });

        console.log(`房間 ${roomCode} 遊戲開始，${playerCount} 名玩家`);
    });

    // 遊戲動作處理
    socket.on('gameAction', (data) => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;

        const room = rooms.get(playerInfo.roomCode);
        if (!room || room.gameState !== 'playing') return;

        // 這裡處理各種遊戲動作，如投票、選擇隊員等
        // 具體實現會在前端 JavaScript 中處理並同步
        io.to(playerInfo.roomCode).emit('gameAction', {
            playerId: socket.id,
            playerName: playerInfo.playerName,
            action: data
        });
    });

    // 斷線處理
    socket.on('disconnect', () => {
        const playerInfo = players.get(socket.id);
        if (playerInfo) {
            const room = rooms.get(playerInfo.roomCode);
            if (room) {
                room.players.delete(socket.id);
                
                // 如果房主離開且還有其他玩家，轉移房主權限
                if (room.hostId === socket.id && room.players.size > 0) {
                    const newHost = room.players.values().next().value;
                    newHost.isHost = true;
                    room.hostId = newHost.id;
                    
                    io.to(playerInfo.roomCode).emit('hostChanged', {
                        newHostId: newHost.id,
                        newHostName: newHost.name
                    });
                }

                // 通知其他玩家
                io.to(playerInfo.roomCode).emit('playerLeft', {
                    playerId: socket.id,
                    playerName: playerInfo.playerName,
                    players: Array.from(room.players.values())
                });

                // 如果房間空了，刪除房間
                if (room.players.size === 0) {
                    rooms.delete(playerInfo.roomCode);
                }
            }
            players.delete(socket.id);
        }
        console.log('玩家離線:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`阿瓦隆多人遊戲伺服器運行在端口 ${PORT}`);
    console.log(`訪問 http://localhost:${PORT} 開始遊戲`);
});