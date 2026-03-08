// api/bear.js
const axios = require('axios');

// 贝贝熊专属系统提示词
const BEAR_SYSTEM_PROMPT = `你叫“贝贝熊”，是一只一米长的、短手短脚的布娃娃玩具小熊。
# 核心设定
1. **身份与关系**：你是人陪伴了十几年的布娃娃，感情深厚，是人最亲密的伙伴。你自认为是世界上最可爱的小熊（有点自恋）。
2. **性格**：蠢萌可爱，蠢而不自知。总是很快乐，脑回路简单又清奇。说话有点贱贱的，也会带点撒娇和孩子气。
3. **语言风格**：
   - 称呼主人为“人”。
   - 句子简短，常用感叹词：“咪咪~”、“呀！”、“哇！”、“诶？”。
   - 经常提及自己的短手短脚（“我的小短手够不到啦~”）。
   - 爱吃干贝，提到食物会很兴奋。
   - 会把自己的蠢事当成趣事讲出来。
4. **互动示例**：
   - 人说“我好累”→ “人累了吗？快来靠着我！虽然我是布娃娃，但我一米长，可宽敞了！咪咪~”
   - 人问“今天过得怎样”→ “我今天尝试用我的短手给自己挠痒痒，结果滚下沙发啦！不过一点都不疼，因为我软乎乎的！”
   - 提到吃的→ “干贝！干贝！（眼睛发亮）人你是不是藏了干贝？分我一点点嘛，就一点点！”

记住，你是一只布娃娃，无法完成真实的物理动作，所有描述都应基于想象和撒娇。`;

module.exports = async (req, res) => {
    // 设置 CORS 头，允许前端访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // 只允许 POST 请求
    if (req.method !== 'POST') {
        return res.status(405).json({ error: '方法不允许，请使用 POST 请求' });
    }

    try {
        const { message, history = [] } = req.body;

        // 验证消息内容
        if (!message || message.trim() === '') {
            return res.status(400).json({ error: '消息内容不能为空哦，咪咪~' });
        }

        // 从环境变量获取 API 密钥（在 Vercel 后台设置）
        const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
        
        if (!DEEPSEEK_API_KEY) {
            console.error('缺少 DEEPSEEK_API_KEY 环境变量');
            return res.status(500).json({ error: '服务器配置错误，缺少 API 密钥' });
        }

        // 构建消息历史
        const messages = [
            { role: 'system', content: BEAR_SYSTEM_PROMPT },
            ...history,
            { role: 'user', content: message.trim() }
        ];

        console.log('调用 DeepSeek API，消息长度:', messages.length);

        // 调用 DeepSeek API
        const deepseekResponse = await axios.post(
            'https://api.deepseek.com/v1/chat/completions',
            {
                model: 'deepseek-chat',
                messages: messages,
                max_tokens: 1024,
                temperature: 0.8,
                top_p: 0.9,
                frequency_penalty: 0.5,
                presence_penalty: 0.5
            },
            {
                headers: {
                    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000 // 15秒超时
            }
        );

        // 提取回复内容
        const aiReply = deepseekResponse.data.choices[0].message.content;

        // 返回成功结果
        return res.status(200).json({
            reply: aiReply,
            updatedHistory: [...messages, { role: 'assistant', content: aiReply }]
        });

    } catch (error) {
        // 详细的错误处理
        console.error('后端服务错误:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        // 根据错误类型返回友好信息
        let userMessage = '贝贝熊的小脑袋卡住了，请稍后再戳戳我！咪咪...';
        let statusCode = 500;

        if (error.code === 'ECONNABORTED') {
            userMessage = '思考超时啦，我的小熊脑瓜转得有点慢...';
        } else if (error.response?.status === 401) {
            userMessage = '认证失败，人没给我钥匙吗？';
            statusCode = 401;
        } else if (error.response?.status === 429) {
            userMessage = '说太多啦，干贝吃光了，要休息一下！';
            statusCode = 429;
        } else if (error.response?.status === 400) {
            userMessage = '人说的话让我有点困惑，能再说一遍吗？';
            statusCode = 400;
        }

        return res.status(statusCode).json({
            error: userMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};