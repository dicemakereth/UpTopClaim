const fs = require('fs');
const { ethers } = require('ethers');
const axios = require('axios');

// 配置
const CONFIG = {
    PROJECT_ID: 'AD_AiFx0Ge5aJ15',
    CONTRACT_ADDRESS: '0x30f333e932e7965f728AF513aa06E1350eD6Aee2',
    API_BASE_URL: 'https://claim.tokentable.xyz/api/airdrop-open',
    WALLETS_FILE: 'wallets.txt',
    RPC_URL: 'https://bsc-dataseed1.binance.org', // BSC网络RPC
    MIN_AMOUNT: '20' // 最小金额阈值（UPTOP），小于此值将跳过claim
};

// 智能合约ABI (只包含claim函数)
const CONTRACT_ABI = [
    "function claim(address[] recipients, bytes32[] userClaimIds, bytes[] datas, bytes[] signatures, bytes[] extraDatas)"
];

class TokenTableClaimer {
    constructor() {
        this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        this.sessionId = null;
    }

    // 解析私钥，自动处理0x前缀
    parsePrivateKey(privateKey) {
        let cleanKey = privateKey.trim();
        if (!cleanKey.startsWith('0x')) {
            cleanKey = '0x' + cleanKey;
        }
        return cleanKey;
    }

    // 从私钥获取钱包地址
    getAddressFromPrivateKey(privateKey) {
        try {
            const wallet = new ethers.Wallet(privateKey);
            return wallet.address;
        } catch (error) {
            throw new Error(`无效的私钥: ${error.message}`);
        }
    }

    // 读取钱包文件
    readWallets() {
        try {
            const content = fs.readFileSync(CONFIG.WALLETS_FILE, 'utf8');
            const lines = content.split('\n').filter(line => {
                const trimmed = line.trim();
                // 忽略空行和注释行
                return trimmed && !trimmed.startsWith('#');
            });
            const wallets = [];

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.includes('----')) {
                    // 钱包地址和私钥对格式
                    const parts = trimmedLine.split('----');
                    if (parts.length === 2) {
                        const address = parts[0].trim();
                        const privateKey = this.parsePrivateKey(parts[1]);
                        wallets.push({ address, privateKey });
                    }
                } else {
                    // 只有私钥格式
                    const privateKey = this.parsePrivateKey(trimmedLine);
                    const address = this.getAddressFromPrivateKey(privateKey);
                    wallets.push({ address, privateKey });
                }
            }

