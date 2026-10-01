module.exports = {
  apps: [
    {
      name: 'zapix-ai',
      script: 'server/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
