/** Retains incomplete JSON-line bytes until they can be decoded as complete UTF-8 frames. */
export class BridgeResponseBuffer {
  private input = Buffer.alloc(0);

  /** Returns complete newline-delimited frames without decoding split UTF-8 sequences early. */
  receive(chunk: Buffer): string[] {
    this.input = Buffer.concat([this.input, chunk]);
    const frames: string[] = [];
    let boundary: number;

    while ((boundary = this.input.indexOf(0x0a)) >= 0) {
      frames.push(this.input.subarray(0, boundary).toString('utf8'));
      this.input = this.input.subarray(boundary + 1);
    }

    return frames;
  }
}
