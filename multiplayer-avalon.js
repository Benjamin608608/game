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

        document.getElementById('roleSelectionBtn').addEventListener('click', () => {
            this.showRoleSelection();
        });

        document.getElementById('leaveRoomBtn').addEventListener('click', () => {
            this.leaveRoom();
        });

        // 角色選擇操作
        document.getElementById('backToLobbyBtn').addEventListener('click', () => {
            this.showScreen('lobbyScreen');
        });

        document.getElementById('confirmRoleSelectionBtn').addEventListener('click', () => {
            this.startGameWithCustomRoles();
        });

        // 角色選擇計數器
        document.getElementById('servants-plus').addEventListener('click', () => {
            this.adjustRoleCount('servants', 1);
        });
        document.getElementById('servants-minus').addEventListener('click', () => {
            this.adjustRoleCount('servants', -1);
        });
        document.getElementById('minions-plus').addEventListener('click', () => {
            this.adjustRoleCount('minions', 1);
        });
        document.getElementById('minions-minus').addEventListener('click', () => {
            this.adjustRoleCount('minions', -1);
        });

        // 角色複選框
        ['percival', 'morgana', 'oberon'].forEach(role => {
            document.getElementById(`role-${role}`).addEventListener('change', () => {
                this.updateRoleCount();
            });
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

    // 開始遊戲（使用預設角色）
    startGame() {
        if (this.allPlayers.length < 6) {
            this.showMessage('至少需要6名玩家才能開始遊戲', 'error');
            return;
        }

        this.socket.emit('startGame', {
            roomCode: this.roomCode,
            useDefaultRoles: true
        });
    }

    // 顯示角色選擇界面
    showRoleSelection() {
        if (this.allPlayers.length < 6) {
            this.showMessage('至少需要6名玩家才能選擇角色', 'error');
            return;
        }

        this.showScreen('roleSelectionScreen');
        this.initializeRoleSelection();
    }

    // 初始化角色選擇
    initializeRoleSelection() {
        // 重置所有選項
        document.getElementById('servants-count').textContent = '0';
        document.getElementById('minions-count').textContent = '0';
        document.getElementById('role-percival').checked = false;
        document.getElementById('role-morgana').checked = false;
        document.getElementById('role-oberon').checked = false;
        
        this.updateRoleCount();
    }

    // 調整角色數量
    adjustRoleCount(roleType, change) {
        const countElement = document.getElementById(`${roleType}-count`);
        let currentCount = parseInt(countElement.textContent);
        const newCount = Math.max(0, currentCount + change);
        
        // 限制最大數量
        const maxCount = roleType === 'servants' ? 6 : 4;
        if (newCount <= maxCount) {
            countElement.textContent = newCount;
            this.updateRoleCount();
        }
    }

    // 更新角色計數和驗證
    updateRoleCount() {
        const playerCount = this.allPlayers.length;
        
        // 固定角色（必選）
        let goodCount = 1; // 梅林
        let evilCount = 2; // 刺客 + 莫德雷德
        
        // 可選角色
        if (document.getElementById('role-percival').checked) goodCount++;
        if (document.getElementById('role-morgana').checked) evilCount++;
        if (document.getElementById('role-oberon').checked) evilCount++;
        
        // 普通角色
        const servantsCount = parseInt(document.getElementById('servants-count').textContent);
        const minionsCount = parseInt(document.getElementById('minions-count').textContent);
        
        goodCount += servantsCount;
        evilCount += minionsCount;
        
        const totalCount = goodCount + evilCount;
        
        // 更新顯示
        document.getElementById('goodCount').textContent = goodCount;
        document.getElementById('evilCount').textContent = evilCount;
        document.getElementById('finalGoodCount').textContent = goodCount;
        document.getElementById('finalEvilCount').textContent = evilCount;
        document.getElementById('totalSelectedRoles').textContent = totalCount;
        
        // 驗證規則
        const validationMsg = document.getElementById('roleValidationMessage');
        const confirmBtn = document.getElementById('confirmRoleSelectionBtn');
        
        let isValid = true;
        let message = '';
        
        if (totalCount !== playerCount) {
            isValid = false;
            message = `角色總數（${totalCount}）必須等於玩家數量（${playerCount}）`;
        } else if (goodCount < 2 || evilCount < 2) {
            isValid = false;
            message = '好人和壞人陣營都至少需要2人';
        } else if (Math.abs(goodCount - evilCount) > 2) {
            isValid = false;
            message = '好人和壞人數量差距不能超過2人';
        } else if (document.getElementById('role-morgana').checked && !document.getElementById('role-percival').checked) {
            isValid = false;
            message = '如果選擇摩甘娜，建議同時選擇佩西瓦爾';
        }
        
        if (isValid) {
            validationMsg.classList.add('hidden');
            confirmBtn.disabled = false;
        } else {
            validationMsg.classList.remove('hidden');
            validationMsg.textContent = message;
            confirmBtn.disabled = true;
        }
    }

    // 使用自定義角色開始遊戲
    startGameWithCustomRoles() {
        const customRoles = this.getSelectedRoles();
        
        this.socket.emit('startGame', {
            roomCode: this.roomCode,
            useDefaultRoles: false,
            customRoles: customRoles
        });
    }

    // 獲取選中的角色列表
    getSelectedRoles() {
        const roles = [];
        
        // 固定角色
        roles.push('梅林', '刺客', '莫德雷德');
        
        // 可選角色
        if (document.getElementById('role-percival').checked) roles.push('佩西瓦爾');
        if (document.getElementById('role-morgana').checked) roles.push('摩甘娜');
        if (document.getElementById('role-oberon').checked) roles.push('奧伯倫');
        
        // 普通角色
        const servantsCount = parseInt(document.getElementById('servants-count').textContent);
        const minionsCount = parseInt(document.getElementById('minions-count').textContent);
        
        for (let i = 0; i < servantsCount; i++) {
            roles.push('亞瑟的忠臣');
        }
        for (let i = 0; i < minionsCount; i++) {
            roles.push('爪牙');
        }
        
        return roles;
    }

    // 顯示等待大廳
    showLobby() {
        this.showScreen('lobbyScreen');
        document.getElementById('currentRoomCode').textContent = this.roomCode;
        this.updatePlayersList();

        // 顯示/隱藏開始遊戲按鈕
        const startBtn = document.getElementById('startGameBtn');
        const roleSelectionBtn = document.getElementById('roleSelectionBtn');
        const waitingMsg = document.getElementById('waitingMessage');
        
        if (this.isHost) {
            if (this.allPlayers.length >= 6) {
                startBtn.classList.remove('hidden');
                roleSelectionBtn.classList.remove('hidden');
                waitingMsg.textContent = '可以開始遊戲或自定義角色配置';
            } else {
                startBtn.classList.add('hidden');
                roleSelectionBtn.classList.add('hidden');
                waitingMsg.textContent = `需要至少6名玩家才能開始（當前 ${this.allPlayers.length} 人）`;
            }
        } else {
            startBtn.classList.add('hidden');
            roleSelectionBtn.classList.add('hidden');
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
        
        if (this.playerRole && this.playerRole.specialInfo) {
            roleElement.textContent = this.playerRole.role;
            roleElement.className = `role-display ${this.playerRole.isEvil ? 'role-evil' : 'role-good'}`;
            
            // 顯示角色特殊資訊
            let infoHTML = `<div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 10px 0;">`;
            
            // 特殊知識
            if (this.playerRole.specialInfo.specialKnowledge) {
                infoHTML += `<h4>🔍 特殊資訊</h4><p>${this.playerRole.specialInfo.specialKnowledge}</p>`;
            }
            
            // 已知玩家列表
            if (this.playerRole.specialInfo.knownPlayers && this.playerRole.specialInfo.knownPlayers.length > 0) {
                infoHTML += `<h4>👥 已知身份</h4><ul style="list-style: none; padding: 0;">`;
                this.playerRole.specialInfo.knownPlayers.forEach(player => {
                    infoHTML += `<li style="background: rgba(255,255,255,0.1); margin: 5px 0; padding: 8px; border-radius: 4px;">
                        <strong>${player.name}</strong> - ${player.info}
                    </li>`;
                });
                infoHTML += `</ul>`;
            }
            
            // 指示說明
            if (this.playerRole.specialInfo.instructions) {
                infoHTML += `<h4>📋 遊戲提示</h4><p style="font-style: italic; color: #ffd700;">${this.playerRole.specialInfo.instructions}</p>`;
            }
            
            infoHTML += `</div>`;
            roleInfoElement.innerHTML = infoHTML;
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
            
            // 根據當前玩家的角色顯示不同的視覺提示
            let playerDisplayName = player.name;
            let specialIndicator = '';
            let specialClass = '';
            
            if (this.playerRole && this.playerRole.specialInfo && this.playerRole.specialInfo.knownPlayers) {
                const knownPlayer = this.playerRole.specialInfo.knownPlayers.find(kp => kp.name === player.name);
                if (knownPlayer) {
                    if (knownPlayer.info.includes('邪惡')) {
                        specialIndicator = ' 👹';
                        specialClass = ' known-evil';
                        playerElement.style.borderLeft = '4px solid #f44336';
                        playerElement.style.background = 'rgba(244, 67, 54, 0.1)';
                    } else if (knownPlayer.info.includes('梅林') || knownPlayer.info.includes('摩甘娜')) {
                        specialIndicator = ' ✨';
                        specialClass = ' known-magic';
                        playerElement.style.borderLeft = '4px solid #9c27b0';
                        playerElement.style.background = 'rgba(156, 39, 176, 0.1)';
                    } else if (knownPlayer.info.includes('夥伴')) {
                        specialIndicator = ' ⚔️';
                        specialClass = ' known-ally';
                        playerElement.style.borderLeft = '4px solid #ff5722';
                        playerElement.style.background = 'rgba(255, 87, 34, 0.1)';
                    }
                    
                    // 添加tooltip顯示詳細信息
                    playerElement.title = knownPlayer.info;
                }
            }
            
            if (player.isHost) {
                playerDisplayName += ' 👑';
            }
            
            const knownPlayerInfo = this.playerRole && this.playerRole.specialInfo && this.playerRole.specialInfo.knownPlayers ? 
                this.playerRole.specialInfo.knownPlayers.find(kp => kp.name === player.name) : null;
            
            playerElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${playerDisplayName}${specialIndicator}</span>
                    ${knownPlayerInfo ? `<small style="opacity: 0.7; font-size: 0.8em;">${knownPlayerInfo.info}</small>` : ''}
                </div>
            `;
            
            playerElement.className += specialClass;
            otherPlayersList.appendChild(playerElement);
        });
        
        // 如果沒有已知玩家，顯示提示
        if (this.playerRole && this.playerRole.specialInfo && 
            this.playerRole.specialInfo.knownPlayers && 
            this.playerRole.specialInfo.knownPlayers.length === 0) {
            
            const noInfoElement = document.createElement('div');
            noInfoElement.style.cssText = 'text-align: center; padding: 15px; opacity: 0.7; font-style: italic;';
            
            if (this.playerRole.role === '奧伯倫') {
                noInfoElement.textContent = '你不知道任何其他角色的身份';
            } else if (this.playerRole.role === '亞瑟的忠臣') {
                noInfoElement.textContent = '觀察其他玩家的行為來推理身份';
            }
            
            if (noInfoElement.textContent) {
                otherPlayersList.appendChild(noInfoElement);
            }
        }
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
        if (!this.playerRole || !this.playerRole.specialInfo) return;
        
        let modalContent = `<div style="background: white; color: #333; padding: 30px; border-radius: 15px; max-width: 500px; max-height: 80vh; overflow-y: auto;">`;
        
        // 角色標題
        const roleColor = this.playerRole.isEvil ? '#f44336' : '#4CAF50';
        modalContent += `<h2 style="color: ${roleColor}; text-align: center; margin-bottom: 20px;">
            ${this.playerRole.role} (${this.playerRole.isEvil ? '邪惡陣營' : '好人陣營'})
        </h2>`;
        
        // 特殊知識
        if (this.playerRole.specialInfo.specialKnowledge) {
            modalContent += `<div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3>🔍 特殊資訊</h3>
                <p>${this.playerRole.specialInfo.specialKnowledge}</p>
            </div>`;
        }
        
        // 已知玩家
        if (this.playerRole.specialInfo.knownPlayers && this.playerRole.specialInfo.knownPlayers.length > 0) {
            modalContent += `<div style="background: #f0f0f0; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3>👥 已知身份</h3>`;
            
            this.playerRole.specialInfo.knownPlayers.forEach(player => {
                modalContent += `<div style="background: white; margin: 8px 0; padding: 10px; border-radius: 5px; border-left: 4px solid ${roleColor};">
                    <strong>${player.name}</strong> - ${player.info}
                </div>`;
            });
            
            modalContent += `</div>`;
        }
        
        // 遊戲指示
        if (this.playerRole.specialInfo.instructions) {
            modalContent += `<div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                <h3>📋 遊戲提示</h3>
                <p style="font-style: italic;">${this.playerRole.specialInfo.instructions}</p>
            </div>`;
        }
        
        modalContent += `<button onclick="this.parentElement.parentElement.style.display='none'" 
                        style="background: #2196F3; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; display: block; margin: 20px auto 0;">
                        確認
                    </button></div>`;
        
        // 創建模態窗口
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
            background: rgba(0,0,0,0.8); z-index: 1000; display: flex; 
            justify-content: center; align-items: center;
        `;
        modal.innerHTML = modalContent;
        
        // 點擊外部關閉
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        document.body.appendChild(modal);
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
