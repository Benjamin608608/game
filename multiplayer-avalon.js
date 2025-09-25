// 多人阿瓦隆遊戲客戶端
class MultiplayerAvalonGame {
    constructor() {
        this.socket = io();
        this.playerName = '';
        this.roomCode = '';
        this.isHost = false;
        this.playerRole = null;
        this.gameData = null;
        this.allPlayers = [];
        this.currentScreen = 'nameScreen';

        this.initializeEventListeners();
        this.initializeSocketListeners();
    }

    // 初始化界面事件監聽器
    initializeEventListeners() {
        // 用戶名確認
        document.getElementById('nameConfirmBtn').addEventListener('click', () => {
            this.confirmPlayerName();
        });

        document.getElementById('playerName').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.confirmPlayerName();
        });

        // 房間選擇
        document.getElementById('createRoomBtn').addEventListener('click', () => {
            this.showScreen('createRoomScreen');
        });

        document.getElementById('joinRoomBtn').addEventListener('click', () => {
            this.showScreen('joinRoomScreen');
        });

        // 創建房間
        document.getElementById('createConfirmBtn').addEventListener('click', () => {
            this.createRoom();
        });

        document.getElementById('newRoomCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createRoom();
        });

        document.getElementById('backFromCreateBtn').addEventListener('click', () => {
            this.showScreen('roomScreen');
        });

        // 加入房間
        document.getElementById('joinConfirmBtn').addEventListener('click', () => {
            this.joinRoom();
        });

        document.getElementById('joinRoomCode').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.joinRoom();
        });

        document.getElementById('backFromJoinBtn').addEventListener('click', () => {
            this.showScreen('roomScreen');
        });

        // 大廳操作
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });

        // 遊戲中操作
        document.getElementById('viewRoleBtn').addEventListener('click', () => {
            this.showRoleDetails();
        });

        // 限制房間號只能輸入數字
        ['newRoomCode', 'joinRoomCode'].forEach(id => {
            document.getElementById(id).addEventListener('input', (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
            });
        });
    }

    // 初始化Socket事件監聽器
    initializeSocketListeners() {
        // 房間創建成功
        this.socket.on('roomCreated', (data) => {
            this.roomCode = data.roomCode;
            this.isHost = data.isHost;
            this.allPlayers = data.players;
            this.showLobby();
            this.showMessage('房間創建成功！', 'success');
        });

        // 房間加入成功
        this.socket.on('roomJoined', (data) => {
            this.roomCode = data.roomCode;
            this.isHost = data.isHost;
            this.allPlayers = data.players;
            this.showLobby();
            this.showMessage('成功加入房間！', 'success');
        });

        // 玩家加入
        this.socket.on('playerJoined', (data) => {
            this.allPlayers = data.players;
            this.updatePlayersList();
            this.showMessage(`${data.newPlayer} 加入了遊戲`, 'success');
        });

        // 玩家離開
        this.socket.on('playerLeft', (data) => {
            this.allPlayers = data.players;
            this.updatePlayersList();
            this.showMessage(`${data.playerName} 離開了遊戲`, 'warning');
        });

        // 房主變更
        this.socket.on('hostChanged', (data) => {
            this.isHost = (this.socket.id === data.newHostId);
            this.allPlayers = this.allPlayers.map(player => ({
                ...player,
                isHost: player.id === data.newHostId
            }));
            this.updatePlayersList();
            this.showMessage(`${data.newHostName} 成為新的房主`, 'success');
        });

        // 遊戲開始
        this.socket.on('gameStarted', (data) => {
            this.playerRole = data.playerInfo;
            this.gameData = data.gameData;
            this.allPlayers = data.allPlayers;
            this.showGameScreen();
            this.showMessage('遊戲開始！', 'success');
        });

        // 遊戲動作
        this.socket.on('gameAction', (data) => {
            this.handleGameAction(data);
        });

        // 錯誤處理
        this.socket.on('error', (data) => {
            this.showMessage(data.message, 'error');
        });

        // 連接錯誤
        this.socket.on('connect_error', () => {
            this.showMessage('連接伺服器失敗，請稍後重試', 'error');
        });

        // 斷線重連
        this.socket.on('disconnect', () => {
            this.showMessage('與伺服器連接中斷', 'error');
        });

        this.socket.on('reconnect', () => {
            this.showMessage('重新連接成功', 'success');
        });
    }

    // 確認玩家名稱
    confirmPlayerName() {
        const nameInput = document.getElementById('playerName');
        const name = nameInput.value.trim();

        if (!name) {
            this.showMessage('請輸入您的名字', 'error');
            return;
        }

        if (name.length > 20) {
            this.showMessage('名字太長，請限制在20個字符內', 'error');
            return;
        }

        this.playerName = name;
        this.showScreen('roomScreen');
    }

    // 創建房間
    createRoom() {
        const roomCodeInput = document.getElementById('newRoomCode');
        const roomCode = roomCodeInput.value.trim();

        if (!roomCode || roomCode.length !== 4 || !/^\d{4}$/.test(roomCode)) {
            this.showMessage('請輸入4位數字的房間號', 'error');
            return;
        }

        this.socket.emit('createRoom', {
            playerName: this.playerName,
            roomCode: roomCode
        });
    }

    // 加入房間
    joinRoom() {
        const roomCodeInput = document.getElementById('joinRoomCode');
        const roomCode = roomCodeInput.value.trim();

        if (!roomCode || roomCode.length !== 4 || !/^\d{4}$/.test(roomCode)) {
            this.showMessage('請輸入4位數字的房間號', 'error');
            return;
        }

        this.socket.emit('joinRoom', {
            playerName: this.playerName,
            roomCode: roomCode
        });
    }

    // 離開房間
    leaveRoom() {
        if (confirm('確定要離開房間嗎？')) {
            this.socket.disconnect();
            location.reload();
        }
    }

    // 開始遊戲
    startGame() {
        if (this.allPlayers.length < 6) {
            this.showMessage('至少需要6名玩家才能開始遊戲', 'error');
            return;
        }

        this.socket.emit('startGame', {
            roomCode: this.roomCode
        });
    }

    // 顯示等待大廳
    showLobby() {
        this.showScreen('lobbyScreen');
        document.getElementById('currentRoomCode').textContent = this.roomCode;
        this.updatePlayersList();

        // 顯示/隱藏開始遊戲按鈕
        const startBtn = document.getElementById('startGameBtn');
        const waitingMsg = document.getElementById('waitingMessage');
        
        if (this.isHost) {
            startBtn.classList.remove('hidden');
            waitingMsg.textContent = `需要至少6名玩家才能開始（當前 ${this.allPlayers.length} 人）`;
        } else {
            startBtn.classList.add('hidden');
            waitingMsg.textContent = '等待房主開始遊戲...';
        }
    }

    // 更新玩家列表
    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        playerCount.textContent = this.allPlayers.length;
        
        playersList.innerHTML = '';
        
        this.allPlayers.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = `player-item ${player.isHost ? 'host' : ''}`;
            
            playerItem.innerHTML = `
                <div class="player-name">${player.name}</div>
                ${player.isHost ? '<div class="host-badge">房主</div>' : ''}
            `;
            
            playersList.appendChild(playerItem);
        });
    }

    // 顯示遊戲畫面
    showGameScreen() {
        this.showScreen('gameScreen');
        
        // 更新玩家資訊
        document.getElementById('myPlayerName').textContent = this.playerName;
        this.updateRoleDisplay();
        this.updateMissionDisplay();
        this.updateOtherPlayers();
        this.updateGameStatus();
    }

    // 更新角色顯示
    updateRoleDisplay() {
        const roleElement = document.getElementById('myRole');
        const roleInfoElement = document.getElementById('roleInfo');
        
        if (this.playerRole) {
            roleElement.textContent = this.playerRole.role;
            roleElement.className = `role-display ${this.playerRole.isEvil ? 'role-evil' : 'role-good'}`;
            
            // 簡單的角色說明
            const roleDescriptions = {
                '梅林': '🧙‍♂️ 知道邪惡角色（除莫德雷德），但要隱藏身份',
                '佩西瓦爾': '🛡️ 知道梅林和摩甘娜，保護真正的梅林',
                '亞瑟的忠臣': '⚡ 普通好人，努力完成任務',
                '刺客': '🗡️ 破壞任務，最後可刺殺梅林',
                '莫德雷德': '👑 隱形邪惡角色，梅林看不到你',
                '摩甘娜': '🔮 偽裝梅林，混淆佩西瓦爾',
                '奧伯倫': '🌙 獨立邪惡角色，其他邪惡角色不知道你',
                '爪牙': '⚔️ 普通邪惡角色，破壞任務'
            };
            
            roleInfoElement.textContent = roleDescriptions[this.playerRole.role] || '';
        }
    }

    // 更新任務顯示
    updateMissionDisplay() {
        // 根據人數更新任務所需人數
        const missionRequirements = {
            6: [2, 3, 4, 3, 4],
            7: [2, 3, 3, 4, 4],
            8: [3, 4, 4, 5, 5],
            9: [3, 4, 4, 5, 5],
            10: [3, 4, 4, 5, 5],
            11: [3, 4, 4, 5, 5],
            12: [3, 4, 4, 5, 5]
        };

        const playerCount = this.allPlayers.length;
        const requirements = missionRequirements[playerCount] || [2, 3, 4, 3, 4];

        for (let i = 1; i <= 5; i++) {
            const statusElement = document.getElementById(`mission${i}Status`);
            if (statusElement) {
                statusElement.textContent = `${requirements[i-1]}人`;
            }
        }
    }

    // 更新其他玩家顯示
    updateOtherPlayers() {
        const otherPlayersList = document.getElementById('otherPlayersList');
        const otherPlayers = this.allPlayers.filter(p => p.name !== this.playerName);
        
        otherPlayersList.innerHTML = '';
        
        otherPlayers.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'other-player';
            playerElement.textContent = player.name;
            
            if (player.isHost) {
                playerElement.innerHTML += ' 👑';
            }
            
            otherPlayersList.appendChild(playerElement);
        });
    }

    // 更新遊戲狀態
    updateGameStatus() {
        const phaseElement = document.getElementById('gamePhase');
        const statusElement = document.getElementById('gameStatus');
        
        if (this.gameData) {
            switch (this.gameData.currentPhase) {
                case 'roleReveal':
                    phaseElement.textContent = '角色確認階段';
                    statusElement.textContent = '請確認您的角色身份';
                    break;
                case 'teamSelection':
                    phaseElement.textContent = `任務 ${this.gameData.currentMission} - 選擇隊伍`;
                    statusElement.textContent = '隊長正在選擇執行任務的隊員';
                    break;
                case 'teamVote':
                    phaseElement.textContent = `任務 ${this.gameData.currentMission} - 投票階段`;
                    statusElement.textContent = '所有玩家對隊伍組成進行投票';
                    break;
                case 'missionVote':
                    phaseElement.textContent = `任務 ${this.gameData.currentMission} - 執行任務`;
                    statusElement.textContent = '被選中的隊員對任務進行投票';
                    break;
                case 'assassination':
                    phaseElement.textContent = '刺殺階段';
                    statusElement.textContent = '刺客選擇刺殺目標';
                    break;
                default:
                    phaseElement.textContent = '遊戲進行中';
                    statusElement.textContent = '請等待其他玩家操作';
            }
        }
    }

    // 顯示角色詳情
    showRoleDetails() {
        if (!this.playerRole) return;
        
        const roleInfos = {
            '梅林': `🧙‍♂️ 梅林 (好人陣營)\n\n能力：知道所有邪惡角色（除了莫德雷德）\n注意：必須隱藏身份，避免被刺客發現！`,
            '佩西瓦爾': `🛡️ 佩西瓦爾 (好人陣營)\n\n能力：知道梅林和摩甘娜，但不知道誰是誰\n任務：保護真正的梅林`,
            '亞瑟的忠臣': `⚡ 亞瑟的忠臣 (好人陣營)\n\n能力：無特殊能力\n目標：完成任務，保護梅林`,
            '刺客': `🗡️ 刺客 (邪惡陣營)\n\n能力：如果好人完成3個任務，可以刺殺梅林獲勝\n目標：破壞任務或找出梅林並刺殺`,
            '莫德雷德': `👑 莫德雷德 (邪惡陣營)\n\n能力：梅林看不到你\n策略：利用隱身優勢，偽裝成好人`,
            '摩甘娜': `🔮 摩甘娜 (邪惡陣營)\n\n能力：佩西瓦爾會看到你，以為你是梅林\n策略：混淆佩西瓦爾，偽裝成梅林`,
            '奧伯倫': `🌙 奧伯倫 (邪惡陣營)\n\n特殊：其他邪惡角色不知道你的身份\n限制：你也不知道其他邪惡角色`,
            '爪牙': `⚔️ 爪牙 (邪惡陣營)\n\n能力：知道其他邪惡角色（除了奧伯倫）\n目標：協助破壞任務`
        };

        const roleInfo = roleInfos[this.playerRole.role] || '未知角色';
        alert(roleInfo);
    }

    // 處理遊戲動作
    handleGameAction(data) {
        // 這裡處理從其他玩家接收到的遊戲動作
        console.log('收到遊戲動作:', data);
        
        // 根據動作類型更新界面
        // 具體實現將根據遊戲進行情況動態添加
    }

    // 顯示消息
    showMessage(message, type = 'info') {
        const messagesContainer = document.getElementById('messages');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        messageElement.textContent = message;
        
        messagesContainer.appendChild(messageElement);
        
        // 自動移除消息
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.parentNode.removeChild(messageElement);
            }
        }, 5000);
    }

    // 顯示指定畫面
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
    }
}

// 初始化遊戲
window.addEventListener('DOMContentLoaded', () => {
    new MultiplayerAvalonGame();
});
