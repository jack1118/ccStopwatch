#!/bin/zsh
# 在 Mac mini 上一鍵：打包網頁 → 建置 iOS app → 用專用鑰匙圈簽名 → 裝到接著的 iPhone
# 前置（一次性）：~/Library/Keychains/ccsw-signing.keychain-db 內有 Apple Development 身分，
#   密碼在 ~/.ccsw-signing/kc-pass；iPhone UDID 在 ~/.ccsw-signing/device（或用第一個參數指定）
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH=/opt/homebrew/bin:$PATH

KC=~/Library/Keychains/ccsw-signing.keychain-db
DEVICE=${1:-$(cat ~/.ccsw-signing/device)}
DD=~/cc/ccsw-dd

# SSH 連線打不開登入鑰匙圈，簽名改用專用鑰匙圈並放到搜尋順序最前面
security unlock-keychain -p "$(cat ~/.ccsw-signing/kc-pass)" $KC
security list-keychains -d user -s $KC ~/Library/Keychains/login.keychain-db

npm run build:ios
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=$DEVICE" -derivedDataPath $DD -allowProvisioningUpdates \
  OTHER_CODE_SIGN_FLAGS="--keychain $KC" build -quiet
xcrun devicectl device install app --device "$DEVICE" $DD/Build/Products/Debug-iphoneos/App.app
