module.exports = {
    apps: [
        {
            name: "estoura-balao",
            script: "server/index.js",
            env: {
                NODE_ENV: "production",
                PORT: 3001
            },
            watch: false,
            instances: 1,
            exec_mode: "fork"
        }
    ]
};
