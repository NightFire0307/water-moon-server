module.exports = {
  apps: [
    {
      name: 'nest-app',
      script: 'dist/main.js', // 入口文件
      autorestart: true, // 自动重启,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
