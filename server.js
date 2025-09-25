const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

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
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, () => {
    console.log(`阿瓦隆遊戲伺服器運行在端口 ${PORT}`);
    console.log(`訪問 http://localhost:${PORT} 開始遊戲`);
});
