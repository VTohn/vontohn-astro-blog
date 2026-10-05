---
title: "SSH初体验"
published: 2026-09-09T22:06:22+08:00
description: "小梅找我说导师给他批下来一张5090,跑什么CV管线。很显然我并不知道什么CV管线什么多面体是啥，但是他要连接实验室的服务器————这下听懂了：用SSH啊。"
image: ''
tags: ["SSH", "网络", "Linux", "教程"]
category: "技术"
draft: false
lang: ''
---
## 前情提要
小梅找我说导师给他批下来一张5090,跑什么CV管线。很显然我并不知道什么CV管线什么多面体是啥，但是他要连接实验室的服务器————这下听懂了：用SSH啊。

## SSH简介
SSH（Secure Shell，安全外壳协议）是一套**加密的远程登录协议**：它让客户端通过网络登录到一台远程主机，像坐在那台机器前面一样执行命令、传文件、跑程序。相比老旧的明文协议（telnet、ftp），SSH 的所有通信都是加密的——即使流量被截获，也看不到密码和内容。

关于SSH你需要了解的基础知识：

- **默认端口 22**：服务端进程叫 `sshd`，客户端命令就是 `ssh`；
- **C/S 架构**：客户端发起连接，服务端监听端口等待连接；
- **加密分两层**：用非对称加密（RSA / Ed25519）完成身份认证和密钥交换，再用对称加密加密后续所有数据；
- 一次认证之后通常可以**免密**：把客户端的公钥放进服务端的 `authorized_keys`，以后登录不再输密码。

## SSH配置方法

下面以「Windows 本机（客户端） → 机房 Ubuntu（服务端）」为例。

- ### 服务端

    ```bash
    # 1. 安装并启动 sshd
    sudo apt update
    sudo apt install -y openssh-server
    sudo systemctl enable --now ssh    # 开机自启 + 立即启动

    # 2. 查看自己的地址，记下来（wlan0/enp* 下的 192.168.x.x）
    ip a
    ```

    服务端几乎全部行为都由 `/etc/ssh/sshd_config` 控制，常用项：

    | 配置项 | 建议 | 说明 |
    |---|---|---|
    | `Port 22` | 保持默认 | 改端口能少挨扫描，但不是安全手段 |
    | `PermitRootLogin no` | 推荐 | 禁止 root 直接登录 |
    | `PubkeyAuthentication yes` | 推荐 | 允许公钥免密登录 |
    | `PasswordAuthentication yes` | 调试期 yes，配好密钥后改 no | 关掉后只能靠密钥登录，更安全 |
    | `X11Forwarding yes` | 图形转发必需 | 下文「图形化窗口？」依赖它 |
    | `X11UseLocalhost yes` | 默认即可 | 转发只绑定本机回环 |
    
    改完配置后：
    
    ```bash
    sudo sshd -t                     # 语法自检，有错误会直接报出来
    sudo systemctl restart ssh
    sudo ufw allow 22/tcp            # 如果开了 ufw 防火墙才需要
    ```
    
    Windows主机也可以做服务端，但
    1. Windows系统不如Debian等Linux发行版稳定
    2. Windows系统的内存优化较Linux相比保守，长时间运行容易产生内存碎片
    3. 如果要跑图形程序，Linux端的体验较好  


- ### 客户端

    Windows 10/11 自带 OpenSSH 客户端，也可在*可选安装*里查看。验证：
    
    ```powershell
    ssh -V     # 输出 OpenSSH_for_Windows_9.x ... 就说明可用
    ```
    
    *如果提示找不到 ssh，有可能是装好了但 `C:\Windows\System32\OpenSSH` 没进 PATH。*


## SSH连接

**登录**：

```bash
ssh 用户名@主机IP或域名     # 首次连接会询问是否信任对方主机指纹，输 yes
```

配置免密登录（一劳永逸，后续图形转发也用它）：

