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
    roleList.push('派希維爾');

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

// 獲取角色特定資訊
function getRoleSpecificInfo(currentPlayer, allPlayers, showMordredIdentity = false) {
    const roleInfo = {
        knownPlayers: [],
        specialKnowledge: '',
        instructions: ''
    };

    switch (currentPlayer.role) {
        case '梅林':
            // 梅林知道所有邪惡角色（除了莫德雷德）
            roleInfo.knownPlayers = allPlayers
                .filter(p => p.isEvil && p.role !== '莫德雷德' && p.id !== currentPlayer.id)
                .map(p => ({ name: p.name, info: '邪惡角色' }));
            roleInfo.specialKnowledge = `你知道以下邪惡角色：${roleInfo.knownPlayers.map(p => p.name).join(', ')}`;
            roleInfo.instructions = '⚠️ 注意：莫德雷德對你是隐形的！必須隱藏身份避免被刺客發現！';
            break;

        case '派希維爾':
            // 派希維爾看到梅林和摩甘娜，但不知道誰是誰
            const merlinAndMorgana = allPlayers.filter(p => 
                (p.role === '梅林' || p.role === '摩甘娜') && p.id !== currentPlayer.id
            );
            roleInfo.knownPlayers = merlinAndMorgana.map(p => ({ 
                name: p.name, 
                info: '梅林或摩甘娜' 
            }));
            roleInfo.specialKnowledge = `你看到以下法師：${roleInfo.knownPlayers.map(p => p.name).join(', ')}`;
            roleInfo.instructions = '🔍 其中一個是梅林，另一個可能是摩甘娜。保護真正的梅林！';
            break;

        case '刺客':
        case '莫德雷德':
        case '摩甘娜':
        case '爪牙':
            // 邪惡角色（除了奧伯倫）彼此知道
            const evilAllies = allPlayers.filter(p => p.isEvil && p.role !== '奧伯倫' && p.id !== currentPlayer.id);
            
            if (showMordredIdentity) {
                // 如果啟用顯示莫德雷德身份，顯示具體角色
                roleInfo.knownPlayers = evilAllies.map(p => ({ 
                    name: p.name, 
                    info: p.role === '莫德雷德' ? `邪惡夥伴 (莫德雷德)` : '邪惡夥伴' 
                }));
            } else {
                // 只顯示是邪惡夥伴，不顯示具體身份
                roleInfo.knownPlayers = evilAllies.map(p => ({ 
                    name: p.name, 
                    info: '邪惡夥伴' 
                }));
            }
            
            roleInfo.specialKnowledge = `你的邪惡夥伴：${roleInfo.knownPlayers.map(p => p.name).join(', ')}`;
            
            if (currentPlayer.role === '刺客') {
                roleInfo.instructions = '🗡️ 破壞任務，如果好人完成3個任務，你可以刺殺梅林獲勝！';
            } else if (currentPlayer.role === '莫德雷德') {
                roleInfo.instructions = '👑 你對梅林是隐形的，利用這個優勢偽裝成好人！';
            } else if (currentPlayer.role === '摩甘娜') {
                roleInfo.instructions = '🔮 派希維爾會看到你，以為你是梅林。混淆他的判斷！';
            } else {
                roleInfo.instructions = '⚔️ 協助破壞任務，隱藏身份！';
            }
            break;

        case '奧伯倫':
            // 奧伯倫不知道其他邪惡角色，其他邪惡角色也不知道奧伯倫
            roleInfo.knownPlayers = [];
            roleInfo.specialKnowledge = '你不知道其他邪惡角色的身份';
            roleInfo.instructions = '🌙 獨立作戰！其他邪惡角色不知道你的身份，你也不知道他們。小心破壞任務！';
            break;

        case '亞瑟的忠臣':
            // 普通好人沒有特殊資訊
            roleInfo.knownPlayers = [];
            roleInfo.specialKnowledge = '你沒有特殊能力';
            roleInfo.instructions = '⚡ 觀察其他玩家的行為，推理出邪惡角色。保護梅林，完成任務！';
            break;

        default:
            roleInfo.knownPlayers = [];
            roleInfo.specialKnowledge = '未知角色';
            roleInfo.instructions = '';
    }

    return roleInfo;
}

