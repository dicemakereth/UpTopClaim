# TokenTable Airdrop Claim 自动化脚本

> **声明**: 代码完全开源，你的私钥只会保存在你本地，不会任何上传。  
> **作者**: 骰子哥，Twitter：[@dice_maker](https://x.com/dice_maker)

这是一个用于自动化领取 TokenTable UPTOP 空投的 Node.js 脚本，运行在 BSC 网络上。

## 功能特性

- ✅ 支持多种钱包文件格式
- ✅ 自动处理私钥0x前缀
- ✅ 批量处理多个钱包
- ✅ 自动签名登录
- ✅ 检查空投资格
- ✅ 获取服务器签名
- ✅ 与智能合约交互完成claim
- ✅ 自动计算并发送BNB fees
- ✅ 详细的日志输出
- ✅ 错误处理和重试机制

## 安装依赖

```bash
npm install
```

## 配置钱包文件

在 `wallets.txt` 文件中添加你的私钥，支持两种格式：

### 格式1：只有私钥
```
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

### 格式2：钱包地址和私钥对（用----分隔）
```
0x1234567890abcdef1234567890abcdef1234567890----0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
0xabcdef1234567890abcdef1234567890abcdef123456----0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

## 运行脚本

```bash
npm start
```

或者

```bash
node claim.js
```

## 脚本流程

1. **读取钱包文件** - 解析 `wallets.txt` 中的私钥
2. **签名登录** - 使用私钥签名消息并登录到 TokenTable
3. **检查资格** - 查询钱包是否有可领取的 UPTOP 空投
4. **获取签名** - 从服务器获取claim所需的签名和fees信息
5. **执行claim** - 与智能合约交互完成空投领取，自动发送BNB支付fees

## 配置选项

在 `claim.js` 文件顶部可以修改以下配置：

```javascript
const CONFIG = {
    PROJECT_ID: 'AD_AiFx0Ge5aJ15',           // 项目ID
    CONTRACT_ADDRESS: '0x30f333e932e7965f728AF513aa06E1350eD6Aee2',  // 合约地址
    API_BASE_URL: 'https://claim.tokentable.xyz/api/airdrop-open',   // API地址
    WALLETS_FILE: 'wallets.txt',             // 钱包文件路径
    RPC_URL: 'https://bsc-dataseed1.binance.org',  // BSC网络RPC地址
    MIN_AMOUNT: '0.1'                        // 最小金额阈值（UPTOP），小于此值将跳过claim
};
```

### 金额阈值功能

- 设置 `MIN_AMOUNT` 可以避免claim小额空投，节省gas费用
- 只有当钱包的总claim金额大于设定阈值时，才会执行合约交互
- 小于阈值的钱包会被跳过，显示"跳过claim"信息
- 默认阈值设置为 0.1 UPTOP

## 注意事项

⚠️ **安全提醒**：
- 请确保 `wallets.txt` 文件安全，不要泄露给他人
- 建议在测试网络上先测试脚本
- 确保钱包有足够的BNB支付gas费用和claim fees

⚠️ **使用建议**：
- 脚本会在钱包之间添加3秒延迟，避免请求过快
- 如果某个钱包处理失败，脚本会继续处理下一个钱包
- 所有操作都有详细的日志输出，方便排查问题
- 每次claim需要支付一定的BNB作为fees，脚本会自动计算并发送

## 输出示例

### 示例1：金额小于阈值（跳过claim）
```
🚀 TokenTable Airdrop Claim 自动化脚本
==================================================
成功读取 2 个钱包

📊 进度: 1/2

🔐 处理钱包: 0x1234567890abcdef1234567890abcdef1234567890
==================================================
✅ 钱包 0x1234567890abcdef1234567890abcdef1234567890 登录成功

📋 找到 2 个可领取的claim:
  1. Claim ID: 0x5707779e7c3a65e71716f4f0cb9f0b91b05384c6b1e3b163a97fba094d8b04f1
     金额: 0.06 UPTOP
     解锁时间: 2024/10/25 12:00:00
  2. Claim ID: 0x683c6d80721c2d9586f0ea1011184be051e956b3875262c97c4e9f5012bf5a91
     金额: 0.00129 UPTOP
     解锁时间: 2024/10/25 11:50:00

💰 总金额: 0.06129 UPTOP
📊 最小阈值: 0.1 UPTOP
⏭️  金额 0.06129 UPTOP 小于阈值 0.1 UPTOP，跳过claim
```

### 示例2：金额大于阈值（执行claim）
```
🔐 处理钱包: 0xabcdef1234567890abcdef1234567890abcdef123456
==================================================
✅ 钱包 0xabcdef1234567890abcdef1234567890abcdef123456 登录成功

📋 找到 1 个可领取的claim:
  1. Claim ID: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
     金额: 0.5 UPTOP
     解锁时间: 2024/10/25 12:00:00

💰 总金额: 0.5 UPTOP
📊 最小阈值: 0.1 UPTOP
✅ 金额 0.5 UPTOP 大于阈值 0.1 UPTOP，继续claim
✅ 成功获取 1 个签名

🚀 开始claim交易...
合约地址: 0x30f333e932e7965f728AF513aa06E1350eD6Aee2
钱包地址: 0xabcdef1234567890abcdef1234567890abcdef123456
Claim数量: 1
需要发送BNB: 0.00021 BNB (用于支付fees)
📝 交易已发送，Hash: 0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
⏳ 等待确认...
✅ 交易确认成功！
Gas使用: 150000
区块号: 12345678
🎉 Claim完成！

🎯 处理完成！成功: 1/2
```

## 故障排除

### 常见问题

1. **私钥格式错误**
   - 确保私钥是64位十六进制字符串
   - 脚本会自动添加0x前缀

2. **网络连接问题**
   - 检查BSC RPC URL是否可用
   - 可以尝试更换其他BSC RPC提供商

3. **BNB余额不足**
   - 确保钱包有足够的BNB支付gas费用和claim fees
   - 可以调整gas limit和gas price

4. **API请求失败**
   - 检查网络连接
   - 确认API地址是否正确
   - 可能需要更换IP或使用代理

## 许可证

MIT License 