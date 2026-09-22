# =============================================================
# 纹藏 · GitHub Pages 一键部署脚本
# 用法（在任意终端执行）：
#   powershell -ExecutionPolicy Bypass -File scripts\deploy-pages.ps1
# 作用：构建最新代码 → 推送到 GitHub gh-pages 分支 → Pages 自动更新
# 部署地址：https://liaiaaa.github.io/wencang-app/ （1~2分钟生效）
# =============================================================
$ErrorActionPreference = "Stop"

# 工程根目录（脚本位于 scripts/ 下）
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> [1/3] 构建部署包（mock 模式，base=/wencang-app/）..." -ForegroundColor Cyan
pnpm run build:gitee
if ($LASTEXITCODE -ne 0) { throw "构建失败，请先修复报错再部署" }

Set-Location dist-gitee

# 确保 GitHub 远端存在（首次部署/目录重建后自动补配）
$remoteUrl = git remote get-url github 2>$null
if (-not $remoteUrl) {
    git remote add github https://github.com/liaiaaa/wencang-app.git
    Write-Host "已补配 GitHub 远端" -ForegroundColor Yellow
}

Write-Host "==> [2/3] 提交本次构建..." -ForegroundColor Cyan
git add -A
git commit -m "deploy $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
# 无变更时 commit 会提示 nothing to commit，不影响继续推送

Write-Host "==> [3/3] 推送到 GitHub Pages..." -ForegroundColor Cyan
git push -f github gh-pages
if ($LASTEXITCODE -ne 0) { throw "推送失败：检查网络，或重新登录 GitHub 凭据" }

Write-Host ""
Write-Host "==> 部署完成！1~2 分钟后以下地址即为最新版本：" -ForegroundColor Green
Write-Host "    https://liaiaaa.github.io/wencang-app/" -ForegroundColor Green
