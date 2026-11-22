const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = { type: 'string', format: 'uuid' };
const text = (maxLength, description) => ({ type: 'string', minLength: 1, maxLength, description });
const list = (items, maxItems) => ({ type: 'array', minItems: 1, maxItems, items });
const input = (properties, required = Object.keys(properties)) => ({
    type: 'object', properties, required, additionalProperties: false,
});
const exactlyOne = (schema, ...keys) => ({ ...schema, oneOf: keys.map(key => ({ required: [key] })) });
const string = { type: 'string', minLength: 1 };
const bool = { type: 'boolean' };
const choice = (...values) => ({ type: 'string', enum: values });
const integer = (minimum, maximum) => ({ type: 'integer', minimum, maximum });
const jsonContainer = { type: ['object', 'array'] };
const fcmToken = { ...string, description: 'Legacy FCM token. Prefer a stable subscriber_id when available.' };
const singleTarget = { subscriber_id: uuid, fcm_token: fcmToken };
const deviceInput = (properties = {}, required = Object.keys(properties)) => (
    exactlyOne(input({ ...singleTarget, ...properties }, required), 'subscriber_id', 'fcm_token')
);
const subscriberIds = list(uuid);
const topicId = { ...uuid, description: 'Pushfa topic UUID.' };
const groupTarget = {
    subscriber_ids: subscriberIds,
    fcm_tokens: list(fcmToken),
    topic: { ...string, description: 'Topic UUID, or the explicit value all to target the entire service.' },
};
const groupInput = properties => exactlyOne(
    input({ ...groupTarget, ...properties }, ['title', 'body']), 'subscriber_ids', 'fcm_tokens', 'topic',
);
const deepLink = { ...string, description: 'A web URL, supported app deep link, or service-relative path.' };
const button = input({ title: string, url: deepLink });
const message = {
    title: text(35, 'Notification title.'),
    body: text(150, 'Notification body.'),
    link_url: deepLink,
    image_url: { ...string, description: 'Absolute image URL.' },
    ttl: { type: 'integer', description: 'Time to live in seconds.' },
    send_time: choice('current', 'delay'),
    time: {
        type: 'string',
        pattern: '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$',
        description: 'Required for delay. Gregorian YYYY-MM-DD HH:mm in Asia/Tehran.',
    },
    collapse_id: text(100, 'Collapse ID when enabled for the service.'),
    silent: bool,
    additional_data: jsonContainer,
    throttle_rate_per_minute: integer(1, 1_000_000),
    last_visit: input({
        operator: choice('>=', '>', '<=', '<', '='),
        date: { ...string, description: 'today, today-N (up to 3650 days), or Gregorian YYYY-MM-DD.' },
    }),
};
const actions = { btn_left: button, btn_right: button };
const reports = {
    get_delivery_status: { ...bool, description: 'Request delivery reporting. Standard report fees apply. Defaults to false.' },
    get_click_status: { ...bool, description: 'Request click reporting. Standard report fees apply. Defaults to false.' },
};
const webhook = { webhook_url: { ...string, description: 'Absolute delivery webhook URL.' } };
const audience = {
    device: choice('all', 'mobile', 'desktop'),
    platform: choice('all', 'android', 'ios', 'desktop'),
    use_brackets: bool,
};
const aliasAudience = { ...audience, only_last_device: bool, smart_targeting: bool };
const profileId = text(191, 'Stable Pushfa subscriber ID.');
const keyName = text(100, 'Property name.');
const scalarMap = maxLength => ({
    type: 'object', minProperties: 1, maxProperties: 50,
    propertyNames: keyName,
    additionalProperties: { type: ['string', 'number', 'boolean', 'null'], maxLength },
});
const profileFields = {
    subscriber_id: profileId,
    external_id: text(191, 'Primary alias / external ID.'),
    aliases: {
        type: 'object', propertyNames: keyName,
        additionalProperties: { type: ['string', 'null'], maxLength: 191 },
    },
    properties: jsonContainer,
    device: choice('mobile', 'desktop'),
    platform: choice('android', 'ios', 'desktop'),
};

class ToolError extends Error {
    constructor(error_code, message, details = {}) {
        super(message);
        this.result = { error_code, message, ...details };
    }
}

const valueTypes = {
    array: Array.isArray,
    object: isObject,
    string: value => typeof value === 'string',
    boolean: value => typeof value === 'boolean',
    integer: Number.isInteger,
    number: Number.isFinite,
    null: value => value === null,
};

function invalidArgument(message) {
    return new ToolError('MCP_INVALID_ARGUMENT', message);
}

function validate(value, schema, field) {
    const fail = () => { throw invalidArgument(`Invalid value for ${field}.`); };
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some(type => valueTypes[type](value))) fail();
    if (schema.enum && !schema.enum.includes(value)) fail();

    if (typeof value === 'string') {
        if (schema.minLength && !value.trim()) fail();
        if (schema.maxLength !== undefined && [...value].length > schema.maxLength) fail();
        if (schema.format === 'uuid' && !uuidPattern.test(value)) fail();
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) fail();
    } else if (Array.isArray(value)) {
        if (value.length < (schema.minItems ?? 0) || value.length > (schema.maxItems ?? Infinity)) fail();
        if (schema.items) value.forEach((item, index) => validate(item, schema.items, `${field}[${index}]`));
    } else if (isObject(value)) {
        validateObject(value, schema, field);
    } else if (typeof value === 'number') {
        if (value < (schema.minimum ?? -Infinity) || value > (schema.maximum ?? Infinity)) fail();
    }
}

function validateObject(value, schema, field) {
    const entries = Object.entries(value);
    if (entries.length < (schema.minProperties ?? 0) || entries.length > (schema.maxProperties ?? Infinity)) {
        throw invalidArgument(`Invalid number of properties for ${field}.`);
    }
    const hasRequired = keys => keys.every(key => Object.hasOwn(value, key));
    if (schema.required && !hasRequired(schema.required)) {
        throw invalidArgument(`Required fields for ${field}: ${schema.required.join(', ')}.`);
    }
    if (schema.oneOf && schema.oneOf.filter(option => hasRequired(option.required)).length !== 1) {
        throw invalidArgument(`Choose exactly one of: ${schema.oneOf.flatMap(option => option.required).join(', ')}.`);
    }
    if (schema.anyOf && !schema.anyOf.some(option => hasRequired(option.required))) {
        throw invalidArgument(`Provide at least one of: ${schema.anyOf.flatMap(option => option.required).join(', ')}.`);
    }
    if (schema.not && hasRequired(schema.not.required)) {
        throw invalidArgument(`These fields cannot be combined: ${schema.not.required.join(', ')}.`);
    }
    for (const [key, item] of entries) {
        if (schema.propertyNames) validate(key, schema.propertyNames, `${field} property name`);
        if (schema.properties && Object.hasOwn(schema.properties, key)) {
            validate(item, schema.properties[key], key);
        } else if (schema.additionalProperties === false) {
            throw invalidArgument(`An unexpected property was provided for ${field}.`);
        } else if (schema.additionalProperties) {
            validate(item, schema.additionalProperties, `${field} property value`);
        }
    }
}

export {
    isObject, uuidPattern, uuid, text, list, input, string, bool, choice, integer, fcmToken,
    deviceInput, topicId, groupInput, message, actions, reports, webhook, audience, aliasAudience,
    profileId, keyName, scalarMap, profileFields, ToolError, invalidArgument, validate,
};
