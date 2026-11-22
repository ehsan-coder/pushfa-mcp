import { createHash } from 'node:crypto';

import { invalidArgument, ToolError } from './schemas.mjs';

const guideUrls = {
    web: 'https://pushfa.com/index/doc/download/pushfa-web-push-complete-guide-fa.md',
    android: 'https://pushfa.com/index/doc/download/pushfa-android-push-complete-guide-fa.md',
    ios: 'https://pushfa.com/index/doc/download/pushfa-ios-push-complete-guide-fa.md',
};
const guidePageSize = 4000;

async function fetchGuide(url) {
    let response;
    try {
        response = await fetch(url, {
            headers: { Accept: 'text/markdown' },
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(20_000),
        });
        const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
        if (response.ok && contentType === 'text/markdown') {
            const markdown = await response.text();
            if (markdown.trim()) return markdown;
        } else {
            await response.body?.cancel();
        }
    } catch {
        // Report the official source even when the download fails.
    }

    throw new ToolError('MCP_GUIDE_UNAVAILABLE', 'Could not read the current Pushfa guide from its official URL.', {
        url, http_status: response?.status,
    });
}

async function readInstallationGuide({ platform, offset = 0, revision }) {
    if (offset > 0 && revision === undefined) {
        throw invalidArgument('Use the returned revision when requesting a guide page or section.');
    }

    const url = guideUrls[platform];
    const markdown = await fetchGuide(url);
    const currentRevision = createHash('sha256').update(markdown).digest('hex');
    if (revision !== undefined && revision !== currentRevision) {
        throw new ToolError('MCP_GUIDE_CHANGED', 'The guide changed. Restart reading with the platform only to get the updated sections.', { url });
    }
    if (offset >= markdown.length) throw invalidArgument('The guide offset is out of range.');

    let end = Math.min(offset + guidePageSize, markdown.length);
    if (end < markdown.length) {
        const newline = markdown.lastIndexOf('\n', end - 1);
        if (newline >= offset) end = newline + 1;
        else if (markdown.codePointAt(end - 1) > 0xffff) end--;
    }

    const page = {
        platform,
        url,
        revision: currentRevision,
        markdown: markdown.slice(offset, end),
        next_offset: end < markdown.length ? end : null,
    };
    if (offset === 0) {
        page.sections = Array.from(markdown.matchAll(/^##[ \t]+(.+)$/gm), heading => ({
            title: heading[1].trim(), offset: heading.index,
        }));
    }
    return page;
}

export { guideUrls, readInstallationGuide };
