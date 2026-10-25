// What a failed request says to a person: src/utils/errorText.mjs and the request layer's cleaning
// (src/apis/httpRequest.js). Same rules as manager-mobile/src/http/request/errorText.test.mjs.
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/apis/api', () => ({ getServiceUrl: () => '' }));

import {
  businessKey, httpStatusKey, networkErrorKey, peopleText, readRequestError, requestErrorMessage,
} from '@/utils/errorText.mjs';
import { cleanFailure, failureText } from '@/apis/httpRequest';
import { companionErrorKind } from '@/shell/connection.mjs';
import i18n from '@/i18n';
import strings from '@/i18n/pages/request.js';

describe('errorText', () => {
  it('maps HTTP statuses to plain lines', () => {
    expect(httpStatusKey(403)).toBe('request.forbidden');
    expect(httpStatusKey(404)).toBe('request.notFound');
    expect(httpStatusKey(500)).toBe('request.server');
    expect(httpStatusKey(503)).toBe('request.server');
    expect(httpStatusKey(504)).toBe('network.timeout');
    expect(httpStatusKey(401)).toBe('request.sessionEnded');
    expect(httpStatusKey(400)).toBe('request.failed');
  });

  it('tells a timeout from no connection', () => {
    expect(networkErrorKey({ message: 'timeout of 30000ms exceeded' })).toBe('network.timeout');
    expect(networkErrorKey({ status: 0, message: 'Network Error' })).toBe('network.unreachable');
    expect(networkErrorKey({ message: 'abort' })).toBe('');
  });

  it('lets only people text through', () => {
    expect(peopleText('This name is already used')).toBe('This name is already used');
    expect(peopleText('এই নামটি আগে থেকেই আছে')).toBe('এই নামটি আগে থেকেই আছে');
    expect(peopleText('device not found')).toBe('');
    expect(peopleText('java.lang.NullPointerException')).toBe('');
    expect(peopleText('Internal Server Error')).toBe('');
    expect(peopleText('服务器内部错误')).toBe('');
    expect(peopleText('line one\n at x')).toBe('');
    expect(businessKey(404)).toBe('request.notFound');
    expect(readRequestError('Name taken').kind).toBe('business');
    expect(requestErrorMessage({ errMsg: 'request:fail timeout' }, 'x')).toEqual({ key: 'network.timeout' });
  });

  it('has every string in both languages, with no em dash', () => {
    expect(Object.keys(strings.bn).sort()).toEqual(Object.keys(strings.en).sort());
    for (const v of [...Object.values(strings.bn), ...Object.values(strings.en)]) expect(v).not.toMatch(/—/);
  });
});

describe('the request layer cleans failed answers', () => {
  it('keeps people text, hides infrastructure text, keeps the raw text for rules', () => {
    i18n.global.locale = 'en';
    const people = cleanFailure({ status: 200, data: { code: 10001, msg: 'This name is already used' } });
    expect(people.data.msg).toBe('This name is already used');
    const infra = cleanFailure({ status: 200, data: { code: 500, msg: 'device not found' } });
    expect(infra.data.msg).toBe('');
    expect(infra.data.rawMsg).toBe('device not found');
    expect(companionErrorKind(infra)).toBe('not_registered');
    const denied = cleanFailure({ status: 200, data: { code: 403, msg: 'Forbidden' } });
    expect(denied.data.msg).toBe('You do not have permission to do this.');
    const http = cleanFailure({ status: 502, data: { msg: '<html>Bad Gateway</html>' } });
    expect(http.data.msg).toBe('The server is having trouble right now. Try again in a little while.');
    expect(cleanFailure(http)).toBe(http);
    expect(http.data.msg).toBe('The server is having trouble right now. Try again in a little while.');
  });

  it('says a plain line when nothing answered', () => {
    i18n.global.locale = 'bn';
    expect(failureText({ status: 0, message: 'Network Error' })).toBe(strings.bn['network.unreachable']);
    expect(failureText({ status: 404 })).toBe(strings.bn['request.notFound']);
    i18n.global.locale = 'en';
  });
});
