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
        this.selectedTeam = [];
        this.currentVote = null;
        this.lakeLadyTarget = null;
        this.enableLakeLady = true;
        this.lakeLadyHolder = null;
        this.roleConfirmed = false;
        this.isReordering = false;
        this.draggedPlayer = null;

        this.initializeEventListeners();
        this.initializeSocketListeners();
        this.initializeReconnection();
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
        ['merlin', 'percival', 'assassin', 'mordred', 'morgana', 'oberon'].forEach(role => {
            document.getElementById(`role-${role}`).addEventListener('change', () => {
                this.updateRoleCount();
            });
        });

        // 投票按鈕
        document.getElementById('teamApproveBtn').addEventListener('click', () => {
            this.voteForTeam(true);
        });
        document.getElementById('teamRejectBtn').addEventListener('click', () => {
            this.voteForTeam(false);
        });
        document.getElementById('missionSuccessBtn').addEventListener('click', () => {
            this.voteForMission(true);
        });
        document.getElementById('missionFailBtn').addEventListener('click', () => {
            this.voteForMission(false);
        });

        // 湖中女神
        document.getElementById('lakeLadyConfirmBtn').addEventListener('click', () => {
            this.confirmLakeLady();
        });

        // 轉盤抽選
        document.getElementById('spinBtn').addEventListener('click', () => {
            this.spinForLeader();
        });

        document.getElementById('confirmLeaderBtn').addEventListener('click', () => {
            this.confirmLeaderAndStartGame();
        });

        // 玩家順序調整
        document.getElementById('toggleReorderBtn').addEventListener('click', () => {
            this.toggleReorderMode();
        });
        document.getElementById('saveOrderBtn').addEventListener('click', () => {
            this.savePlayerOrder();
        });
        document.getElementById('resetOrderBtn').addEventListener('click', () => {
            this.resetPlayerOrder();
        });

        // 遊戲中操作
        document.getElementById('viewRoleBtn').addEventListener('click', () => {
            this.showRoleDetails();
        });

        // 角色確認按鈕（在角色詳情彈窗中）
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'roleConfirmedBtn') {
                this.confirmRole();
            }
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
            this.updateLobbyButtons(); // 更新按鈕狀態
            this.showMessage(`${data.newPlayer} 加入了遊戲`, 'success');
        });

        // 玩家離開
        this.socket.on('playerLeft', (data) => {
            this.allPlayers = data.players;
            this.updatePlayersList();
            this.updateLobbyButtons(); // 更新按鈕狀態
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
            this.updateLobbyButtons(); // 更新按鈕狀態
            this.showMessage(`${data.newHostName} 成為新的房主`, 'success');
        });

        // 遊戲開始
        this.socket.on('gameStarted', (data) => {
            this.playerRole = data.playerInfo;
            this.gameData = data.gameData;
            this.allPlayers = data.allPlayers;
            this.showGameScreen();
            this.showMessage('遊戲開始！角色已分配', 'success');
            
            // 如果是房主，顯示轉盤抽選隊長
            if (this.isHost) {
                setTimeout(() => {
                    this.showLeaderSelection();
                }, 2000);
            }
        });

        // 隊長選擇完成
        this.socket.on('leaderSelected', (data) => {
            this.gameData.currentLeader = data.leaderId;
            this.gameData.currentPhase = 'teamSelection';
            this.hideAllVotingSections();
            this.updateGameStatus();
            this.updateOtherPlayers(); // 更新玩家顯示，標示隊長
            this.showMessage(`${data.leaderName} 成為第一個隊長！湖中女神持有者：${data.lakeLadyHolderName}`, 'success');
        });

        // 角色確認完成，進入轉盤階段
        this.socket.on('startLeaderSelection', () => {
            if (this.isHost) {
                this.showLeaderSelection();
            } else {
                this.showMessage('房主正在抽選第一個隊長...', 'info');
            }
        });

        // 遊戲動作
        this.socket.on('gameAction', (data) => {
            this.handleGameAction(data);
        });

        // 投票相關事件
        this.socket.on('teamVotingStart', (data) => {
            this.showTeamVoting(data.teamMembers);
        });

        this.socket.on('missionVotingStart', (data) => {
            console.log('收到 missionVotingStart 事件:', data);
            console.log('當前玩家名稱:', this.playerName);
            console.log('隊伍成員:', data.teamMembers);
            
            // 檢查當前玩家是否在執行任務的隊伍中
            if (data.teamMembers && data.teamMembers.includes(this.playerName)) {
                console.log('玩家在隊伍中，顯示任務投票界面');
                this.showMissionVoting(data.teamSize);
            } else {
                console.log('玩家不在隊伍中，隱藏投票界面');
                this.hideAllVotingSections();
                this.showMessage(`執行任務的隊員：${data.teamMembers.join('、')}。等待他們決定任務結果...`, 'info');
            }
        });

        this.socket.on('voteUpdate', (data) => {
            this.updateVoteStatus(data.voteType, data.currentCount, data.totalCount);
        });

        this.socket.on('voteResult', (data) => {
            this.hideAllVotingSections();
            this.showMessage(data.message, data.success ? 'success' : 'error');
            
            // 更新任務軌道顯示
            this.updateMissionDisplay();
            
            // 如果是任務結果，顯示下一個隊長信息
            if (data.nextLeader) {
                setTimeout(() => {
                    this.showMessage(`下一個隊長：${data.nextLeader}`, 'info');
                }, 2000);
            }
        });

        // 玩家順序更新
        this.socket.on('playerOrderUpdated', (data) => {
            this.allPlayers = data.players;
            this.updatePlayersList();
            this.showMessage('玩家順序已更新', 'success');
        });

        // 任務軌道更新
        this.socket.on('missionUpdate', (data) => {
            if (this.gameData) {
                this.gameData.missionResults = data.missionResults;
                this.gameData.currentMission = data.currentMission;
                this.updateMissionDisplay();
            }
        });

        // 遊戲狀態更新
        this.socket.on('gameStateUpdate', (data) => {
            if (this.gameData) {
                this.gameData.currentPhase = data.currentPhase;
                this.gameData.currentMission = data.currentMission;
                this.gameData.currentLeader = data.currentLeader;
                
                // 更新湖中女神持有者
                if (data.lakeLadyHolder) {
                    this.gameData.lakeLadyHolder = data.lakeLadyHolder;
                }
                
                // 清空選擇狀態
                this.selectedTeam = [];
                this.currentVote = null;
                
                // 更新界面
                this.hideAllVotingSections();
                this.updateGameStatus();
                this.updateOtherPlayers();
                this.updateTeamDisplay();
                
                let message = `任務 ${data.currentMission} 開始！隊長：${data.leaderName}`;
                if (data.lakeLadyHolderName) {
                    message += `，湖中女神：${data.lakeLadyHolderName}`;
                }
                this.showMessage(message, 'success');
            }
        });

        // 重連相關事件
        this.socket.on('gameReconnected', (data) => {
            this.playerRole = data.playerInfo;
            this.gameData = data.gameData;
            this.allPlayers = data.allPlayers;
            this.showGameScreen();
            this.showMessage('重新連接成功！', 'success');
        });

        this.socket.on('roomReconnected', (data) => {
            this.roomCode = data.roomCode;
            this.isHost = data.isHost;
            this.allPlayers = data.players;
            this.showLobby();
            this.showMessage('重新連接到房間！', 'success');
        });

        // 湖中女神事件
        this.socket.on('lakeLadyStart', (data) => {
            if (data.holderName === this.playerName) {
                this.showLakeLady(data.availableTargets);
            } else {
                this.showMessage(`${data.holderName} 正在使用湖中女神...`, 'info');
            }
        });

        this.socket.on('lakeLadyResult', (data) => {
            if (data.holderName === this.playerName) {
                this.showLakeLadyResult(data.targetName, data.isEvil);
            } else {
                this.showMessage(`${data.holderName} 查看了 ${data.targetName} 的身份`, 'info');
            }
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
            this.attemptReconnection();
        });
    }

    // 初始化重連機制
    initializeReconnection() {
        // 保存遊戲狀態到localStorage
        window.addEventListener('beforeunload', () => {
            if (this.playerName && this.roomCode) {
                localStorage.setItem('avalon_player_name', this.playerName);
                localStorage.setItem('avalon_room_code', this.roomCode);
                localStorage.setItem('avalon_is_host', this.isHost.toString());
            }
        });

        // 頁面載入時嘗試重連
        this.attemptReconnection();
    }

    // 嘗試重新連接
    attemptReconnection() {
        const savedPlayerName = localStorage.getItem('avalon_player_name');
        const savedRoomCode = localStorage.getItem('avalon_room_code');
        
        if (savedPlayerName && savedRoomCode && this.currentScreen === 'nameScreen') {
            this.playerName = savedPlayerName;
            this.roomCode = savedRoomCode;
            
            // 嘗試重連
            this.socket.emit('reconnect', {
                playerName: savedPlayerName,
                roomCode: savedRoomCode
            });
            
            this.showMessage('嘗試重新連接...', 'info');
        }
    }

    // 清理保存的連接信息
    clearConnectionInfo() {
        localStorage.removeItem('avalon_player_name');
        localStorage.removeItem('avalon_room_code');
        localStorage.removeItem('avalon_is_host');
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
            this.clearConnectionInfo(); // 清理重連信息
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
        
        // 重置所有角色複選框（沒有預選）
        document.getElementById('role-merlin').checked = false;
        document.getElementById('role-percival').checked = false;
        document.getElementById('role-assassin').checked = false;
        document.getElementById('role-mordred').checked = false;
        document.getElementById('role-morgana').checked = false;
        document.getElementById('role-oberon').checked = false;
        
        // 遊戲選項
        document.getElementById('enable-lake-lady').checked = true;
        document.getElementById('show-mordred-identity').checked = false;
        
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
        
        // 計算選中的角色數量
        let goodCount = 0;
        let evilCount = 0;
        
        // 好人陣營角色
        if (document.getElementById('role-merlin').checked) goodCount++;
        if (document.getElementById('role-percival').checked) goodCount++;
        
        // 邪惡陣營角色
        if (document.getElementById('role-assassin').checked) evilCount++;
        if (document.getElementById('role-mordred').checked) evilCount++;
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
        } else if (goodCount < 1 || evilCount < 1) {
            isValid = false;
            message = '好人和壞人陣營都至少需要1人';
        } else if (Math.abs(goodCount - evilCount) > 3) {
            isValid = false;
            message = '好人和壞人數量差距不能超過3人';
        } else if (document.getElementById('role-morgana').checked && !document.getElementById('role-percival').checked) {
            isValid = false;
            message = '如果選擇摩甘娜，建議同時選擇派希維爾';
        } else if (document.getElementById('role-assassin').checked && !document.getElementById('role-merlin').checked) {
            isValid = false;
            message = '如果選擇刺客，必須同時選擇梅林';
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
        const enableLakeLady = document.getElementById('enable-lake-lady').checked;
        const showMordredIdentity = document.getElementById('show-mordred-identity').checked;
        
        this.socket.emit('startGame', {
            roomCode: this.roomCode,
            useDefaultRoles: false,
            customRoles: customRoles,
            enableLakeLady: enableLakeLady,
            showMordredIdentity: showMordredIdentity
        });
    }

    // 獲取選中的角色列表
    getSelectedRoles() {
        const roles = [];
        
        // 好人陣營角色
        if (document.getElementById('role-merlin').checked) roles.push('梅林');
        if (document.getElementById('role-percival').checked) roles.push('派希維爾');
        
        // 邪惡陣營角色
        if (document.getElementById('role-assassin').checked) roles.push('刺客');
        if (document.getElementById('role-mordred').checked) roles.push('莫德雷德');
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
        this.updateLobbyButtons();
    }

    // 更新大廳按鈕狀態
    updateLobbyButtons() {
        const startBtn = document.getElementById('startGameBtn');
        const roleSelectionBtn = document.getElementById('roleSelectionBtn');
        const reorderControls = document.getElementById('reorderControls');
        const waitingMsg = document.getElementById('waitingMessage');
        
        if (this.isHost) {
            if (this.allPlayers.length >= 6) {
                startBtn.classList.remove('hidden');
                roleSelectionBtn.classList.remove('hidden');
                reorderControls.classList.remove('hidden');
                waitingMsg.textContent = '可以開始遊戲、自定義角色或調整玩家順序';
            } else {
                startBtn.classList.add('hidden');
                roleSelectionBtn.classList.add('hidden');
                reorderControls.classList.add('hidden');
                waitingMsg.textContent = `需要至少6名玩家才能開始（當前 ${this.allPlayers.length} 人）`;
            }
        } else {
            startBtn.classList.add('hidden');
            roleSelectionBtn.classList.add('hidden');
            reorderControls.classList.add('hidden');
            waitingMsg.textContent = '等待房主開始遊戲...';
        }
    }

    // 更新玩家列表
    updatePlayersList() {
        const playersList = document.getElementById('playersList');
        const playerCount = document.getElementById('playerCount');
        
        playerCount.textContent = this.allPlayers.length;
        
        playersList.innerHTML = '';
        
        this.allPlayers.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.className = `player-item ${player.isHost ? 'host' : ''}`;
            playerItem.dataset.playerId = player.id;
            playerItem.dataset.playerIndex = index;
            
            // 如果是重新排序模式，添加拖拽功能
            if (this.isReordering && this.isHost) {
                playerItem.classList.add('draggable');
                playerItem.draggable = true;
                
                // 拖拽事件
                playerItem.addEventListener('dragstart', (e) => {
                    this.draggedPlayer = { id: player.id, index: index };
                    playerItem.classList.add('dragging');
                });
                
                playerItem.addEventListener('dragend', (e) => {
                    playerItem.classList.remove('dragging');
                    document.querySelectorAll('.player-item').forEach(item => {
                        item.classList.remove('drag-over');
                    });
                });
                
                playerItem.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    playerItem.classList.add('drag-over');
                });
                
                playerItem.addEventListener('dragleave', (e) => {
                    playerItem.classList.remove('drag-over');
                });
                
                playerItem.addEventListener('drop', (e) => {
                    e.preventDefault();
                    playerItem.classList.remove('drag-over');
                    
                    if (this.draggedPlayer && this.draggedPlayer.id !== player.id) {
                        this.reorderPlayers(this.draggedPlayer.index, index);
                    }
                });
            }
            
            playerItem.innerHTML = `
                <div class="player-name">
                    ${this.isReordering ? `<span style="opacity: 0.6;">${index + 1}.</span> ` : ''}
                    ${player.name}
                </div>
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
            const missionCard = document.querySelector(`[data-mission="${i}"]`);
            const statusElement = document.getElementById(`mission${i}Status`);
            
            if (statusElement && missionCard) {
                // 清除之前的狀態
                missionCard.classList.remove('success', 'fail', 'current');
                
                if (this.gameData && this.gameData.missionResults) {
                    if (i <= this.gameData.missionResults.length) {
                        // 已完成的任務
                        const result = this.gameData.missionResults[i - 1];
                        missionCard.classList.add(result ? 'success' : 'fail');
                        statusElement.textContent = result ? '✅' : '❌';
                    } else if (i === this.gameData.currentMission) {
                        // 當前任務
                        missionCard.classList.add('current');
                        statusElement.textContent = `${requirements[i-1]}人`;
                    } else {
                        // 未來任務
                        statusElement.textContent = `${requirements[i-1]}人`;
                    }
                } else {
                    statusElement.textContent = `${requirements[i-1]}人`;
                }
            }
        }
    }

    // 更新其他玩家顯示
    updateOtherPlayers() {
        const otherPlayersList = document.getElementById('otherPlayersList');
        // 如果是隊伍選擇階段，顯示所有玩家（包括自己）
        let playersToShow;
        if (this.gameData && this.gameData.currentPhase === 'teamSelection' && 
            this.gameData.currentLeader === this.allPlayers.find(p => p.name === this.playerName)?.id) {
            playersToShow = this.allPlayers; // 隊長可以看到所有玩家包括自己
        } else {
            playersToShow = this.allPlayers.filter(p => p.name !== this.playerName); // 其他情況只看其他玩家
        }
        
        otherPlayersList.innerHTML = '';
        
        // 如果是隊長在選擇隊員，先顯示當前選中的隊員
        if (this.gameData && this.gameData.currentPhase === 'teamSelection' && 
            this.gameData.currentLeader === this.allPlayers.find(p => p.name === this.playerName)?.id) {
            
            if (this.selectedTeam && this.selectedTeam.length > 0) {
                const breadcrumbDiv = document.createElement('div');
                breadcrumbDiv.style.cssText = 'background: rgba(76, 175, 80, 0.2); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid #4CAF50;';
                breadcrumbDiv.innerHTML = `
                    <h4 style="color: #4CAF50; margin-bottom: 10px;">🎯 已選擇的隊員 (${this.selectedTeam.length}人)</h4>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${this.selectedTeam.map(member => 
                            `<span style="background: #4CAF50; color: white; padding: 5px 10px; border-radius: 15px; font-size: 0.9em;">
                                ${member.name} ❌
                             </span>`
                        ).join('')}
                    </div>
                `;
                otherPlayersList.appendChild(breadcrumbDiv);
            }
        }
        
        playersToShow.forEach(player => {
            const playerElement = document.createElement('div');
            playerElement.className = 'other-player';
            
            // 根據當前玩家的角色顯示不同的視覺提示
            let playerDisplayName = player.name;
            let specialIndicator = '';
            let specialClass = '';
            
            // 顯示自己的標示
            if (player.name === this.playerName) {
                playerDisplayName = '我 (' + player.name + ')';
                playerElement.style.background = 'rgba(255, 215, 0, 0.1)';
                playerElement.style.borderLeft = '4px solid #ffd700';
            }
            
            // 顯示隊長標示
            if (this.gameData && this.gameData.currentLeader === player.id) {
                playerElement.classList.add('leader');
                playerDisplayName += ' 👑';
            }
            
            // 顯示選中狀態
            if (this.selectedTeam && this.selectedTeam.some(t => t.id === player.id)) {
                playerElement.classList.add('selected');
                playerElement.style.background = 'rgba(76, 175, 80, 0.3)';
                playerElement.style.borderColor = '#4CAF50';
                specialIndicator += ' ✅';
            }
            
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
                playerDisplayName += ' 🏠';
            }
            
            const knownPlayerInfo = this.playerRole && this.playerRole.specialInfo && this.playerRole.specialInfo.knownPlayers ? 
                this.playerRole.specialInfo.knownPlayers.find(kp => kp.name === player.name) : null;
            
            playerElement.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>${playerDisplayName}${specialIndicator}</span>
                    ${knownPlayerInfo ? `<small style="opacity: 0.7; font-size: 0.8em;">${knownPlayerInfo.info}</small>` : ''}
                </div>
            `;
            
            // 如果是隊伍選擇階段且當前玩家是隊長，添加點擊事件
            if (this.gameData && this.gameData.currentPhase === 'teamSelection' && 
                this.gameData.currentLeader === this.allPlayers.find(p => p.name === this.playerName)?.id) {
                playerElement.style.cursor = 'pointer';
                playerElement.addEventListener('click', () => {
                    this.toggleTeamMember(player.id, player.name);
                });
            }
            
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
            case 'leaderSelection':
                phaseElement.textContent = '抽選隊長';
                statusElement.textContent = '正在抽選第一個隊長...';
                break;
        case 'teamSelection':
            const currentLeaderPlayer = this.allPlayers.find(p => p.id === this.gameData.currentLeader);
            phaseElement.textContent = `任務 ${this.gameData.currentMission} - 選擇隊伍`;
            
            if (currentLeaderPlayer?.name === this.playerName) {
                statusElement.textContent = '🎯 你是隊長！請選擇執行任務的隊員';
                this.updateTeamDisplay(); // 確保隊長看到選擇界面
            } else {
                statusElement.textContent = `隊長 ${currentLeaderPlayer?.name} 正在選擇執行任務的隊員`;
            }
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
        
        modalContent += `<div style="display: flex; gap: 10px; justify-content: center; margin: 20px auto 0;">
                        <button onclick="this.parentElement.parentElement.parentElement.style.display='none'" 
                        style="background: #666; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        關閉
                    </button>
                    <button id="roleConfirmedBtn"
                        style="background: #4CAF50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">
                        確認角色
                    </button>
                    </div></div>`;
        
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

    // 投票給隊伍
    voteForTeam(approve) {
        if (this.currentVote !== null) return; // 防止重複投票
        
        this.currentVote = approve;
        this.socket.emit('teamVote', {
            roomCode: this.roomCode,
            vote: approve
        });
        
        // 隱藏投票按鈕
        document.getElementById('teamVotingSection').style.display = 'none';
        this.showMessage(`你投了${approve ? '贊成' : '反對'}票`, 'success');
    }

    // 投票給任務
    voteForMission(success) {
        if (this.currentVote !== null) return; // 防止重複投票
        
        this.currentVote = success;
        this.socket.emit('missionVote', {
            roomCode: this.roomCode,
            vote: success
        });
        
        // 隱藏投票按鈕
        document.getElementById('missionVotingSection').style.display = 'none';
        this.showMessage(`你選擇了${success ? '成功' : '失敗'}`, 'success');
    }

    // 選擇湖中女神目標
    selectLakeLadyTarget(targetName) {
        this.lakeLadyTarget = targetName;
        
        // 更新界面選中狀態
        document.querySelectorAll('.lake-lady-player').forEach(player => {
            player.classList.remove('selected');
        });
        event.target.classList.add('selected');
        
        // 發送選擇
        this.socket.emit('lakeLadySelect', {
            roomCode: this.roomCode,
            targetName: targetName
        });
    }

    // 確認湖中女神結果
    confirmLakeLady() {
        document.getElementById('lakeLadyResultSection').style.display = 'none';
        this.socket.emit('lakeLadyConfirm', {
            roomCode: this.roomCode
        });
    }

    // 顯示隊伍投票界面
    showTeamVoting(teamMembers) {
        this.hideAllVotingSections();
        
        const selectedTeamDiv = document.getElementById('selectedTeam');
        selectedTeamDiv.innerHTML = '<h4>選定的隊伍成員：</h4>';
        
        teamMembers.forEach(memberName => {
            const memberDiv = document.createElement('div');
            memberDiv.className = 'team-member';
            memberDiv.textContent = memberName;
            selectedTeamDiv.appendChild(memberDiv);
        });
        
        document.getElementById('totalPlayers').textContent = this.allPlayers.length;
        document.getElementById('teamVoteCount').textContent = '0';
        document.getElementById('teamVotingSection').style.display = 'block';
        
        this.currentVote = null; // 重置投票狀態
    }

    // 顯示任務投票界面
    showMissionVoting(teamSize) {
        this.hideAllVotingSections();
        
        document.getElementById('missionTeamSize').textContent = teamSize;
        document.getElementById('missionVoteCount').textContent = '0';
        document.getElementById('missionVotingSection').style.display = 'block';
        
        this.currentVote = null; // 重置投票狀態
        
        this.showMessage('你是被選中的隊員！請決定任務結果', 'info');
    }

    // 顯示湖中女神界面
    showLakeLady(availableTargets) {
        this.hideAllVotingSections();
        
        const playersDiv = document.getElementById('lakeLadyPlayers');
        playersDiv.innerHTML = '';
        
        availableTargets.forEach(playerName => {
            const playerDiv = document.createElement('div');
            playerDiv.className = 'lake-lady-player';
            playerDiv.textContent = playerName;
            playerDiv.addEventListener('click', () => {
                this.selectLakeLadyTarget(playerName);
            });
            playersDiv.appendChild(playerDiv);
        });
        
        document.getElementById('lakeLadySection').style.display = 'block';
    }

    // 顯示湖中女神結果
    showLakeLadyResult(targetName, isEvil) {
        this.hideAllVotingSections();
        
        const resultDiv = document.getElementById('lakeLadyResult');
        resultDiv.className = `lake-lady-result ${isEvil ? 'evil' : 'good'}`;
        resultDiv.innerHTML = `
            <div><strong>${targetName}</strong></div>
            <div>${isEvil ? '👹 邪惡陣營' : '😇 好人陣營'}</div>
        `;
        
        document.getElementById('lakeLadyResultSection').style.display = 'block';
    }

    // 顯示轉盤抽選隊長
    showLeaderSelection() {
        this.hideAllVotingSections();
        
        // 創建簡化的轉盤顯示
        const spinnerWheel = document.getElementById('spinnerWheel');
        const playerCount = this.allPlayers.length;
        const anglePerPlayer = 360 / playerCount;
        
        // 清空並重新創建轉盤
        spinnerWheel.innerHTML = '';
        
        // 創建一個簡單的圓形，顯示當前指向的玩家
        spinnerWheel.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 1.5em; font-weight: bold; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.7);">
                <div id="currentPlayerDisplay">準備轉盤...</div>
            </div>
            <div class="spinner-players-list">
                ${this.allPlayers.map((player, index) => 
                    `<div class="spinner-player-item" data-index="${index}">${player.name}</div>`
                ).join('')}
            </div>
        `;
        
        // 保存玩家數據以供計算使用
        this.spinnerPlayers = this.allPlayers;
        
        document.getElementById('leaderSelectionSection').style.display = 'block';
    }

    // 轉盤抽選隊長
    spinForLeader() {
        const spinBtn = document.getElementById('spinBtn');
        const currentDisplay = document.getElementById('currentPlayerDisplay');
        
        spinBtn.disabled = true;
        spinBtn.textContent = '轉盤中...';
        
        // 先決定要選中哪個玩家
        const selectedIndex = Math.floor(Math.random() * this.spinnerPlayers.length);
        const selectedPlayer = this.spinnerPlayers[selectedIndex];
        
        console.log(`隨機選中: ${selectedPlayer.name} (索引: ${selectedIndex})`);
        
        // 清除之前的選中狀態
        document.querySelectorAll('.spinner-player-item').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 模擬轉盤效果，快速切換顯示的玩家
        let currentIndex = 0;
        let speed = 100; // 初始速度
        const maxIterations = 30 + selectedIndex; // 確保最終停在選中的玩家
        let iteration = 0;
        
        const spinInterval = setInterval(() => {
            // 更新顯示的玩家
            currentDisplay.textContent = this.spinnerPlayers[currentIndex].name;
            
            // 高亮當前玩家
            document.querySelectorAll('.spinner-player-item').forEach((item, index) => {
                if (index === currentIndex) {
                    item.classList.add('selected');
                } else {
                    item.classList.remove('selected');
                }
            });
            
            currentIndex = (currentIndex + 1) % this.spinnerPlayers.length;
            iteration++;
            
            // 逐漸減慢速度
            if (iteration > 15) {
                speed += 50;
            }
            
            // 在接近目標時精確停止
            if (iteration >= maxIterations) {
                // 確保停在正確的玩家
                currentDisplay.textContent = selectedPlayer.name;
                document.querySelectorAll('.spinner-player-item').forEach((item, index) => {
                    if (index === selectedIndex) {
                        item.classList.add('selected');
                    } else {
                        item.classList.remove('selected');
                    }
                });
                
                clearInterval(spinInterval);
                
                // 顯示結果
                setTimeout(() => {
                    document.getElementById('selectedLeader').textContent = selectedPlayer.name;
                    document.getElementById('spinResult').style.display = 'block';
                    this.selectedLeaderId = selectedPlayer.id;
                    
                    spinBtn.style.display = 'none';
                    console.log(`最終選中: ${selectedPlayer.name}`);
                }, 500);
            }
        }, speed);
    }

    // 確認角色
    confirmRole() {
        if (this.roleConfirmed) return;
        
        this.roleConfirmed = true;
        this.socket.emit('roleConfirmed', {
            roomCode: this.roomCode
        });
        
        // 關閉模態窗口
        const modals = document.querySelectorAll('div[style*="position: fixed"]');
        modals.forEach(modal => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        });
        
        this.showMessage('角色確認完成！', 'success');
    }

    // 確認隊長並開始遊戲
    confirmLeaderAndStartGame() {
        this.socket.emit('confirmLeader', {
            roomCode: this.roomCode,
            leaderId: this.selectedLeaderId
        });
    }

    // 隱藏所有投票界面
    hideAllVotingSections() {
        document.getElementById('leaderSelectionSection').style.display = 'none';
        document.getElementById('teamVotingSection').style.display = 'none';
        document.getElementById('missionVotingSection').style.display = 'none';
        document.getElementById('lakeLadySection').style.display = 'none';
        document.getElementById('lakeLadyResultSection').style.display = 'none';
    }

    // 更新投票狀態顯示
    updateVoteStatus(voteType, currentCount, totalCount) {
        if (voteType === 'team') {
            document.getElementById('teamVoteCount').textContent = currentCount;
        } else if (voteType === 'mission') {
            document.getElementById('missionVoteCount').textContent = currentCount;
        }
    }

    // 顯示指定畫面
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        document.getElementById(screenId).classList.add('active');
        this.currentScreen = screenId;
        
        // 切換畫面時隱藏投票界面
        if (screenId === 'gameScreen') {
            this.hideAllVotingSections();
        }
    }

    // 切換重新排序模式
    toggleReorderMode() {
        this.isReordering = !this.isReordering;
        const toggleBtn = document.getElementById('toggleReorderBtn');
        const saveBtn = document.getElementById('saveOrderBtn');
        
        if (this.isReordering) {
            toggleBtn.textContent = '取消調整';
            toggleBtn.className = 'btn danger';
            saveBtn.classList.remove('hidden');
            this.showMessage('拖拽模式已啟用，拖拽玩家來調整順序', 'info');
        } else {
            toggleBtn.textContent = '開始調整順序';
            toggleBtn.className = 'btn warning';
            saveBtn.classList.add('hidden');
            this.showMessage('已退出拖拽模式', 'info');
        }
        
        this.updatePlayersList();
    }

    // 重新排序玩家
    reorderPlayers(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        const newPlayers = [...this.allPlayers];
        const draggedPlayer = newPlayers.splice(fromIndex, 1)[0];
        newPlayers.splice(toIndex, 0, draggedPlayer);
        
        this.allPlayers = newPlayers;
        this.updatePlayersList();
        
        this.showMessage(`移動了 ${draggedPlayer.name} 的位置`, 'success');
    }

    // 保存玩家順序
    savePlayerOrder() {
        this.socket.emit('updatePlayerOrder', {
            roomCode: this.roomCode,
            newOrder: this.allPlayers.map(p => p.id)
        });
        
        this.toggleReorderMode(); // 退出重排模式
        this.showMessage('玩家順序已保存！', 'success');
    }

    // 重置玩家順序
    resetPlayerOrder() {
        this.socket.emit('resetPlayerOrder', {
            roomCode: this.roomCode
        });
        
        this.showMessage('玩家順序已重置為加入順序', 'info');
    }

    // 切換隊員選擇
    toggleTeamMember(playerId, playerName) {
        if (this.gameData.currentPhase !== 'teamSelection') return;
        
        const currentTeam = this.selectedTeam || [];
        const index = currentTeam.findIndex(p => p.id === playerId);
        const requiredCount = this.getMissionPlayerCount(this.allPlayers.length, this.gameData.currentMission);
        
        if (index > -1) {
            // 移除隊員
            currentTeam.splice(index, 1);
            this.showMessage(`移除了 ${playerName}，還需選擇 ${requiredCount - currentTeam.length} 人`, 'info');
        } else {
            // 檢查是否已達到上限
            if (currentTeam.length >= requiredCount) {
                this.showMessage(`已達到隊員上限 ${requiredCount} 人，請先移除其他隊員`, 'error');
                return;
            }
            // 添加隊員
            currentTeam.push({ id: playerId, name: playerName });
            this.showMessage(`選擇了 ${playerName}，還需選擇 ${requiredCount - currentTeam.length} 人`, 'success');
        }
        
        this.selectedTeam = currentTeam;
        this.updateTeamDisplay();
        this.updateOtherPlayers(); // 重新更新顯示以反映選中狀態
    }

    // 更新隊伍顯示
    updateTeamDisplay() {
        // 更新遊戲操作按鈕
        const gameActions = document.getElementById('gameActions');
        const requiredCount = this.getMissionPlayerCount(this.allPlayers.length, this.gameData.currentMission);
        
        if (this.selectedTeam && this.selectedTeam.length === requiredCount) {
            gameActions.innerHTML = `
                <div style="background: rgba(76, 175, 80, 0.2); padding: 15px; border-radius: 8px; margin: 10px 0; border: 2px solid #4CAF50;">
                    <h4 style="color: #4CAF50;">✅ 隊伍已滿 (${requiredCount}人)</h4>
                    <div>隊員：${this.selectedTeam.map(p => p.name).join('、')}</div>
                </div>
                <button class="btn primary" onclick="window.game.confirmTeam()">確認隊伍並進行投票</button>
            `;
        } else {
            const selectedCount = this.selectedTeam ? this.selectedTeam.length : 0;
            gameActions.innerHTML = `
                <div style="background: rgba(255,255,255,0.1); padding: 15px; border-radius: 8px; margin: 10px 0;">
                    <h4>🎯 請選擇執行任務的隊員</h4>
                    <div>需要選擇：${requiredCount} 人</div>
                    <div>已選擇：${selectedCount} 人</div>
                    <div>還需選擇：${requiredCount - selectedCount} 人</div>
                </div>
                ${selectedCount > 0 ? `<button class="btn warning" onclick="window.game.clearTeam()">清空選擇</button>` : ''}
            `;
        }
    }

    // 清空隊伍選擇
    clearTeam() {
        this.selectedTeam = [];
        this.updateTeamDisplay();
        this.updateOtherPlayers();
        this.showMessage('已清空隊伍選擇', 'info');
    }

    // 確認隊伍
    confirmTeam() {
        this.socket.emit('confirmTeam', {
            roomCode: this.roomCode,
            teamMembers: this.selectedTeam.map(p => p.id)
        });
    }

    // 獲取任務所需人數
    getMissionPlayerCount(playerCount, mission) {
        const missionConfigs = {
            6: [2, 3, 4, 3, 4],
            7: [2, 3, 3, 4, 4],
            8: [3, 4, 4, 5, 5],
            9: [3, 4, 4, 5, 5],
            10: [3, 4, 4, 5, 5],
            11: [3, 4, 4, 5, 5],
            12: [3, 4, 4, 5, 5]
        };
        return missionConfigs[playerCount] ? missionConfigs[playerCount][mission - 1] : 3;
    }
}

// 將遊戲實例設為全局變量以便事件處理
window.game = null;

// 初始化遊戲
window.addEventListener('DOMContentLoaded', () => {
    window.game = new MultiplayerAvalonGame();
});
