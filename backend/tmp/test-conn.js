const net = require('net');
const client = new net.Socket();
client.connect(16359, 'pg-a961153-hoandinh-5401.j.aivencloud.com', () => {
    console.log('Connected to DB host');
    client.destroy();
});
client.on('error', (err) => {
    console.error('Connection failed:', err.message);
    client.destroy();
});
