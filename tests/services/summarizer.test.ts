import { describe, it, expect, vi } from 'vitest';
import { OpenAISummarizer } from '../../src/services/summarizer/openai.js';

describe('OpenAISummarizer', () => {
  it('should parse summary correctly', () => {
    const mockResponse = `
HIGHLIGHTS:
- Completed feature X
- Fixed bug Y

BLOCKERS:
- Waiting for API access

ACTION_ITEMS:
- Review PR #123
- Deploy to staging
    `;

    const summarizer = new OpenAISummarizer('fake-key');
    // Access private method through type assertion
    const result = (summarizer as any).parseSummary(mockResponse);

    expect(result.highlights).toContain('Completed feature X');
    expect(result.blockers).toContain('Waiting for API access');
    expect(result.actionItems).toContain('Review PR #123');
  });

  it('should handle malformed response', () => {
    const summarizer = new OpenAISummarizer('fake-key');
    const result = (summarizer as any).parseSummary('Invalid response');

    expect(result.highlights).toBe('No highlights available.');
    expect(result.blockers).toBe('No blockers reported.');
    expect(result.actionItems).toBe('No action items identified.');
  });
});