```powershell
# 1. 生成密钥对（Windows 与 Linux 通用命令）
ssh-keygen -t ed25519

# 2. 把公钥装到服务端。Windows 没有 ssh-copy-id，手动追加：
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | ssh 用户名@192.168.x.x "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys"
```

## 图形窗口？Wayland? 

ssh 本身不开图形窗口，它是纯命令行工具。 想让远程的程序窗口出现在本地屏幕上，靠的是 **X11 转发**：ssh 把「画窗口的图形指令流」加密传回本地，而本地必须有一个 X 服务器负责把它画出来。

关键差异就在这里：

- Linux 桌面自带 X 服务 → `ssh -X` 敲 `gedit` 直接弹窗，体验和本地终端一样；
- Windows 没有内置 X 服务器 → 缺的不是 ssh，是本地「画窗口」的那一环。

所以在 Windows 上要补一个 X 服务器，推荐 VcXsrv：

```powershell
winget install --id marha.VcXsrv --accept-source-agreements --accept-package-agreements
```

启动 XLaunch 时的关键选项：

- Display settings → Multiple windows，Display number = 0
- Client startup → Start no client
- 最后一步勾选 Disable access control（否则 ssh 转发上来的连接会被本地 X 服务器拒绝）

然后连上服务端跑程序：

```powershell
ssh -X lab        # 或 ssh -X 用户名@192.168.x.x
```

```bash
xeyes        # 最简单的验证：出现两只跟着鼠标走的眼睛
gedit        # 或 firefox / gnome-text-editor
```

窗口会出现在 Windows 屏幕上，体验与本地一致。

**Wayland 说明**：机房 Pop!_OS 默认是 Wayland 会话，但这不影响 ssh 转发——ssh 登录会话里没有 `WAYLAND_DISPLAY`，程序会自动退回 X11 后端走转发通道。个别 Qt 程序不老实，手动指定一下即可：

```bash
export QT_QPA_PLATFORM=xcb
```

常见报错对照：

| 现象 | 原因 | 解决 |
|---|---|---|
| `X11 forwarding request failed on channel 0` | 服务端缺 xauth 或没开转发 | `sudo apt install xauth`，确认 `X11Forwarding yes` |
| `Connection refused` | sshd 没起来 | `sudo systemctl enable --now ssh` |
| `cannot open display` | 忘了 `-X`，或 VcXsrv 没开 / 没勾 Disable access control | 重连 `ssh -X`，检查 XLaunch 设置 |
| 窗口黑屏 / 一闪而过 | Qt 程序在 Wayland 下闹别扭 | `export QT_QPA_PLATFORM=xcb` 后重跑 |

## 校园网？VPN?

通用流程（校外 → 机房）：

1. 按学校信息化页面指引下载并登录 VPN 客户端（一般用校园网账号）；
2. 确认已进校园网：`ping 机房IP`，或看虚拟网卡是否拿到内网地址；
3. 再执行 ssh 并转发图形：

```powershell
ssh -X 用户名@机房内网IP
```

顺序很重要：**先连 VPN，再 ssh**。反过来隧道会指向一个不可达地址。

> 以西南大学为例，官方入口是 `vpn.swu.edu.cn`（[系统简介](http://vpn.swu.edu.cn/info/1003/1001.htm)）；若只是想在校外查文献下论文，还可以走图书馆的 [CARSI 直连](https://lib.swu.edu.cn/category8/detail_3218.shtml) 或 [VPN/代理](https://lib.swu.edu.cn/category299/detail_1097.shtml) 途径，不一定需要能跑 ssh 的 VPN。

没有合适客户端 VPN 时的替代思路： 反向隧道 / 内网穿透：只要能偶尔进一次机房，让机器主动向外连一条隧道到你控制的公网机器（`ssh -R`、frp、Tailscale、ZeroTier），之后在外面直连即可，绕开校园 VPN 对任意流量的限制；
