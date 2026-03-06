import { describe, it, expect } from 'vitest';
import { signQrPayload, verifyQrPayload } from '../shared/lib/qr-crypto';

describe('QR Crypto — signQrPayload & verifyQrPayload', () => {
  it('should sign and verify a stamp payload', async () => {
    const payload = { coffee: 2, wine: 1, beer: 0, txId: 'abc123', timestamp: Date.now() };
    const signed = await signQrPayload(payload);
    const result = await verifyQrPayload(signed);

    expect(result.valid).toBe(true);
    expect(result.payload?.coffee).toBe(2);
    expect(result.payload?.wine).toBe(1);
    expect(result.payload?.beer).toBe(0);
  });

  it('should sign and verify a redeem payload', async () => {
    const payload = { type: 'redeem', cardType: 'coffee', txId: 'r1', timestamp: Date.now() };
    const signed = await signQrPayload(payload);
    const result = await verifyQrPayload(signed);

    expect(result.valid).toBe(true);
    expect(result.payload?.type).toBe('redeem');
    expect(result.payload?.cardType).toBe('coffee');
  });

  it('should reject a tampered payload', async () => {
    const payload = { coffee: 2, wine: 1, beer: 0, txId: 'tamper1', timestamp: Date.now() };
    const signed = await signQrPayload(payload);

    const parsed = JSON.parse(signed);
    parsed.coffee = 99; // tamper!
    const tampered = JSON.stringify(parsed);

    const result = await verifyQrPayload(tampered);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('ongeldig');
  });

  it('should reject an expired payload', async () => {
    const payload = { coffee: 1, wine: 0, beer: 0, txId: 'exp1', timestamp: Date.now() };
    // Sign with negative expiry → already expired
    const signed = await signQrPayload(payload, -5000);
    const result = await verifyQrPayload(signed);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('verlopen');
  });

  it('should reject an unsigned payload (plain JSON)', async () => {
    const unsigned = JSON.stringify({ coffee: 2, wine: 1, beer: 0 });
    const result = await verifyQrPayload(unsigned);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('handtekening');
  });

  it('should reject invalid JSON', async () => {
    const result = await verifyQrPayload('this is not json');
    expect(result.valid).toBe(false);
  });

  it('should reject empty string', async () => {
    const result = await verifyQrPayload('');
    expect(result.valid).toBe(false);
  });

  it('should include exp in the verified payload', async () => {
    const payload = { coffee: 1, wine: 0, beer: 0, txId: 'exp2', timestamp: Date.now() };
    const signed = await signQrPayload(payload);
    const result = await verifyQrPayload(signed);

    expect(result.valid).toBe(true);
    expect(result.payload?.exp).toBeTypeOf('number');
    expect(result.payload?.exp).toBeGreaterThan(Date.now());
  });
});

describe('QR Crypto — edge cases', () => {
  it('should preserve soda field in payload', async () => {
    const payload = { coffee: 0, wine: 0, beer: 0, soda: 3, txId: 'soda1', timestamp: Date.now() };
    const signed = await signQrPayload(payload);
    const result = await verifyQrPayload(signed);

    expect(result.valid).toBe(true);
    expect(result.payload?.soda).toBe(3);
  });

  it('should reject payload where signature is replaced with a random string', async () => {
    const payload = { coffee: 1, wine: 0, beer: 0, txId: 'fakesig', timestamp: Date.now() };
    const signed = await signQrPayload(payload);
    const parsed = JSON.parse(signed);
    parsed.sig = 'aaaaaabbbbbbcccccc1234567890abcdef1234567890abcdef1234567890abcdef';
    const result = await verifyQrPayload(JSON.stringify(parsed));
    expect(result.valid).toBe(false);
  });

  it('should produce different signatures for different payloads', async () => {
    const a = await signQrPayload({ coffee: 1, wine: 0, beer: 0, txId: 'a', timestamp: 1 });
    const b = await signQrPayload({ coffee: 2, wine: 0, beer: 0, txId: 'b', timestamp: 1 });
    const sigA = JSON.parse(a).sig;
    const sigB = JSON.parse(b).sig;
    expect(sigA).not.toBe(sigB);
  });

  it('should reject payload with tampered expiry (extended)', async () => {
    const payload = { coffee: 1, wine: 0, beer: 0, txId: 'expext', timestamp: Date.now() };
    const signed = await signQrPayload(payload, -5000); // already expired
    const parsed = JSON.parse(signed);
    parsed.exp = Date.now() + 60_000; // attacker extends expiry
    // But signature is now invalid because body changed
    const result = await verifyQrPayload(JSON.stringify(parsed));
    expect(result.valid).toBe(false);
  });

  it('should handle all four redeem card types', async () => {
    for (const type of ['coffee', 'wine', 'beer', 'soda']) {
      const payload = { type: 'redeem', cardType: type, txId: `r-${type}`, timestamp: Date.now() };
      const signed = await signQrPayload(payload);
      const result = await verifyQrPayload(signed);
      expect(result.valid).toBe(true);
      expect(result.payload?.cardType).toBe(type);
    }
  });

  it('should handle large consumption numbers', async () => {
    const payload = { coffee: 99, wine: 50, beer: 75, soda: 30, txId: 'big', timestamp: Date.now() };
    const signed = await signQrPayload(payload);
    const result = await verifyQrPayload(signed);
    expect(result.valid).toBe(true);
    expect(result.payload?.coffee).toBe(99);
  });

  it('should reject a completely fabricated object with sig field', async () => {
    const fake = JSON.stringify({
      coffee: 5, wine: 0, beer: 0, soda: 0,
      exp: Date.now() + 300_000,
      sig: '0000000000000000000000000000000000000000000000000000000000000000',
    });
    const result = await verifyQrPayload(fake);
    expect(result.valid).toBe(false);
  });
});
