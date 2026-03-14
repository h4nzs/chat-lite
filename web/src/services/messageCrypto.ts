import { 
  encryptMessage, 
  retrieveMessageKeySecurely, 
  storeMessageKeySecurely,
  retrieveLatestSessionKeySecurely, 
  establishSessionFromPreKeyBundle, 
  getMyEncryptionKeyPair, 
  storeRatchetStateSecurely,
  PreKeyBundle 
} from "@utils/crypto";
import { getSodium } from "@lib/sodiumInitializer";
import { useAuthStore } from "@store/auth";

export interface EncryptPayloadParams {
  content: string;
  conversationId: string;
  isGroup: boolean;
  actualTempId: number;
  participants: any[];
  isReactionPayload?: boolean;
}

export async function prepareEncryptedPayload({
  content,
  conversationId,
  isGroup,
  actualTempId,
  participants,
  isReactionPayload
}: EncryptPayloadParams): Promise<{ ciphertext: string, x3dhHeader: any, mkToStore?: Uint8Array }> {
  let x3dhHeader: any = null;
  const user = useAuthStore.getState().user;
  if (!user) throw new Error("Not authenticated");

  // 1. Check Ratchet Session State (For 1-on-1)
  if (!isGroup && !isReactionPayload) {
      const { retrieveRatchetStateSecurely } = await import('@utils/crypto');
      const existingState = await retrieveRatchetStateSecurely(conversationId);
      
      if (!existingState) {
          // Initialize X3DH Alice (Sender)
          const targetParticipant = participants.find((p: any) => (p.userId || p.id) !== user.id);
          
          if (targetParticipant) {
              const targetUserId = targetParticipant.userId || targetParticipant.id;
              const { authFetch } = await import('@lib/api');
              
              // Fetch Bob's PreKeyBundle
              const res = await authFetch(`/api/keys/bundle/${targetUserId}`) as any;
              if (!res.ok) throw new Error("Failed to fetch pre-keys");
              
              const theirBundle: PreKeyBundle = await res.json();
              const myKeyPair = await getMyEncryptionKeyPair();
              const { sessionKey, ephemeralPublicKey, otpkId } = await establishSessionFromPreKeyBundle(myKeyPair, theirBundle);
              const sodium = await getSodium();
              
              const { worker_dr_init_alice } = await import('@lib/crypto-worker-proxy');
              const newState = await worker_dr_init_alice({
                  sk: sessionKey,
                  theirSignedPreKeyPublic: sodium.from_base64(theirBundle.signedPreKey.key, sodium.base64_variants.URLSAFE_NO_PADDING)
              });
              
              await storeRatchetStateSecurely(conversationId, newState);

              x3dhHeader = {
                  ik: sodium.to_base64(myKeyPair.publicKey, sodium.base64_variants.URLSAFE_NO_PADDING),
                  ek: ephemeralPublicKey,
                  otpkId: otpkId
              };
          } else {
              throw new Error("Cannot identify recipient for X3DH initialization");
          }
      }
  }

  // 2. Profile Key Injection
  let contentToEncrypt = content;
  try {
      const profileKey = await import('@lib/keychainDb').then(m => m.getProfileKey(user.id));
      if (profileKey) {
          let parsedObj: any = null;
          if (contentToEncrypt.trim().startsWith('{')) {
              try { parsedObj = JSON.parse(contentToEncrypt); } catch (e) {}
          }
          
          if (parsedObj && typeof parsedObj === 'object') {
              parsedObj.profileKey = profileKey;
              contentToEncrypt = JSON.stringify(parsedObj);
          } else {
              contentToEncrypt = JSON.stringify({ text: contentToEncrypt, profileKey });
          }
      }
  } catch (e) {
      console.error("Failed to inject profile key", e);
  }

  // 3. Encrypt Payload
  const result = await encryptMessage(contentToEncrypt, conversationId, isGroup, undefined, `temp_${actualTempId}`);
  let ciphertext = result.ciphertext;
  
  if (!isGroup && result.drHeader) {
      ciphertext = JSON.stringify({
          dr: result.drHeader,
          ciphertext: ciphertext
      });
  }

  return { ciphertext, x3dhHeader, mkToStore: result.mk };
}