            console.log(`成功读取 ${wallets.length} 个钱包`);
            return wallets;
        } catch (error) {
            console.error('读取钱包文件失败:', error.message);
            return [];
        }
    }

    // 创建签名消息
    createSignatureMessage() {
        const timestamp = Date.now();
        return `${CONFIG.PROJECT_ID},EVM Wallet,${timestamp}`;
    }

    // 签名登录
    async signAndLogin(wallet) {
        try {
            const message = this.createSignatureMessage();
            const timestamp = message.split(',')[2];
            
            // 创建钱包实例并签名
            const walletInstance = new ethers.Wallet(wallet.privateKey);
            const signature = await walletInstance.signMessage(message);

            const loginData = {
                signature: signature,
                message: message,
                key: wallet.address,
                address: wallet.address,
                projectId: CONFIG.PROJECT_ID,
                timestamp: parseInt(timestamp),
                recipientType: "EVM Wallet"
            };

            const response = await axios.post(
                `${CONFIG.API_BASE_URL}/connect-wallet`,
                loginData,
                {
                    headers: {
                        'accept': '*/*',
                        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                        'content-type': 'application/json',
                        'origin': 'https://claim.tokentable.xyz',
                        'referer': `https://claim.tokentable.xyz/airdrop/${CONFIG.PROJECT_ID}`,
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
                    }
                }
            );

            if (response.data.success) {
                this.sessionId = response.data.data.sid;
                console.log(`✅ 钱包 ${wallet.address} 登录成功`);
                return true;
            } else {
                console.log(`❌ 钱包 ${wallet.address} 登录失败: ${response.data.message}`);
                return false;
            }
        } catch (error) {
            console.error(`❌ 钱包 ${wallet.address} 登录失败:`, error.message);
            return false;
        }
    }

    // 检查资格并获取claim信息
    async checkEligibility() {
        try {
            const response = await axios.post(
                `${CONFIG.API_BASE_URL}/check-eligibility`,
                { projectId: CONFIG.PROJECT_ID },
                {
                    headers: {
                        'accept': '*/*',
                        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                        'content-type': 'application/json',
                        'origin': 'https://claim.tokentable.xyz',
                        'referer': `https://claim.tokentable.xyz/airdrop/${CONFIG.PROJECT_ID}`,
                        'sid': this.sessionId,
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
                    }
                }
            );

            if (response.data.success) {
                const claims = response.data.data.claims;
                
                console.log(`\n📋 找到 ${claims.length} 个可领取的claim:`);
                claims.forEach((claim, index) => {
                    const value = ethers.parseUnits(claim.value, 0);
                    console.log(`  ${index + 1}. Claim ID: ${claim.claimId}`);
                    console.log(`     金额: ${ethers.formatEther(value)} UPTOP`);
                    console.log(`     解锁时间: ${new Date(claim.unlockingAt * 1000).toLocaleString()}`);
                });
                
                return claims;
            } else {
                console.log('❌ 检查资格失败:', response.data.message);
                return [];
            }
        } catch (error) {
            console.error('❌ 检查资格失败:', error.message);
            return [];
        }
    }

    // 获取服务器签名
    async getSignatures(claims, recipient) {
        try {
            const claimIds = claims.map(claim => claim.claimId);
            
            const response = await axios.post(
                `${CONFIG.API_BASE_URL}/check-get-signatures`,
                {
                    claimIds: claimIds,
                    projectId: CONFIG.PROJECT_ID,
                    recipient: recipient
                },
                {
                    headers: {
                        'accept': '*/*',
                        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
                        'content-type': 'application/json',
                        'origin': 'https://claim.tokentable.xyz',
                        'referer': `https://claim.tokentable.xyz/airdrop/${CONFIG.PROJECT_ID}`,
                        'sid': this.sessionId,
                        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
                    }
                }
            );

            if (response.data.success) {
                console.log(`✅ 成功获取 ${response.data.data.signatures.length} 个签名`);
                return response.data.data.signatures;
            } else {
                console.log('❌ 获取签名失败:', response.data.message);
                return [];
            }
        } catch (error) {
            console.error('❌ 获取签名失败:', error.message);
            return [];
        }
    }

    // 与智能合约交互进行claim
    async claimTokens(wallet, signatures) {
        try {
            const contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, this.provider);
            const walletInstance = new ethers.Wallet(wallet.privateKey, this.provider);
            const contractWithSigner = contract.connect(walletInstance);

            // 准备合约调用参数
            const recipients = signatures.map(sig => sig.claimId ? wallet.address : wallet.address);
            const userClaimIds = signatures.map(sig => sig.claimId);
            const datas = signatures.map(sig => sig.data);
            const signaturesData = signatures.map(sig => sig.signature);
            const extraDatas = signatures.map(() => '0x');

            // 计算总fees
            const totalFees = signatures.reduce((sum, sig) => {
                return sum + BigInt(sig.fees);
            }, BigInt(0));

            console.log(`\n🚀 开始claim交易...`);
            console.log(`合约地址: ${CONFIG.CONTRACT_ADDRESS}`);
            console.log(`钱包地址: ${wallet.address}`);
            console.log(`Claim数量: ${signatures.length}`);
            console.log(`需要发送BNB: ${ethers.formatEther(totalFees)} BNB (用于支付fees)`);

            // 发送交易，包含BNB value
            const tx = await contractWithSigner.claim(
                recipients,
                userClaimIds,
                datas,
                signaturesData,
                extraDatas,
                {
                    value: totalFees // 发送BNB支付fees
                }
            );

            console.log(`📝 交易已发送，Hash: ${tx.hash}`);
            console.log(`⏳ 等待确认...`);

            // 等待交易确认
            const receipt = await tx.wait();
            console.log(`✅ 交易确认成功！`);
            console.log(`Gas使用: ${receipt.gasUsed.toString()}`);
            console.log(`区块号: ${receipt.blockNumber}`);

            return true;
        } catch (error) {
            console.error('❌ Claim失败:', error.message);
            return false;
        }
    }

    // 主流程
    async processWallet(wallet) {
        console.log(`\n🔐 处理钱包: ${wallet.address}`);
        console.log('=' .repeat(50));

        // 1. 签名登录
        const loginSuccess = await this.signAndLogin(wallet);
        if (!loginSuccess) {
            console.log('❌ 登录失败，跳过此钱包');
            return false;
        }

        // 2. 检查资格
        const claims = await this.checkEligibility();
        if (claims.length === 0) {
            console.log('❌ 没有可领取的claim');
            return false;
        }

        // 3. 计算总金额并检查阈值
        const totalValue = claims.reduce((sum, claim) => {
            return sum + ethers.parseUnits(claim.value, 0);
        }, ethers.parseUnits('0', 18));
        
        const totalUptop = ethers.formatEther(totalValue);
        const minAmount = ethers.parseUnits(CONFIG.MIN_AMOUNT, 18);
        
        console.log(`\n💰 总金额: ${totalUptop} UPTOP`);
        console.log(`📊 最小阈值: ${CONFIG.MIN_AMOUNT} UPTOP`);
        
        if (totalValue < minAmount) {
            console.log(`⏭️  金额 ${totalUptop} UPTOP 小于阈值 ${CONFIG.MIN_AMOUNT} UPTOP，跳过claim`);
            return false;
        }
        
        console.log(`✅ 金额 ${totalUptop} UPTOP 大于阈值 ${CONFIG.MIN_AMOUNT} UPTOP，继续claim`);

        // 4. 获取签名
        const signatures = await this.getSignatures(claims, wallet.address);
        if (signatures.length === 0) {
            console.log('❌ 获取签名失败');
            return false;
        }

        // 5. 执行claim
        const claimSuccess = await this.claimTokens(wallet, signatures);
        if (claimSuccess) {
            console.log('🎉 Claim完成！');
        }

        return claimSuccess;
    }

    // 运行主程序
    async run() {
        console.log('🚀 TokenTable Airdrop Claim 自动化脚本');
        console.log('=' .repeat(50));

        // 读取钱包
        const wallets = this.readWallets();
        if (wallets.length === 0) {
            console.log('❌ 没有找到有效的钱包');
            return;
        }

        let successCount = 0;
        let totalCount = wallets.length;

        for (let i = 0; i < wallets.length; i++) {
            const wallet = wallets[i];
            console.log(`\n📊 进度: ${i + 1}/${totalCount}`);
            
            try {
                const success = await this.processWallet(wallet);
                if (success) successCount++;
                
                // 添加延迟避免请求过快
                if (i < wallets.length - 1) {
                    console.log('⏳ 等待0.5秒后处理下一个钱包...');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (error) {
                console.error(`❌ 处理钱包 ${wallet.address} 时出错:`, error.message);
            }
        }

        console.log(`\n🎯 处理完成！成功: ${successCount}/${totalCount}`);
    }
}

// 运行脚本
async function main() {
    try {
        const claimer = new TokenTableClaimer();
        await claimer.run();
    } catch (error) {
        console.error('❌ 脚本执行失败:', error.message);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main();
}

module.exports = TokenTableClaimer; 