// 驗證自定義角色配置
function validateCustomRoles(roles) {
    const goodRoles = ['梅林', '派希維爾', '亞瑟的忠臣'];
    const evilRoles = ['刺客', '莫德雷德', '摩甘娜', '爪牙', '奧伯倫'];
    
    // 檢查角色有效性
    for (const role of roles) {
        if (!goodRoles.includes(role) && !evilRoles.includes(role)) {
            return { valid: false, message: `無效角色：${role}` };
        }
    }
    
    // 計算好壞人數量
    const goodCount = roles.filter(role => goodRoles.includes(role)).length;
    const evilCount = roles.filter(role => evilRoles.includes(role)).length;
    
    // 檢查陣營平衡
    if (goodCount < 1 || evilCount < 1) {
        return { valid: false, message: '好人和壞人陣營都至少需要1人' };
    }
    
    if (Math.abs(goodCount - evilCount) > 3) {
        return { valid: false, message: '好人和壞人數量差距不能超過3人' };
    }
    
    // 檢查刺客和梅林的組合
    if (roles.includes('刺客') && !roles.includes('梅林')) {
        return { valid: false, message: '如果選擇刺客，必須同時選擇梅林' };
    }
    
    // 檢查角色組合合理性
    const hasMorgana = roles.includes('摩甘娜');
    const hasPercival = roles.includes('派希維爾');
    
    if (hasMorgana && !hasPercival) {
        return { valid: false, message: '如果選擇摩甘娜，建議同時選擇派希維爾以保持遊戲平衡' };
    }
    
    return { valid: true };
}

// 處理隊伍投票結果
function processTeamVoteResult(room, io) {
    const approveCount = room.gameData.votes.filter(v => v.vote).length;
    const totalVotes = room.gameData.votes.length;
    const approved = approveCount > totalVotes / 2; // 嚴格大於一半
    
    const resultMessage = `隊伍投票結果：贊成 ${approveCount} 票，反對 ${totalVotes - approveCount} 票\n${approved ? '✅ 隊伍通過！' : '❌ 隊伍被拒絕！'}`;
    
    io.to(room.id).emit('voteResult', {
        message: resultMessage,
        success: approved
    });
    
    if (approved) {
        // 隊伍通過，開始任務投票
        room.gameData.currentPhase = 'missionVote';
        room.gameData.votes = [];
        room.gameData.consecutiveRejects = 0;
        
        // 通知被選中的隊員進行任務投票
        const teamMembers = room.gameData.selectedPlayers.map(playerId => {
            const player = room.players.get(playerId);
            return player ? player.name : '';
        }).filter(name => name);
        
        io.to(room.id).emit('missionVotingStart', {
            teamSize: room.gameData.selectedPlayers.length
        });
        
    } else {
        // 隊伍被拒絕
        room.gameData.consecutiveRejects++;
        
        if (room.gameData.consecutiveRejects >= 5) {
            // 連續5次拒絕，邪惡陣營勝利
            endGame(room, io, false, '⚠️ 連續5次拒絕隊伍，邪惡陣營勝利！');
            return;
        }
        
        // 轉到下一個隊長
        nextLeader(room);
        room.gameData.currentPhase = 'teamSelection';
        room.gameData.selectedPlayers = [];
        room.gameData.votes = [];
    }
}

