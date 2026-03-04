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