export async function generatePushPayloads(
  content: string, 
  conversationId: string, 
  participants: any[], 
  data: any // The raw unencrypted data passed to sendMessage to derive the preview
): Promise<Record<string, string>> {
  const pushPayloads: Record<string, string> = {};
  
  try {
    const sodium = await getSodium();
    const { worker_crypto_box_seal } = await import('@lib/crypto-worker-proxy');
    const myAuthUser = useAuthStore.getState().user;
    if (!myAuthUser) return pushPayloads;

    let myName = 'Someone';
    if (myAuthUser.encryptedProfile) {
       try {
          const profileStore = (await import('@store/profile')).useProfileStore.getState();
          const myDecrypted = await profileStore.decryptAndCache(myAuthUser.id, myAuthUser.encryptedProfile);
          if (myDecrypted && myDecrypted.name !== "Encrypted User") {
              myName = myDecrypted.name;
          }
       } catch (e) {
          console.error("Failed to decrypt own profile for push", e);
       }
    }

    // Determine Push Body
    let pushBody: string;
    
    // Check for story_reply
    if (typeof data.content === 'string' && data.content.startsWith('{') && data.content.includes('"type":"story_reply"')) {
        try {
            const metadata = JSON.parse(data.content);
            if (metadata.type === 'story_reply' && metadata.text) {
                pushBody = `📖 Story reply: ${metadata.text}`;
            } else {
                pushBody = '📖 Replied to your story';
            }
        } catch (e) {
            pushBody = '📖 Replied to your story';
        }
    } else if (data.fileUrl || data.fileName) {
        pushBody = `Sent a file: ${data.fileName || 'Attachment'}`;
    } else if (data.isViewOnce) {
        pushBody = 'Sent a view-once message';
    } else if (typeof data.content === 'string' && data.content.trim()) {
        const maxLength = 100;
        pushBody = data.content.length > maxLength
            ? data.content.substring(0, maxLength) + '...'
            : data.content;
    } else {
        pushBody = 'Sent a secure message';
    }

    const pushData = JSON.stringify({ title: myName, body: pushBody, conversationId });
    const pushDataBytes = new TextEncoder().encode(pushData);

    // Encrypt for each recipient
    for (const p of participants) {
       const targetUserId = p.userId || p.id;
       const targetPublicKey = p.user?.publicKey || p.publicKey;

       if (targetUserId !== myAuthUser.id && targetPublicKey) {
           try {
               const recipientPubBytes = sodium.from_base64(targetPublicKey, sodium.base64_variants.URLSAFE_NO_PADDING);
               const sealed = await worker_crypto_box_seal(pushDataBytes, recipientPubBytes);
               pushPayloads[targetUserId] = sodium.to_base64(sealed, sodium.base64_variants.URLSAFE_NO_PADDING);
           } catch (e) {
               console.error(`Failed to seal push for ${targetUserId}`, e);
           }
       }
    }
  } catch (e) {
    console.error("Failed to generate push payloads", e);
  }

  return pushPayloads;
}

export async function decryptSelfMessage(decryptedMsg: any, seenIds: Set<string>, depth: number, options: any): Promise<any> {
    const { worker_crypto_secretbox_xchacha20poly1305_open_easy } = await import('@lib/crypto-worker-proxy');
    const sodium = await getSodium();
    
    let mk = await retrieveMessageKeySecurely(decryptedMsg.id);
    if (!mk && decryptedMsg.tempId) {
        mk = await retrieveMessageKeySecurely(`temp_${decryptedMsg.tempId}`);
    }
    
    if (mk) {
        let cipherTextToUse = decryptedMsg.ciphertext || decryptedMsg.content;
        
        // Unwrap nested payloads (X3DH/DR)
        const unwrap = (str: string): string => {
             if (str && typeof str === 'string' && str.trim().startsWith('{')) {
                 try {
                     const p = JSON.parse(str);
                     if (p.ciphertext) return unwrap(p.ciphertext);
                 } catch {}
             }
             return str;
        }
        
        cipherTextToUse = unwrap(cipherTextToUse!);

        if (cipherTextToUse) {
            try {
                const combined = sodium.from_base64(cipherTextToUse, sodium.base64_variants.URLSAFE_NO_PADDING);
                const nonce = combined.slice(0, 24);
                const encrypted = combined.slice(24);
                const decryptedBytes = await worker_crypto_secretbox_xchacha20poly1305_open_easy(encrypted, nonce, mk);
                let plainText = sodium.to_string(decryptedBytes);
                
                // Strip profile key
                if (plainText && plainText.trim().startsWith('{')) {
                    try {
                        const parsed = JSON.parse(plainText);
                        if (parsed.profileKey) {
                            delete parsed.profileKey;
                            if (parsed.text !== undefined && Object.keys(parsed).length === 1) {
                                plainText = parsed.text;
                            } else {
                                plainText = JSON.stringify(parsed);
                            }
                        }
                    } catch (e) {}
                }
                
                decryptedMsg.content = plainText;
                return decryptedMsg;
            } catch (e) {
                console.error("Self-decrypt failed with stored key:", e);
            }
        }
    }
    
    // Fallback if MK is missing
    if (decryptedMsg.content && decryptedMsg.content.trim().startsWith('{')) {
         decryptedMsg.content = "You sent this message (Encrypted)";
    }
    return decryptedMsg;
}