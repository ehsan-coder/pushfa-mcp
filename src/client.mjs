import { apiUrl, publicKey, privateKey } from './config.mjs';
import { isObject, ToolError } from './schemas.mjs';

function unexpectedResponse(kind = 'read', httpStatus) {
    const details = httpStatus === undefined ? {} : { http_status: httpStatus };
    if (kind === 'send') {
        return new ToolError('MCP_SEND_OUTCOME_UNKNOWN', 'Pushfa did not confirm whether the message was accepted. Check the panel before attempting another send.', details);
    }
    if (kind !== 'read') {
        return new ToolError('MCP_OPERATION_OUTCOME_UNKNOWN', 'Pushfa did not confirm the operation outcome. Check its state before trying again.', details);
    }
    return new ToolError('MCP_API_UNAVAILABLE', 'Could not obtain a valid response from Pushfa.', details);
}

async function callApi(endpoint, payload, { method = 'POST', kind = 'read', raw } = {}) {
    let response;
    let result;
    try {
        response = await fetch(apiUrl + endpoint, {
            method,
            headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, api_public_key: publicKey, api_private_key: privateKey }),
            redirect: 'error',
            signal: AbortSignal.timeout(20_000),
        });
        result = await response.json();
    } catch {
        throw unexpectedResponse(kind, response?.status);
    }

    if (!isObject(result) || response.status >= 500) throw unexpectedResponse(kind, response.status);
    if (!response.ok || result.errors === true) {
        let errorCode = response.status === 401 ? 'INVALID_API_KEYS' : 'MCP_API_ERROR';
        if (typeof result.error_code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(result.error_code)) {
            errorCode = result.error_code;
        }
        const details = { http_status: response.status };
        for (const field of ['recipient', 'type', 'alias', 'topic', 'rejected_recipients', 'last_visit', 'fallback_required']) {
            if (isObject(result.data) && Object.hasOwn(result.data, field)) details[field] = result.data[field];
        }
        if (isObject(result.errors)) details.invalid_fields = Object.keys(result.errors);
        const message = result.errors === true && typeof result.message === 'string'
            ? result.message
            : 'Pushfa rejected the request.';
        throw new ToolError(errorCode, message, details);
    }
    if (raw) {
        if (!raw(result)) throw unexpectedResponse(kind, response.status);
        return result;
    }
    if (result.errors !== false) throw unexpectedResponse(kind, response.status);
    if (kind === 'send' && isObject(result.data)) {
        return { ...result.data, message: result.message };
    }

    return result.data;
}

export { callApi, unexpectedResponse };
