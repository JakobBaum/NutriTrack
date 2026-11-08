import { AI_ERROR_MESSAGES, friendlyAiErrorMessage } from './ai-errors';

describe('friendlyAiErrorMessage', () => {
  it('maps status 0 to the offline message', () => {
    expect(friendlyAiErrorMessage(0)).toBe(AI_ERROR_MESSAGES.offline);
  });
  it('maps 503 and 500 to the overloaded message', () => {
    expect(friendlyAiErrorMessage(503)).toBe(AI_ERROR_MESSAGES.overloaded);
    expect(friendlyAiErrorMessage(500)).toBe(AI_ERROR_MESSAGES.overloaded);
  });
  it('maps 429 to the rate-limit message', () => {
    expect(friendlyAiErrorMessage(429)).toBe(AI_ERROR_MESSAGES.rateLimited);
  });
  it('maps 401 and 403 to the key-invalid message', () => {
    expect(friendlyAiErrorMessage(401)).toBe(AI_ERROR_MESSAGES.unauthorized);
    expect(friendlyAiErrorMessage(403)).toBe(AI_ERROR_MESSAGES.unauthorized);
  });
  it('maps 422 to the unreadable-answer message', () => {
    expect(friendlyAiErrorMessage(422)).toBe(AI_ERROR_MESSAGES.unreadable);
  });
  it('falls back to the generic message', () => {
    expect(friendlyAiErrorMessage(418)).toBe(AI_ERROR_MESSAGES.generic);
  });
});
