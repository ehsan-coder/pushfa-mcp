import { randomUUID } from 'node:crypto';

import { callApi, unexpectedResponse } from './client.mjs';
import { invalidArgument, reports, ToolError, uuidPattern } from './schemas.mjs';

const draftLifetimeMs = 5 * 60 * 1000;
const drafts = new Map();

function prepareDraft(operation, schema, args) {
    const payload = { ...args };
    if (operation.kind === 'send') {
        payload.title = args.title.trim();
        payload.body = args.body.trim();
        if (payload.topic !== undefined) payload.topic = payload.topic.trim();
        if (payload.subscriber_id !== undefined) payload.subscriber_id = payload.subscriber_id.toLowerCase();
        payload.send_time ??= 'current';
        if ((payload.send_time === 'delay') !== (payload.time !== undefined)) {
            throw invalidArgument('Provide time exactly when send_time is delay.');
        }
        for (const field of Object.keys(reports)) {
            if (Object.hasOwn(schema.properties, field)) payload[field] ??= false;
        }
    }

    const now = Date.now();
    for (const [id, draft] of drafts) {
        if (draft.expiresAt <= now) drafts.delete(id);
    }
    if (drafts.size >= 20) {
        throw new ToolError('MCP_DRAFT_LIMIT', 'There are 20 pending previews. Use an approved draft or wait for it to expire.');
    }

    const id = randomUUID();
    const expiresAt = now + draftLifetimeMs;
    drafts.set(id, { operation, payload, expiresAt });
    const preview = Object.hasOwn(payload, 'grant') ? { ...payload, grant: '[redacted]' } : payload;
    return { draft_id: id, expires_at: new Date(expiresAt).toISOString(), operation: operation.endpoint, preview };
}

async function confirmDraft(draftId, kinds) {
    const id = draftId.toLowerCase();
    const draft = drafts.get(id);
    if (!draft || draft.expiresAt <= Date.now()) {
        drafts.delete(id);
        throw new ToolError('MCP_DRAFT_UNAVAILABLE', 'This preview has expired, was already used, or belongs to a different MCP process.');
    }
    const { operation, payload } = draft;
    if (!kinds.includes(operation.kind)) {
        throw invalidArgument('Use the confirmation tool for this draft’s operation type.');
    }

    // Consume before the network request, even if the outcome is unknown.
    drafts.delete(id);
    const data = await callApi(operation.endpoint, payload, operation);
    if (operation.kind === 'send') {
        const singleId = typeof data?.notification_id === 'string' && uuidPattern.test(data.notification_id);
        if (!singleId && !Array.isArray(data?.notification_ids)) throw unexpectedResponse('send');
    }

    return { ...operation.project(data), accepted: true };
}

export { prepareDraft, confirmDraft };
