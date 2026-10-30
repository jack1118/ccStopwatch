#!/bin/zsh
# 在 Mac mini 上一鍵：打包網頁 → 建置模擬器版 iOS app（免簽名）→ 裝到模擬器並啟動
# 前置（一次性）：iOS 27.0 模擬器 runtime、名為 ccsw-iPhone 的模擬器（或用第一個參數指定 UDID）
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH=/opt/homebrew/bin:$PATH

SIM=${1:-ccsw-iPhone}
DD=~/cc/ccsw-dd-sim
APP_ID=io.github.jack1118.ccstopwatch

xcrun simctl boot "$SIM" 2>/dev/null || true   # 已開機會回錯，略過
npm run build:ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "platform=iOS Simulator,name=$SIM" -derivedDataPath $DD \
  CODE_SIGNING_ALLOWED=NO build -quiet
xcrun simctl install "$SIM" $DD/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch --terminate-running-process "$SIM" $APP_ID
