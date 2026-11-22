import { callApi, unexpectedResponse } from './client.mjs';
import { enabled } from './config.mjs';
import { confirmDraft, prepareDraft } from './drafts.mjs';
import { guideUrls, readInstallationGuide } from './guides.mjs';
import {
    actions, aliasAudience, audience, bool, choice, deviceInput, fcmToken, groupInput, input,
    integer, isObject, keyName, list, message, profileFields, profileId, reports, scalarMap, string, text,
    topicId, uuid, uuidPattern, webhook,
} from './schemas.mjs';

const tools = [
    {
        name: 'pushfa_read_installation_guide',
        description: 'Read the current official Markdown guide before installing or upgrading Pushfa in a Web Push, native Android, or native iOS project. The first page includes section offsets; continue with next_offset or jump to a section using the returned revision.',
        inputSchema: input({
            platform: { ...choice(...Object.keys(guideUrls)), description: 'Use web for websites and PWAs, including Web Push on iOS.' },
            offset: { ...integer(0), description: 'Omit for the first page, or pass next_offset or a section offset from this guide.' },
            revision: { type: 'string', pattern: '^[a-f0-9]{64}$', description: 'Required when reading from a nonzero offset. Use the returned revision.' },
        }, ['platform']),
        annotations: { readOnlyHint: true },
        run: readInstallationGuide,
    },
];

if (enabled.read) tools.push(
    {
        name: 'pushfa_get_subscriber_state',
        description: 'Check whether up to 25 known Pushfa subscriber IDs exist and have an active push subscription. Includes topic IDs.',
        inputSchema: input({ subscriber_ids: list(text(191, 'A Pushfa subscriber ID.'), 25) }),
        annotations: { readOnlyHint: true },
        run: async ({ subscriber_ids }) => {
            const ids = [...new Set(subscriber_ids.map(id => id.trim()).map(id => uuidPattern.test(id) ? id.toLowerCase() : id))];
            const data = await callApi('subscribers/state', { subscriber_ids: ids });
            if (!Array.isArray(data?.subscribers)) throw unexpectedResponse();

            return {
                subscribers: data.subscribers.map(({ subscriber_id, exists, has_push, invalidated_at, topics }) => ({
                    subscriber_id,
                    exists,
                    push_active: has_push,
                    invalidated_at: invalidated_at ?? null,
                    topic_ids: topics ?? [],
                })),
            };
        },
    },
    {
        name: 'pushfa_get_notification_status',
        description: 'Check queue, send, delivery and click status for up to 1000 notification IDs. Returns the failure code for failed sends.',
        inputSchema: input({ notification_ids: list(uuid, 1000) }),
        annotations: { readOnlyHint: true },
        run: async ({ notification_ids }) => {
            const ids = [...new Set(notification_ids.map(id => id.toLowerCase()))];
            const data = await callApi('check-notification-status', { notification_ids: ids });
            if (!Array.isArray(data?.[0])) throw unexpectedResponse();

            const notifications = data[0].map(({ id, status, is_clicked, send_at, sent_at, delivered_at, clicked_at, failure_code }) => ({
                notification_id: id, status, is_clicked, send_at, sent_at, delivered_at, clicked_at, failure_code,
            }));
            const found = new Set(notifications.map(row => row.notification_id.toLowerCase()));

            return { notifications, missing_notification_ids: ids.filter(id => !found.has(id)) };
        },
    },
);

// Backend routes under /api/webservices. Each preparation tool binds the
// exact method, endpoint, and arguments to its one-use confirmation ID.
apiTool('get_alias', 'alias/get', 'Get the primary alias for a subscriber.', deviceInput());
apiTool('get_custom_aliases', 'aliases/get', 'Get a subscriber’s labeled custom aliases.', deviceInput());
apiTool('get_brackets', 'brackets/get', 'Get a subscriber’s personalization properties.', deviceInput());
apiTool('get_user_topics', 'topics/user-topics', 'Get the topics a subscriber belongs to.', deviceInput(), {
    project: topics => ({ topics }),
});
apiTool('get_topic_members', 'topics/topic-members', 'Get up to 100 topic members with subscriber ID, device and active push status.', input({ topic_uuid: topicId }), {
    project: members => ({
        members: members.map(({ subscriber_id, device, is_valid, token }) => ({
            subscriber_id, device, push_active: is_valid === true && Boolean(token),
        })),
    }),
});

apiTool('prepare_notification', 'send-single-message', 'Send one normal notification by subscriber_id or fcm_token.', deviceInput(
    { ...message, ...actions, ...reports, ...webhook }, ['title', 'body'],
), { kind: 'send' });
apiTool('prepare_lite_notification', 'send-single-lite-message', 'Send one Lite notification by subscriber_id or fcm_token.', deviceInput(
    message, ['title', 'body'],
), { kind: 'send' });
apiTool('prepare_group_notification', 'send-group-message', 'Send normal notifications to subscriber IDs, FCM tokens, or a topic, with optional reports.', groupInput(
    { ...message, ...actions, ...reports, ...webhook, ...audience },
), { kind: 'send' });
apiTool('prepare_group_lite_notification', 'send-group-lite-message', 'Send Lite notifications to subscriber IDs, FCM tokens, or a topic.', groupInput(
    { ...message, ...audience },
), { kind: 'send' });
apiTool('prepare_send_via_alias', 'send-via-user-alias-id', 'Send to devices matching the primary alias (external ID).', input({
    alias: text(255, 'Primary alias.'), ...message, ...actions, ...reports, ...aliasAudience,
}, ['alias', 'title', 'body']), { kind: 'send' });
apiTool('prepare_send_via_subscriber_id', 'send-via-subscriber-id', 'Send to one or more subscriber IDs and get per-recipient results.', input({
    subscriber_ids: list(profileId), ...message, ...actions, ...reports, ...audience,
}, ['subscriber_ids', 'title', 'body']), { kind: 'send' });
apiTool('prepare_send_via_custom_alias', 'send-via-alias', 'Send to subscribers whose custom alias label matches any supplied value.', input({
    label: keyName, values: list(text(191, 'Custom alias value.'), 100), ...message, ...actions, ...reports, ...aliasAudience,
}, ['label', 'values', 'title', 'body']), { kind: 'send' });
apiTool('prepare_send_to_topic', 'send-quickly-to-topic', 'Send to a topic with the dedicated topic webservice.', input({
    topic: topicId, ...message, ...actions,
}, ['topic', 'title', 'body']), { kind: 'send' });

