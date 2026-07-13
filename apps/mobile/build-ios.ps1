# One-time iOS build bootstrap (password-free via the App Store Connect API key).
#
# WHY you run this and not Claude: EAS can only CREATE the first iOS signing
# certificate in an interactive terminal (a real TTY). Claude's shell can't be a
# TTY, so this first build is the single step that needs your terminal. After it
# finishes, every later build/submit runs headless and Claude does them.
#
# HOW: open a normal PowerShell window (not double-click) and run:
#     powershell -ExecutionPolicy Bypass -File apps\mobile\build-ios.ps1
# At each prompt — "Generate a new Distribution Certificate?" and
# "Generate a new Provisioning Profile?" — just press Enter (default Yes).
# You will NOT be asked for an Apple ID password or 2FA (the API key handles it).

Set-Location $PSScriptRoot
$env:EXPO_ASC_API_KEY_PATH = Join-Path $PSScriptRoot 'credentials\AuthKey_NBCS2PKB2C.p8'
$env:EXPO_ASC_KEY_ID       = 'NBCS2PKB2C'
$env:EXPO_ASC_ISSUER_ID    = '8e4f665f-c380-4f06-a1a7-dfe131462cdb'
$env:EXPO_APPLE_TEAM_ID    = 'XMCWV24DRX'

eas build -p ios --profile production
