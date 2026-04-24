declare module 'esc-pos-encoder' {
  class EscPosEncoder {
    initialize(): EscPosEncoder;
    align(alignment: 'left' | 'center' | 'right'): EscPosEncoder;
    text(text: string): EscPosEncoder;
    newline(): EscPosEncoder;
    cut(): EscPosEncoder;
    encode(): Uint8Array;
  }

  export = EscPosEncoder;
}
