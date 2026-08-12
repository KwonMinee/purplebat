#!/usr/bin/env bash
# ============================================================
# 보라박쥐단 홈페이지 - Figma 이미지 다운로드 스크립트 (macOS/Linux)
# ------------------------------------------------------------
# 사용법: 터미널에서 이 폴더로 이동한 뒤
#   chmod +x download-assets.sh && ./download-assets.sh
# 을 실행하세요. public/assets 폴더에 이미지가 저장됩니다.
#
# 주의: 아래 URL은 Figma가 발급한 임시 링크로, 약 7일 후 만료됩니다.
# 만료되면 Figma에서 이미지를 다시 내보내(Export) 같은 파일명으로
# public/assets 폴더에 넣어주세요.
# ============================================================

set -uo pipefail
cd "$(dirname "$0")"
mkdir -p public/assets

declare -A files=(
  [hero-bg.png]="https://www.figma.com/api/mcp/asset/5d2596c6-dbbb-403a-a25d-d21f25c8fecc.png"
  [logo-hero.png]="https://www.figma.com/api/mcp/asset/2ff778ac-2891-40d8-a7fe-d39444921a81.png"
  [archive-1.png]="https://www.figma.com/api/mcp/asset/11112290-fa09-4f8b-b918-92b8ac0fc5f5.png"
  [archive-2.png]="https://www.figma.com/api/mcp/asset/c5f5130a-a5b5-4763-b32b-616309e7c2c8.png"
  [archive-3.png]="https://www.figma.com/api/mcp/asset/c7ca375b-a5cd-4723-a02f-c979ee1e9d20.png"
  [archive-4.png]="https://www.figma.com/api/mcp/asset/e93b156f-4184-4f15-8f79-f0c72ce8f8da.png"
  [game-thumb.png]="https://www.figma.com/api/mcp/asset/ec16122b-6720-4913-b29d-be9d20a903a9.png"
  [char-argon.png]="https://www.figma.com/api/mcp/asset/531146b6-b365-464b-8c0d-41a166497cbb.png"
  [char-bruka.png]="https://www.figma.com/api/mcp/asset/9817c80a-9521-467c-bea2-6939f2fc2732.png"
  [char-elia.png]="https://www.figma.com/api/mcp/asset/98ab1c93-d50b-405c-8d25-51fb0d77836d.png"
  [char-leon.png]="https://www.figma.com/api/mcp/asset/6f42a440-3979-40e4-a8e2-b680640c6d52.png"
  [char-jedrik.png]="https://www.figma.com/api/mcp/asset/b37f4770-9b15-4479-b58e-7a1cb29215c3.png"
  [goods-pin.png]="https://www.figma.com/api/mcp/asset/fb518916-1149-4ca6-bc48-65861ef57578.png"
  [goods-stand.png]="https://www.figma.com/api/mcp/asset/b90e262f-daa8-4191-8e9e-2b4223f27ece.png"
  [goods-notebook.png]="https://www.figma.com/api/mcp/asset/bb202282-af56-4ee0-a566-55e4ef9522cc.png"
  [goods-mug.png]="https://www.figma.com/api/mcp/asset/22cd066d-6636-4b5c-b2e6-d3f298228403.png"
  [nav-archive.png]="https://www.figma.com/api/mcp/asset/a3d0cd3c-9fe7-4006-a50e-cf99110e2902.png"
  [nav-minigame.png]="https://www.figma.com/api/mcp/asset/ff9b269f-82ca-46f7-8852-9de63b727bca.png"
  [nav-community.png]="https://www.figma.com/api/mcp/asset/96727f02-f7c0-43c6-b965-8fc356e81c82.png"
  [quote-bg.png]="https://www.figma.com/api/mcp/asset/dd1e22a0-5a01-4702-b7e6-9579d690fcf8.png"
  [footer-logo.png]="https://www.figma.com/api/mcp/asset/a665a945-ea64-48aa-b6b9-2ed8decbe7e8.png"
)

success=0
fail=0

for name in "${!files[@]}"; do
  url="${files[$name]}"
  if curl -sfL -o "public/assets/${name}" "$url"; then
    echo "OK    ${name}"
    success=$((success+1))
  else
    echo "FAIL  ${name}"
    fail=$((fail+1))
  fi
done

echo ""
echo "완료: 성공 ${success} / 실패 ${fail}"
if [ "$fail" -gt 0 ]; then
  echo "실패한 파일은 링크가 만료되었을 수 있습니다. Figma에서 다시 내보내 public/assets 폴더에 같은 이름으로 넣어주세요."
fi