// 處理任務投票結果
function processMissionVoteResult(room, io) {
    const failCount = room.gameData.votes.filter(v => !v.vote).length;
    const config = getRoleConfiguration(room.players.size);
    const requiredFails = config.failsRequired[room.gameData.currentMission - 1];
    const missionSuccess = failCount < requiredFails;
    
    const resultMessage = `任務 ${room.gameData.currentMission} 結果：\n失敗票數：${failCount}\n需要失敗票數：${requiredFails}\n${missionSuccess ? '✅ 任務成功！' : '❌ 任務失敗！'}`;
    
    io.to(room.id).emit('voteResult', {
        message: resultMessage,
        success: missionSuccess
    });
    
    room.gameData.missionResults.push(missionSuccess);
    
    if (missionSuccess) {
        const successCount = room.gameData.missionResults.filter(r => r).length;
        if (successCount >= 3) {
            // 好人陣營完成3個任務，進入刺殺階段
            io.to(room.id).emit('voteResult', {
                message: '🎉 好人陣營完成了3個任務！\n⚔️ 進入刺殺階段...',
                success: true
            });
            room.gameData.currentPhase = 'assassination';
            return;
        }
    } else {
        const failCount = room.gameData.missionResults.filter(r => !r).length;
        if (failCount >= 3) {
            // 邪惡陣營破壞3個任務，遊戲結束
            endGame(room, io, false, '💀 邪惡陣營破壞了3個任務，邪惡陣營勝利！');
            return;
        }
    }
    
    // 檢查是否需要湖中女神
    if (shouldUseLakeLady(room)) {
        startLakeLady(room, io);
    } else {
        nextMission(room, io);
    }
}

// 檢查是否應該使用湖中女神
function shouldUseLakeLady(room) {
    if (!room.gameData.enableLakeLady) return false;
    if (room.gameData.lakeLadyUsed.includes(room.gameData.currentMission)) return false;
    
    // 從任務2結束後，每次任務完成都會觸發湖中女神
    return room.gameData.currentMission >= 2 && room.gameData.currentMission <= 5;
}

// 開始湖中女神階段
function startLakeLady(room, io) {
    room.gameData.currentPhase = 'lakeLady';
    
    // 湖中女神持有者在遊戲開始時就已經設定（第一個隊長的前一位）
    const holderPlayer = room.players.get(room.gameData.lakeLadyHolder);
    const availableTargets = Array.from(room.players.values())
        .filter(p => p.id !== room.gameData.lakeLadyHolder)
        .map(p => p.name);
    
    io.to(room.id).emit('lakeLadyStart', {
        holderName: holderPlayer.name,
        availableTargets: availableTargets
    });
}

// 湖中女神後繼續遊戲
function continueGameAfterLakeLady(room, io) {
    // 將湖中女神轉移給被查看的玩家（如果還有後續任務）
    // 這裡先保持原持有者，具體轉移邏輯可以後續完善
    nextMission(room, io);
}

// 下一個任務
function nextMission(room, io) {
    room.gameData.currentMission++;
    nextLeader(room);
    room.gameData.currentPhase = 'teamSelection';
    room.gameData.selectedPlayers = [];
    room.gameData.votes = [];
}

// 下一個隊長
function nextLeader(room) {
    const playersArray = Array.from(room.players.keys());
    const currentIndex = playersArray.indexOf(room.gameData.currentLeader);
    room.gameData.currentLeader = playersArray[(currentIndex + 1) % playersArray.length];
}

