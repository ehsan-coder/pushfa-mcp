const apiUrl = 'https://pushfa.com/api/webservices/';
const publicKey = process.env.PUSHFA_API_PUBLIC_KEY?.trim();
const privateKey = process.env.PUSHFA_API_PRIVATE_KEY?.trim();
const serviceConfigured = Boolean(publicKey && privateKey);
const enabled = {
    read: serviceConfigured,
    send: serviceConfigured && process.env.PUSHFA_MCP_ENABLE_SEND === 'true',
    manage: serviceConfigured && process.env.PUSHFA_MCP_ENABLE_MANAGEMENT === 'true',
};

export { apiUrl, publicKey, privateKey, enabled };
