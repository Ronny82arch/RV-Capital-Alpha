$env:Path += ";C:\Users\Ronny Visentin\AppData\Local\Temp\node\node-v20.14.0-win-x64"
Write-Host "Node version:"
node -v
Write-Host "NPM version:"
npm -v

Write-Host "Running npm run build..."
npm run build