// 結束遊戲
function endGame(room, io, goodWins, message) {
    room.gameState = 'finished';
    
    io.to(room.id).emit('gameEnded', {
        goodWins: goodWins,
        message: message,
        roles: Array.from(room.players.values()).map(p => ({
            name: p.name,
            role: p.role
        }))
    });
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
        const { roomCode, useDefaultRoles, customRoles, enableLakeLady, showMordredIdentity } = data;
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
        let roles;
        if (useDefaultRoles) {
            roles = assignRoles(playerCount);
        } else {
            // 驗證自定義角色
            if (!customRoles || customRoles.length !== playerCount) {
                socket.emit('error', { message: '自定義角色配置無效' });
                return;
            }
            
            // 驗證角色合理性
            const validation = validateCustomRoles(customRoles);
            if (!validation.valid) {
                socket.emit('error', { message: validation.message });
                return;
            }
            
            roles = shuffleArray([...customRoles]);
        }
        
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
            currentLeader: null,
            selectedPlayers: [],
            missionResults: [],
            votes: [],
            consecutiveRejects: 0,
            enableLakeLady: enableLakeLady !== false,
            showMordredIdentity: showMordredIdentity === true,
            lakeLadyHolder: null,
            lakeLadyUsed: [],
            playersOrder: playersArray.map(p => p.id) // 保存玩家順序
        };

        // 通知所有玩家遊戲開始，為每個角色提供相應的資訊
        room.players.forEach((player, socketId) => {
            const roleInfo = getRoleSpecificInfo(player, playersArray, room.gameData.showMordredIdentity);
            
            io.to(socketId).emit('gameStarted', {
                playerInfo: {
                    name: player.name,
                    role: player.role,
                    isEvil: player.isEvil,
                    specialInfo: roleInfo
                },
                gameData: room.gameData,
                allPlayers: playersArray.map(p => ({
                    id: p.id,
                    name: p.name,
                    isHost: p.isHost
                }))
            });
        });

        // 初始化角色確認狀態
        room.gameData.roleConfirmations = new Set();
        
        console.log(`房間 ${roomCode} 遊戲開始，${playerCount} 名玩家`);
    });

    // 角色確認
    socket.on('roleConfirmed', (data) => {
        const { roomCode } = data;
        const room = rooms.get(roomCode);
        const playerInfo = players.get(socket.id);
        
        if (!room || !playerInfo || room.gameData.currentPhase !== 'roleReveal') return;
        
        // 記錄玩家已確認角色
        room.gameData.roleConfirmations.add(socket.id);
        
        console.log(`${playerInfo.playerName} 確認了角色，已確認：${room.gameData.roleConfirmations.size}/${room.players.size}`);
        
        // 檢查是否所有玩家都確認了角色
        if (room.gameData.roleConfirmations.size === room.players.size) {
            // 所有玩家都確認了角色，進入隊長選擇階段
            room.gameData.currentPhase = 'leaderSelection';
            
            io.to(roomCode).emit('startLeaderSelection');
            console.log(`房間 ${roomCode} 所有玩家確認角色完成，開始隊長選擇`);
        }
    });

    // 隊伍投票
    socket.on('teamVote', (data) => {
        const { roomCode, vote } = data;
        const room = rooms.get(roomCode);
        const playerInfo = players.get(socket.id);
        
        if (!room || !playerInfo || room.gameData.currentPhase !== 'teamVote') return;
        
        // 記錄投票
        room.gameData.votes.push({ playerId: socket.id, vote });
        
        // 通知投票更新
        io.to(roomCode).emit('voteUpdate', {
            voteType: 'team',
            currentCount: room.gameData.votes.length,
            totalCount: room.players.size
        });
        
        // 檢查是否所有人都投票了
        if (room.gameData.votes.length === room.players.size) {
            processTeamVoteResult(room, io);
        }
    });

    // 任務投票
    socket.on('missionVote', (data) => {
        const { roomCode, vote } = data;
        const room = rooms.get(roomCode);
        const playerInfo = players.get(socket.id);
        
        if (!room || !playerInfo || room.gameData.currentPhase !== 'missionVote') return;
        
        // 檢查玩家是否在隊伍中
        if (!room.gameData.selectedPlayers.includes(socket.id)) return;
        
        // 記錄投票
        room.gameData.votes.push({ playerId: socket.id, vote });
        
        // 通知投票更新
        io.to(roomCode).emit('voteUpdate', {
            voteType: 'mission',
            currentCount: room.gameData.votes.length,
            totalCount: room.gameData.selectedPlayers.length
        });
        
        // 檢查是否所有隊員都投票了
        if (room.gameData.votes.length === room.gameData.selectedPlayers.length) {
            processMissionVoteResult(room, io);
        }
    });

    // 湖中女神選擇
    socket.on('lakeLadySelect', (data) => {
        const { roomCode, targetName } = data;
        const room = rooms.get(roomCode);
        const playerInfo = players.get(socket.id);
        
        if (!room || !playerInfo || room.gameData.currentPhase !== 'lakeLady') return;
        if (room.gameData.lakeLadyHolder !== socket.id) return;
        
        const targetPlayer = Array.from(room.players.values()).find(p => p.name === targetName);
        if (!targetPlayer) return;
        
        // 發送結果給湖中女神持有者
        io.to(socket.id).emit('lakeLadyResult', {
            holderName: playerInfo.playerName,
            targetName: targetName,
            isEvil: targetPlayer.isEvil
        });
        
        // 通知其他玩家
        socket.broadcast.to(roomCode).emit('lakeLadyResult', {
            holderName: playerInfo.playerName,
            targetName: targetName,
            isEvil: null // 其他玩家不知道結果
        });
        
        room.gameData.lakeLadyUsed.push(room.gameData.currentMission);
    });

    // 確認隊長選擇
    socket.on('confirmLeader', (data) => {
        const { roomCode, leaderId } = data;
        const room = rooms.get(roomCode);
        
        if (!room || room.hostId !== socket.id) return;
        
        // 設定第一個隊長
        room.gameData.currentLeader = leaderId;
        room.gameData.currentPhase = 'teamSelection';
        
        // 設定湖中女神持有者為隊長的前一個位置
        const playerOrder = room.gameData.playersOrder;
        const leaderIndex = playerOrder.indexOf(leaderId);
        const lakeLadyIndex = (leaderIndex - 1 + playerOrder.length) % playerOrder.length;
        room.gameData.lakeLadyHolder = playerOrder[lakeLadyIndex];
        
        console.log(`玩家順序：${playerOrder.map(id => room.players.get(id)?.name).join(' -> ')}`);
        console.log(`隊長位置：${leaderIndex}，湖中女神位置：${lakeLadyIndex}`);
        
        const leaderPlayer = room.players.get(leaderId);
        const lakeLadyPlayer = room.players.get(room.gameData.lakeLadyHolder);
        
        // 通知所有玩家隊長選擇結果
        io.to(roomCode).emit('leaderSelected', {
            leaderId: leaderId,
            leaderName: leaderPlayer.name,
            lakeLadyHolder: room.gameData.lakeLadyHolder,
            lakeLadyHolderName: lakeLadyPlayer.name
        });
        
        console.log(`房間 ${roomCode} 隊長：${leaderPlayer.name}，湖中女神持有者：${lakeLadyPlayer.name}`);
    });

    // 湖中女神確認
    socket.on('lakeLadyConfirm', (data) => {
        const { roomCode } = data;
        const room = rooms.get(roomCode);
        
        if (!room || room.gameData.currentPhase !== 'lakeLady') return;
        
        // 轉移湖中女神給被查看的玩家（如果還有後續任務）
        // 繼續遊戲流程
        continueGameAfterLakeLady(room, io);
    });

    // 確認隊伍
    socket.on('confirmTeam', (data) => {
        const { roomCode, teamMembers } = data;
        const room = rooms.get(roomCode);
        const playerInfo = players.get(socket.id);
        
        if (!room || !playerInfo || room.gameData.currentPhase !== 'teamSelection') return;
        if (room.gameData.currentLeader !== socket.id) return;
        
        // 設定選中的隊員
        room.gameData.selectedPlayers = teamMembers;
        room.gameData.currentPhase = 'teamVote';
        room.gameData.votes = [];
        
        // 獲取隊員名字
        const teamMemberNames = teamMembers.map(memberId => {
            const player = room.players.get(memberId);
            return player ? player.name : '';
        }).filter(name => name);
        
        // 通知所有玩家開始隊伍投票
        io.to(roomCode).emit('teamVotingStart', {
            teamMembers: teamMemberNames
        });
        
        console.log(`房間 ${roomCode} 隊伍確認：${teamMemberNames.join(', ')}`);
    });

    // 遊戲動作處理
    socket.on('gameAction', (data) => {
        const playerInfo = players.get(socket.id);
        if (!playerInfo) return;

        const room = rooms.get(playerInfo.roomCode);
        if (!room || room.gameState !== 'playing') return;

        // 這裡處理各種遊戲動作，如選擇隊員等
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