apiTool('prepare_set_alias', 'alias/set', 'Set the primary alias for a subscriber.', deviceInput({
    alias: text(191, 'Primary alias.'),
}), { kind: 'manage' });
apiTool('prepare_delete_alias', 'alias/delete', 'Delete the primary alias for a subscriber.', deviceInput(), { kind: 'manage' });
apiTool('prepare_add_custom_aliases', 'aliases/add', 'Add or update a subscriber’s labeled custom aliases.', deviceInput({
    aliases: scalarMap(191),
}), { kind: 'manage' });
apiTool('prepare_remove_custom_aliases', 'aliases/remove', 'Remove selected custom alias labels from a subscriber.', deviceInput({
    labels: list(keyName, 50),
}), { kind: 'manage' });
apiTool('prepare_add_brackets', 'brackets/add', 'Add or update a subscriber’s personalization properties.', deviceInput({
    brackets: scalarMap(1000),
}), { kind: 'manage' });
apiTool('prepare_remove_brackets', 'brackets/remove', 'Remove selected personalization properties from a subscriber.', deviceInput({
    keys: list(keyName, 50),
}), { kind: 'manage' });
apiTool('prepare_set_test_user', 'test-user/set', 'Mark a subscriber as a test user.', deviceInput(), { kind: 'manage' });
apiTool('prepare_unset_test_user', 'test-user/unset', 'Remove a subscriber’s test user flag.', deviceInput(), { kind: 'manage' });
apiTool('prepare_create_topic', 'topics/create', 'Create a topic and set its optional membership and JavaScript permissions.', input({
    name: text(255, 'Topic name.'),
    send_membership_notification: bool,
    allow_js_register: bool,
    allow_js_unregister: bool,
    allow_js_get: bool,
}, ['name']), { kind: 'manage' });
apiTool('prepare_subscribe_to_topic', 'topics/subscribe', 'Subscribe a subscriber to a topic.', deviceInput({ topic_uuid: topicId }), { kind: 'manage' });
apiTool('prepare_unsubscribe_from_topic', 'topics/unsubscribe', 'Unsubscribe a subscriber from a topic.', deviceInput({ topic_uuid: topicId }), { kind: 'manage' });
apiTool('prepare_upsert_retenx_profile', 'retention/profiles/upsert', 'Create or update a RetenX profile by subscriber ID, external ID or custom aliases.', {
    ...input({ ...profileFields, aliases: { ...profileFields.aliases, minProperties: 1 } }, []),
    anyOf: ['subscriber_id', 'external_id', 'aliases'].map(key => ({ required: [key] })),
}, { kind: 'manage', raw: result => isObject(result.data), project: result => result.data });
apiTool('prepare_record_retenx_event', 'retention/events', 'Record a RetenX event. Active campaigns can act on it.', {
    ...input({
        ...profileFields,
        fcm_token: fcmToken,
        identity_key: keyName,
        identity_value: text(191, 'Custom identity value.'),
        event_name: text(128, 'RetenX event name.'),
        event_time: { ...string, description: 'Optional event timestamp with timezone.' },
        idempotency_key: uuid,
        params: { type: ['object', 'array', 'string'], description: 'Event parameters or a JSON-encoded parameter map.' },
    }, ['event_name']),
    not: { required: ['subscriber_id', 'fcm_token'] },
}, { kind: 'manage', raw: result => result.status === 'success' });

if (enabled.send) {
    tools.push({
        name: 'pushfa_send_notification',
        description: 'Submit an approved send draft. Returns notification IDs and any rejected recipients. Standard Pushfa fees apply. Each draft permits one attempt.',
        inputSchema: input({ draft_id: uuid }),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
        run: ({ draft_id }) => confirmDraft(draft_id, ['send']),
    });
}

if (enabled.manage) {
    tools.push({
        name: 'pushfa_confirm_management',
        description: 'Execute a management draft after the user explicitly approves it. Each draft permits one attempt.',
        inputSchema: input({ draft_id: uuid }),
        annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
        run: ({ draft_id }) => confirmDraft(draft_id, ['manage']),
    });
}

function apiTool(name, endpoint, description, inputSchema, {
    kind = 'read', raw, project = asToolData,
} = {}) {
    if (!enabled[kind]) return;

    const operation = { endpoint, kind, raw, project };
    const preparing = kind !== 'read';
    tools.push({
        name: `pushfa_${name}`,
        description: preparing ? `${description} Preview only. Show the preview and request approval.` : description,
        inputSchema,
        annotations: preparing
            ? { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
            : { readOnlyHint: true },
        run: preparing
            ? args => prepareDraft(operation, inputSchema, args)
            : async args => project(await callApi(endpoint, args)),
    });
}

function asToolData(data) {
    return isObject(data) ? data : { data };
}

export { tools };
