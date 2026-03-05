import { spawn } from 'child_process';

console.log('🚀 Starting GrowthScout CRM Dual Server...');
console.log('⏳ Booting Backend first to prevent proxy errors...');

// Start Backend
const backend = spawn('npx', ['tsx', 'server/index.ts'], {
    stdio: 'inherit',
    shell: true
});

let frontend;

// Delay frontend startup by 2 seconds to allow backend to bind to port 5001 first.
setTimeout(() => {
    console.log('\n🟢 Backend initialized. Starting Frontend (Vite)...');
    frontend = spawn('npx', ['vite'], {
        stdio: 'inherit',
        shell: true
    });

    frontend.on('close', code => {
        if (code !== 0 && code !== null) {
            console.log(`❌ Frontend exited with code ${code}. Shutting down...`);
            backend.kill('SIGINT');
            process.exit(code);
        }
    });
}, 2000);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nClosing servers...');
    backend.kill('SIGINT');
    if (frontend) frontend.kill('SIGINT');
    process.exit();
});

backend.on('close', code => {
    if (code !== 0 && code !== null) {
        console.log(`❌ Backend exited with code ${code}. Shutting down...`);
        if (frontend) frontend.kill('SIGINT');
        process.exit(code);
    }
});
