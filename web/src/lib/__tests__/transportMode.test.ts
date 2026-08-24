import { describe, it, expect } from 'vitest';
import { TransportOpCode } from '@nyx/shared';
import {
  decideTransportMode,
  OUTGOING_OPCODE_MAP,
  MVP_OUTGOING_OPCODES,
} from '../transportMode';

describe('decideTransportMode', () => {
  it('tetap di mode wss jika sudah beralih ke wss (sticky untuk sesi)', () => {
    const res = decideTransportMode({ currentMode: 'wss', wtFailCount: 5, wtMaxFails: 2 });
    expect(res.mode).toBe('wss');
    expect(res.shouldSwitchToWss).toBe(false);
    expect(res.shouldRetryWt).toBe(false);
  });

  it('mencoba ulang wt saat gagal di bawah ambang batas', () => {
    const res = decideTransportMode({ currentMode: 'wt', wtFailCount: 1, wtMaxFails: 2 });
    expect(res.mode).toBe('wt');
    expect(res.shouldRetryWt).toBe(true);
    expect(res.shouldSwitchToWss).toBe(false);
  });

  it('beralih ke wss setelah gagal mencapai ambang batas', () => {
    const res = decideTransportMode({ currentMode: 'wt', wtFailCount: 2, wtMaxFails: 2 });
    expect(res.mode).toBe('wss');
    expect(res.shouldSwitchToWss).toBe(true);
    expect(res.shouldRetryWt).toBe(false);
  });

  it('ambang batas bisa dikonfigurasi', () => {
    const res = decideTransportMode({ currentMode: 'wt', wtFailCount: 3, wtMaxFails: 4 });
    expect(res.mode).toBe('wt');
    expect(res.shouldRetryWt).toBe(true);
  });
});

describe('OUTGOING_OPCODE_MAP parity', () => {
  it('setiap opCode MVP punya mapping yang bukan noop', () => {
    for (const op of MVP_OUTGOING_OPCODES) {
      const m = OUTGOING_OPCODE_MAP[op];
      expect(m.kind).not.toBe('noop');
    }
  });

  it('CHAT_MESSAGE -> message:send', () => {
    expect(OUTGOING_OPCODE_MAP[TransportOpCode.CHAT_MESSAGE]).toEqual({ kind: 'fixed', event: 'message:send' });
  });

  it('PRESENCE -> presence:update', () => {
    expect(OUTGOING_OPCODE_MAP[TransportOpCode.PRESENCE]).toEqual({ kind: 'fixed', event: 'presence:update' });
  });

  it('ACK -> message:ack_delivered', () => {
    expect(OUTGOING_OPCODE_MAP[TransportOpCode.ACK]).toEqual({ kind: 'fixed', event: 'message:ack_delivered' });
  });

  it('KEY_SYNC bersifat derived (event dari payload.event)', () => {
    expect(OUTGOING_OPCODE_MAP[TransportOpCode.KEY_SYNC]).toEqual({ kind: 'derived' });
  });

  it('opCode non-MVP (webrtc/kick/handshake/chaff) adalah noop', () => {
    const noopOpcodes = [
      TransportOpCode.CHAFF,
      TransportOpCode.WEBRTC_SIGNAL,
      TransportOpCode.WEBRTC_ICE,
      TransportOpCode.KICK,
      TransportOpCode.HANDSHAKE,
    ];
    for (const op of noopOpcodes) {
      expect(OUTGOING_OPCODE_MAP[op]).toEqual({ kind: 'noop' });
    }
  });

  it('semua opCode memiliki entri mapping (paritas penuh)', () => {
    const allOpcodes = Object.values(TransportOpCode).filter(
      (v): v is TransportOpCode => typeof v === 'number',
    );
    for (const op of allOpcodes) {
      const m = OUTGOING_OPCODE_MAP[op];
      expect(m).toBeDefined();
      expect(['fixed', 'derived', 'noop']).toContain(m.kind);
    }
  });
});
