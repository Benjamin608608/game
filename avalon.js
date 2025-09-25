// 阿瓦隆遊戲主程式
class AvalonGame {
    constructor() {
        this.playerCount = 0;
        this.players = [];
        this.roles = [];
        this.currentPhase = 'setup';
        this.currentMission = 1;
        this.currentLeader = 0;
        this.currentPlayer = 0;
        this.selectedPlayers = [];
        this.missionResults = [];
        this.votes = [];
        this.voteResults = [];
        this.consecutiveRejects = 0;
        this.gameEnded = false;
        
        this.initializeEventListeners();
        this.showRulesContent();
    }

    // 根據人數配置角色
    getRoleConfiguration(playerCount) {
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
    getMissionPlayerCount(playerCount, mission) {
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

    // 初始化事件監聽器
    initializeEventListeners() {
        // 玩家人數選擇
        document.querySelectorAll('.player-count-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.player-count-btn').forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
                this.playerCount = parseInt(e.target.dataset.count);
                document.getElementById('startGameBtn').disabled = false;
            });
        });

        // 開始遊戲
        document.getElementById('startGameBtn').addEventListener('click', () => {
            this.startGame();
        });

        // 角色查看
        document.getElementById('revealRoleBtn').addEventListener('click', () => {
            this.revealCurrentPlayerRole();
        });

        document.getElementById('confirmRoleBtn').addEventListener('click', () => {
            this.nextPlayerRoleView();
        });

        // 查看我的角色按鈕
        document.getElementById('viewRoleBtn').addEventListener('click', () => {
            this.showRoleScreen();
        });

        // 投票按鈕
        document.getElementById('approveBtn').addEventListener('click', () => {
            this.vote(true);
        });

        document.getElementById('rejectBtn').addEventListener('click', () => {
            this.vote(false);
        });

        // 規則說明
        document.getElementById('rulesToggle').addEventListener('click', () => {
            document.getElementById('rulesModal').style.display = 'block';
        });

        document.getElementById('closeRules').addEventListener('click', () => {
            document.getElementById('rulesModal').style.display = 'none';
        });

        // 點擊彈窗外部關閉
        document.getElementById('rulesModal').addEventListener('click', (e) => {
            if (e.target.id === 'rulesModal') {
                document.getElementById('rulesModal').style.display = 'none';
            }
        });
    }

    // 開始遊戲
    startGame() {
        this.assignRoles();
        this.initializePlayers();
        this.currentPhase = 'roleReveal';
        this.currentPlayer = 0;
        this.showRoleScreen();
        this.updateMissionDisplay();
    }

    // 分配角色
    assignRoles() {
        const config = this.getRoleConfiguration(this.playerCount);
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
        this.roles = this.shuffleArray(roleList);
    }

    // 洗牌算法
    shuffleArray(array) {
        const result = [...array];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }

    // 初始化玩家
    initializePlayers() {
        this.players = [];
        for (let i = 0; i < this.playerCount; i++) {
            this.players.push({
                id: i,
                name: `玩家 ${i + 1}`,
                role: this.roles[i],
                isEvil: this.isEvilRole(this.roles[i]),
                hasSeenRole: false
            });
        }
    }

    // 判斷是否為邪惡角色
    isEvilRole(role) {
        return ['莫德雷德', '刺客', '摩甘娜', '爪牙', '奧伯倫'].includes(role);
    }

    // 顯示角色畫面
    showRoleScreen() {
        document.getElementById('setupScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('roleScreen').style.display = 'block';
        document.getElementById('roleDisplay').style.display = 'none';
    }

    // 揭示當前玩家角色
    revealCurrentPlayerRole() {
        const player = this.players[this.currentPlayer];
        const roleElement = document.getElementById('playerRole');
        const infoElement = document.getElementById('roleInfo');

        roleElement.textContent = `${player.name}: ${player.role}`;
        roleElement.style.color = player.isEvil ? '#ff6b6b' : '#4CAF50';

        infoElement.innerHTML = this.getRoleInfo(player.role);
        
        document.getElementById('roleDisplay').style.display = 'block';
        player.hasSeenRole = true;
    }

    // 獲取角色資訊
    getRoleInfo(role) {
        const roleInfos = {
            '梅林': `
                <h4>🧙‍♂️ 梅林 (好人陣營)</h4>
                <p><strong>能力：</strong>知道所有邪惡角色（除了莫德雷德）</p>
                <p><strong>邪惡角色：</strong>${this.getVisibleEvilPlayers('梅林').join(', ')}</p>
                <p><strong>注意：</strong>必須隱藏身份，避免被刺客發現！</p>
            `,
            '刺客': `
                <h4>🗡️ 刺客 (邪惡陣營)</h4>
                <p><strong>能力：</strong>如果好人完成3個任務，可以刺殺梅林獲勝</p>
                <p><strong>邪惡夥伴：</strong>${this.getEvilTeammates(this.currentPlayer).join(', ')}</p>
                <p><strong>目標：</strong>破壞任務或找出梅林並刺殺</p>
            `,
            '莫德雷德': `
                <h4>👑 莫德雷德 (邪惡陣營)</h4>
                <p><strong>能力：</strong>梅林看不到你</p>
                <p><strong>邪惡夥伴：</strong>${this.getEvilTeammates(this.currentPlayer).join(', ')}</p>
                <p><strong>策略：</strong>利用隱身優勢，偽裝成好人</p>
            `,
            '佩西瓦爾': `
                <h4>🛡️ 佩西瓦爾 (好人陣營)</h4>
                <p><strong>能力：</strong>知道梅林和摩甘娜，但不知道誰是誰</p>
                <p><strong>看到的法師：</strong>${this.getMerlinAndMorgana().join(', ')}</p>
                <p><strong>任務：</strong>保護真正的梅林</p>
            `,
            '摩甘娜': `
                <h4>🔮 摩甘娜 (邪惡陣營)</h4>
                <p><strong>能力：</strong>佩西瓦爾會看到你，以為你是梅林</p>
                <p><strong>邪惡夥伴：</strong>${this.getEvilTeammates(this.currentPlayer).join(', ')}</p>
                <p><strong>策略：</strong>混淆佩西瓦爾，偽裝成梅林</p>
            `,
            '奧伯倫': `
                <h4>🌙 奧伯倫 (邪惡陣營)</h4>
                <p><strong>特殊：</strong>其他邪惡角色不知道你的身份</p>
                <p><strong>限制：</strong>你也不知道其他邪惡角色</p>
                <p><strong>策略：</strong>獨立作戰，破壞任務</p>
            `,
            '爪牙': `
                <h4>⚔️ 爪牙 (邪惡陣營)</h4>
                <p><strong>能力：</strong>知道其他邪惡角色（除了奧伯倫）</p>
                <p><strong>邪惡夥伴：</strong>${this.getEvilTeammates(this.currentPlayer).join(', ')}</p>
                <p><strong>目標：</strong>協助破壞任務</p>
            `,
            '亞瑟的忠臣': `
                <h4>⚡ 亞瑟的忠臣 (好人陣營)</h4>
                <p><strong>能力：</strong>無特殊能力</p>
                <p><strong>目標：</strong>完成任務，保護梅林</p>
                <p><strong>策略：</strong>觀察行為，找出邪惡角色</p>
            `
        };

        return roleInfos[role] || '<p>未知角色</p>';
    }

    // 獲取梅林能看到的邪惡角色
    getVisibleEvilPlayers(role) {
        if (role !== '梅林') return [];
        
        return this.players
            .filter(p => p.isEvil && p.role !== '莫德雷德')
            .map(p => p.name);
    }

    // 獲取邪惡陣營夥伴（除了奧伯倫）
    getEvilTeammates(currentPlayerId) {
        const currentPlayer = this.players[currentPlayerId];
        if (!currentPlayer.isEvil || currentPlayer.role === '奧伯倫') return [];

        return this.players
            .filter(p => p.isEvil && p.id !== currentPlayerId && p.role !== '奧伯倫')
            .map(p => p.name);
    }

    // 獲取梅林和摩甘娜（供佩西瓦爾查看）
    getMerlinAndMorgana() {
        return this.players
            .filter(p => p.role === '梅林' || p.role === '摩甘娜')
            .map(p => p.name);
    }

    // 下一個玩家查看角色
    nextPlayerRoleView() {
        this.currentPlayer++;
        if (this.currentPlayer >= this.playerCount) {
            // 所有玩家都看過角色，開始遊戲
            this.startMainGame();
        } else {
            document.getElementById('roleDisplay').style.display = 'none';
        }
    }

    // 開始主遊戲
    startMainGame() {
        this.currentPhase = 'teamSelection';
        this.currentLeader = 0;
        this.showGameScreen();
        this.updateGameDisplay();
    }

    // 顯示遊戲主畫面
    showGameScreen() {
        document.getElementById('setupScreen').style.display = 'none';
        document.getElementById('roleScreen').style.display = 'none';
        document.getElementById('gameScreen').style.display = 'block';
    }

    // 更新任務顯示
    updateMissionDisplay() {
        for (let i = 1; i <= 5; i++) {
            const card = document.querySelector(`[data-mission="${i}"]`);
            const playersDiv = document.getElementById(`mission${i}-players`);
            
            if (i < this.currentMission) {
                card.classList.add(this.missionResults[i-1] ? 'success' : 'fail');
                playersDiv.textContent = this.missionResults[i-1] ? '✓' : '✗';
            } else if (i === this.currentMission) {
                card.classList.add('current');
                playersDiv.textContent = `${this.getMissionPlayerCount(this.playerCount, i)}人`;
            } else {
                playersDiv.textContent = `${this.getMissionPlayerCount(this.playerCount, i)}人`;
            }
        }
    }

    // 更新遊戲顯示
    updateGameDisplay() {
        const phaseElement = document.getElementById('gamePhase');
        const actionElement = document.getElementById('currentAction');
        const playersGrid = document.getElementById('playersGrid');

        // 更新階段資訊
        switch (this.currentPhase) {
            case 'teamSelection':
                phaseElement.textContent = `任務 ${this.currentMission} - 選擇隊伍`;
                actionElement.textContent = `${this.players[this.currentLeader].name} 正在選擇 ${this.getMissionPlayerCount(this.playerCount, this.currentMission)} 名隊員`;
                break;
            case 'teamVote':
                phaseElement.textContent = `任務 ${this.currentMission} - 投票階段`;
                actionElement.textContent = '所有玩家對隊伍組成進行投票';
                break;
            case 'missionVote':
                phaseElement.textContent = `任務 ${this.currentMission} - 執行任務`;
                actionElement.textContent = '被選中的隊員對任務進行投票';
                break;
            case 'assassination':
                phaseElement.textContent = '刺殺階段';
                actionElement.textContent = '刺客選擇要刺殺的目標';
                break;
        }

        // 更新玩家網格
        playersGrid.innerHTML = '';
        this.players.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.textContent = player.name;

            // 添加狀態樣式
            if (index === this.currentLeader) {
                playerCard.classList.add('leader');
                playerCard.innerHTML += ' 👑';
            }
            if (this.selectedPlayers.includes(index)) {
                playerCard.classList.add('selected');
            }

            // 添加點擊事件（僅在選擇階段）
            if (this.currentPhase === 'teamSelection' && index === this.currentLeader) {
                // 隊長選擇隊員
                this.addTeamSelectionEvents(playerCard, index);
            } else if (this.currentPhase === 'assassination' && this.players[index].role === '刺客') {
                // 刺客選擇目標
                this.addAssassinationEvents(playerCard, index);
            }

            playersGrid.appendChild(playerCard);
        });

        // 更新操作按鈕
        this.updateActionButtons();
    }

    // 添加隊伍選擇事件
    addTeamSelectionEvents(playerCard, playerIndex) {
        document.querySelectorAll('.player-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const clickedIndex = Array.from(document.querySelectorAll('.player-card')).indexOf(e.target);
                this.togglePlayerSelection(clickedIndex);
            });
        });
    }

    // 切換玩家選擇狀態
    togglePlayerSelection(playerIndex) {
        if (this.currentPhase !== 'teamSelection') return;

        const requiredCount = this.getMissionPlayerCount(this.playerCount, this.currentMission);
        const selectedIndex = this.selectedPlayers.indexOf(playerIndex);

        if (selectedIndex > -1) {
            // 取消選擇
            this.selectedPlayers.splice(selectedIndex, 1);
        } else {
            // 選擇玩家
            if (this.selectedPlayers.length < requiredCount) {
                this.selectedPlayers.push(playerIndex);
            }
        }

        this.updateGameDisplay();
    }

    // 更新操作按鈕
    updateActionButtons() {
        const buttonsDiv = document.getElementById('actionButtons');
        const voteButtonsDiv = document.getElementById('voteButtons');
        
        buttonsDiv.innerHTML = '<button class="action-btn" id="viewRoleBtn">查看我的角色</button>';
        voteButtonsDiv.style.display = 'none';

        // 重新添加查看角色事件
        document.getElementById('viewRoleBtn').addEventListener('click', () => {
            this.showRoleScreen();
        });

        switch (this.currentPhase) {
            case 'teamSelection':
                if (this.selectedPlayers.length === this.getMissionPlayerCount(this.playerCount, this.currentMission)) {
                    const confirmBtn = document.createElement('button');
                    confirmBtn.className = 'action-btn success';
                    confirmBtn.textContent = '確認隊伍';
                    confirmBtn.addEventListener('click', () => this.confirmTeam());
                    buttonsDiv.appendChild(confirmBtn);
                }
                break;
            
            case 'teamVote':
                voteButtonsDiv.style.display = 'flex';
                break;
            
            case 'missionVote':
                // 只有被選中的玩家才能投票
                voteButtonsDiv.style.display = 'flex';
                break;
            
            case 'assassination':
                const assassinPlayer = this.players.find(p => p.role === '刺客');
                if (assassinPlayer) {
                    const assassinateBtn = document.createElement('button');
                    assassinateBtn.className = 'action-btn danger';
                    assassinateBtn.textContent = '進行刺殺';
                    assassinateBtn.addEventListener('click', () => this.showAssassinationTargets());
                    buttonsDiv.appendChild(assassinateBtn);
                }
                break;
        }
    }

    // 確認隊伍
    confirmTeam() {
        this.currentPhase = 'teamVote';
        this.votes = [];
        this.updateGameDisplay();
    }

    // 投票
    vote(approve) {
        this.votes.push(approve);
        
        if (this.currentPhase === 'teamVote') {
            if (this.votes.length === this.playerCount) {
                this.processTeamVote();
            }
        } else if (this.currentPhase === 'missionVote') {
            if (this.votes.length === this.selectedPlayers.length) {
                this.processMissionVote();
            }
        }
    }

    // 處理隊伍投票結果
    processTeamVote() {
        const approveCount = this.votes.filter(v => v).length;
        const approved = approveCount > this.playerCount / 2;

        // 顯示投票結果
        const resultMessage = `投票結果：贊成 ${approveCount} 票，反對 ${this.playerCount - approveCount} 票\n${approved ? '✅ 隊伍通過！' : '❌ 隊伍被拒絕！'}`;
        alert(resultMessage);

        if (approved) {
            this.currentPhase = 'missionVote';
            this.votes = [];
            this.consecutiveRejects = 0;
        } else {
            this.consecutiveRejects++;
            if (this.consecutiveRejects >= 5) {
                // 5次拒絕，邪惡陣營勝利
                this.endGame(false, '⚠️ 連續5次拒絕隊伍，邪惡陣營勝利！');
                return;
            }
            // 換下一個隊長
            this.nextLeader();
            this.currentPhase = 'teamSelection';
            this.selectedPlayers = [];
        }

        this.updateGameDisplay();
    }

    // 處理任務投票結果
    processMissionVote() {
        const failCount = this.votes.filter(v => !v).length;
        const requiredFails = this.getRoleConfiguration(this.playerCount).failsRequired[this.currentMission - 1];
        const missionSuccess = failCount < requiredFails;

        // 顯示任務結果
        const resultMessage = `任務 ${this.currentMission} 結果：\n失敗票數：${failCount}\n需要失敗票數：${requiredFails}\n${missionSuccess ? '✅ 任務成功！' : '❌ 任務失敗！'}`;
        alert(resultMessage);

        this.missionResults.push(missionSuccess);
        
        if (missionSuccess) {
            // 任務成功
            if (this.missionResults.filter(r => r).length >= 3) {
                // 好人陣營完成3個任務，進入刺殺階段
                alert('🎉 好人陣營完成了3個任務！\n⚔️ 進入刺殺階段...');
                this.currentPhase = 'assassination';
            } else {
                this.nextMission();
            }
        } else {
            // 任務失敗
            if (this.missionResults.filter(r => !r).length >= 3) {
                // 邪惡陣營破壞3個任務，遊戲結束
                this.endGame(false, '💀 邪惡陣營破壞了3個任務，邪惡陣營勝利！');
                return;
            } else {
                this.nextMission();
            }
        }

        this.updateGameDisplay();
        this.updateMissionDisplay();
    }

    // 下一個任務
    nextMission() {
        this.currentMission++;
        this.nextLeader();
        this.currentPhase = 'teamSelection';
        this.selectedPlayers = [];
        this.votes = [];
    }

    // 下一個隊長
    nextLeader() {
        this.currentLeader = (this.currentLeader + 1) % this.playerCount;
    }

    // 顯示刺殺目標
    showAssassinationTargets() {
        const buttonsDiv = document.getElementById('actionButtons');
        buttonsDiv.innerHTML = '<h3>🗡️ 刺客選擇刺殺目標</h3>';
        
        const goodPlayers = this.players.filter(p => !p.isEvil);
        
        goodPlayers.forEach(player => {
            const targetBtn = document.createElement('button');
            targetBtn.className = 'action-btn danger';
            targetBtn.textContent = `刺殺 ${player.name}`;
            targetBtn.style.margin = '5px';
            targetBtn.addEventListener('click', () => {
                if (confirm(`確定要刺殺 ${player.name} 嗎？`)) {
                    this.assassinate(player);
                }
            });
            buttonsDiv.appendChild(targetBtn);
        });
    }

    // 執行刺殺
    assassinate(targetPlayer) {
        if (targetPlayer.role === '梅林') {
            this.endGame(false, `🗡️ 刺客成功刺殺了梅林！邪惡陣營勝利！\n\n🎯 ${targetPlayer.name} 就是梅林！`);
        } else {
            this.endGame(true, `🛡️ 刺客沒有找到梅林！好人陣營勝利！\n\n❌ ${targetPlayer.name} 不是梅林！`);
        }
    }

    // 結束遊戲
    endGame(goodWins, message) {
        this.gameEnded = true;
        alert(message);
        
        // 顯示所有角色
        let roleReveal = '\n\n角色揭示：\n';
        this.players.forEach(player => {
            roleReveal += `${player.name}: ${player.role}\n`;
        });
        alert(roleReveal);

        // 重置遊戲
        if (confirm('是否要重新開始遊戲？')) {
            location.reload();
        }
    }

    // 顯示規則內容
    showRulesContent() {
        const rulesContent = document.getElementById('rulesContent');
        rulesContent.innerHTML = `
            <h3>遊戲目標</h3>
            <p><strong>好人陣營：</strong>完成3個任務獲勝，或在刺殺階段保護梅林</p>
            <p><strong>邪惡陣營：</strong>破壞3個任務獲勝，或刺殺梅林獲勝</p>

            <h3>角色介紹</h3>
            <h4>好人陣營</h4>
            <ul>
                <li><strong>梅林 🧙‍♂️：</strong>知道所有邪惡角色（除了莫德雷德），但必須隱藏身份</li>
                <li><strong>佩西瓦爾 🛡️：</strong>知道梅林和摩甘娜，但不知道誰是誰</li>
                <li><strong>亞瑟的忠臣 ⚡：</strong>普通好人，無特殊能力</li>
            </ul>

            <h4>邪惡陣營</h4>
            <ul>
                <li><strong>刺客 🗡️：</strong>可以在好人陣營完成3個任務後刺殺梅林</li>
                <li><strong>莫德雷德 👑：</strong>梅林看不到他，隱藏性極強</li>
                <li><strong>摩甘娜 🔮：</strong>會被佩西瓦爾看到，可以偽裝成梅林</li>
                <li><strong>奧伯倫 🌙：</strong>其他邪惡角色不知道他的身份</li>
                <li><strong>爪牙 ⚔️：</strong>普通邪惡角色，知道其他邪惡夥伴</li>
            </ul>

            <h3>遊戲流程</h3>
            <ol>
                <li><strong>角色分配：</strong>每位玩家查看自己的角色和相關資訊</li>
                <li><strong>任務階段：</strong>
                    <ul>
                        <li>隊長選擇執行任務的隊員</li>
                        <li>所有玩家對隊伍組成投票（贊成/反對）</li>
                        <li>如果通過，被選中的隊員對任務投票（成功/失敗）</li>
                        <li>邪惡角色可以選擇讓任務失敗</li>
                    </ul>
                </li>
                <li><strong>輪換隊長：</strong>每輪任務後隊長順時針輪換</li>
                <li><strong>勝利條件：</strong>
                    <ul>
                        <li>好人完成3個任務，進入刺殺階段</li>
                        <li>邪惡破壞3個任務，邪惡陣營勝利</li>
                        <li>連續5次拒絕隊伍，邪惡陣營勝利</li>
                    </ul>
                </li>
                <li><strong>刺殺階段：</strong>刺客選擇目標，如果是梅林則邪惡勝利，否則好人勝利</li>
            </ol>

            <h3>策略提示</h3>
            <ul>
                <li><strong>梅林：</strong>利用資訊優勢引導好人，但要小心暴露身份</li>
                <li><strong>邪惡角色：</strong>偽裝成好人，適時破壞任務</li>
                <li><strong>佩西瓦爾：</strong>觀察梅林和摩甘娜的行為，保護真正的梅林</li>
                <li><strong>普通角色：</strong>觀察發言和投票行為，推理出其他玩家的身份</li>
            </ul>
        `;
    }
}

// 初始化遊戲
window.addEventListener('DOMContentLoaded', () => {
    new AvalonGame();
});
