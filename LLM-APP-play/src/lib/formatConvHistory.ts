export function formatConvHistory(messages: { text: string; type: 'human' | 'ai' }[]) {
    return messages.map((message) => {
        if (message.type === 'human') {
            return `Human: ${message.text}`;
        }
        else {
            return `AI: ${message.text}`;
            };
        }).join('\n');
}