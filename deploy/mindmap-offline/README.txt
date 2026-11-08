Mind Map 离线部署包（Windows Server 2012 R2 x64）
================================================

包内自带运行时，目标机不需要预装 Node.js / nginx，也不需要联网。

内容
----
runtimes\  自带运行时（Windows x64 便携版）
           node\   Node.js v18.20.8（官方 zip，无需安装）
           nginx\  nginx 1.26.2（官方 zip，无需安装）
web\        myweb 前端构建产物（nginx 静态根目录，协同地址已改为同源 /ws）
server\     后端源码 + 全部运行依赖 node_modules（无需 npm install）
nginx\      nginx 模板（deploy.ps1 生成运行时配置）
scripts\    一键部署、启动/重启、停止、卸载、自检脚本
config\     server.env（JWT_SECRET 由 deploy.ps1 首次生成）
logs\       运行日志、pid、deploy-state.json
docs\       部署文档、离线部署说明

目标系统
--------
Windows Server 2012 R2 x64（6.3.9600）。
版本锁定依据、Node 18 EOL 风险、前置组件结论见 docs\部署文档.md 第 1 节。
Node.js / nginx 都是便携 zip，不写注册表，不注册服务。

快速开始（Windows，一键部署）
---------------------------
1. 把 zip 解压到目标目录，例如 C:\mindmap
   Windows Server 2012 R2 默认 PowerShell 4.0 没有 Expand-Archive，
   可用资源管理器右键“全部解压缩”，或在 PowerShell 中执行：
     Add-Type -AssemblyName System.IO.Compression.FileSystem
     [System.IO.Compression.ZipFile]::ExtractToDirectory('D:\mindmap-offline-win2012r2-20261108.zip','C:\mindmap')
2. 执行一键部署（默认 Web 8080、API 3000）：
     powershell -ExecutionPolicy Bypass -File C:\mindmap\scripts\deploy.ps1
   可选：-WebPort 8081 -ApiPort 3001；-ForceSecret 重新生成 JWT_SECRET。
3. 脚本会自动生成配置、初始化 data/uploads、启动后端与 nginx、
   执行 4 项自检，并打印本机与局域网访问地址。
4. 在 Windows 10 / 11 客户端用当前版本的 Chrome 或 Edge 打开 http://<部署机IP>:8080/ ，注册账号即可使用。
   Chrome 离线安装包不包含在本压缩包内，单独存放在部署目录（与 zip 同级）：
   GoogleChromeStandaloneEnterprise64.msi，安装方法见 docs\离线部署说明.md 3.3。
5. 管理员权限执行时，deploy.ps1 会自动创建防火墙入站规则 "MindMap Web"
   （TCP 当前 Web 端口，所有网络配置文件）。若用普通账号执行或局域网仍不通，
   再用管理员 PowerShell 手工放行（改过端口时替换 8080）：
     New-NetFirewallRule -DisplayName "MindMap Web" -Direction Inbound -Protocol TCP -LocalPort 8080 -Action Allow -Profile Any

启动 / 重启 / 停止
--------------------
启动或重启（复用 config\server.env，不会重新生成 JWT_SECRET）：
  powershell -ExecutionPolicy Bypass -File C:\mindmap\scripts\start.ps1
  可选：-WebPort 8081 -ApiPort 3001；端口取自 deploy-state.json 或参数。
  重复执行 start.ps1 就是重启（内部先停旧实例）。
停止：powershell -ExecutionPolicy Bypass -File C:\mindmap\scripts\stop.ps1
卸载：powershell -ExecutionPolicy Bypass -File C:\mindmap\scripts\uninstall.ps1
      默认保留 data 与 uploads；加 -RemoveData 连数据一起删除。
      同时删除 deploy.ps1 创建的 "MindMap Web" 防火墙规则（需管理员权限）。

日志
----
logs\server.out.log、logs\server.err.log、logs\nginx-access.log、
logs\nginx-error.log、logs\deploy-state.json。

升级
----
停止服务并备份 config\server.env、server\data、server\uploads；
新包解压到新目录后把这三项复制进去，再执行 deploy.ps1。
不要覆盖或删除 data/uploads。

Linux
-----
包内只有 Windows x64 运行时，Linux 不能直接使用，也没有一键脚本。
需在联网机器准备 Node.js Linux tar.xz 与 nginx（发行版包或源码），
再手工启动后端（包内不提供 Linux 启动脚本）。详见 docs\离线部署说明.md 第 9 节。

详细说明
--------
docs\离线部署说明.md   从零部署、参数、故障排查
docs\部署文档.md       架构、版本依据、数据备份、升级回滚
runtimes\README.txt    运行时来源、SHA256、依赖检查结论

（包外）Chrome离线安装包说明.txt
                       Chrome 离线安装包来源、版本、SHA256、签名与安装命令
