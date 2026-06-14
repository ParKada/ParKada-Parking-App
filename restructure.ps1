mkdir apps -ErrorAction SilentlyContinue

Rename-Item -Path client -NewName admin
Move-Item -Path admin -Destination apps\

Move-Item components.json apps\admin\
Move-Item package.json apps\admin\
Move-Item server.js apps\admin\
Move-Item tsconfig.json apps\admin\
Move-Item tsconfig.node.json apps\admin\
Move-Item vercel.json apps\admin\
Move-Item vite.config.ts apps\admin\

Rename-Item -Path ParKada-mobile -NewName mobile
Move-Item -Path mobile -Destination apps\

mkdir packages -ErrorAction SilentlyContinue
mkdir packages\shared -ErrorAction SilentlyContinue

Move-Item apps\admin\src\supabaseClient.ts packages\shared\
Move-Item apps\admin\src\types\database.types.ts packages\shared\
Move-Item apps\admin\src\services\FutureFeaturesService.ts packages\shared\
