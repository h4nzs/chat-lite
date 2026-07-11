export async function getParticipantIds(conversationId: string): Promise<string[]> {
  return []; // Opaque Mailboxes do not expose participants to the server
}
