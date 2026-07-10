// Minimal ambient typing for the `jsbarcode` npm package (it ships no
// TypeScript definitions of its own). Only the surface area this app uses
// is declared.
declare module 'jsbarcode' {
  export interface JsBarcodeOptions {
    format?: string;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
    background?: string;
    lineColor?: string;
    text?: string;
    valid?: (valid: boolean) => void;
  }

  function JsBarcode(
    element: string | Element | SVGElement | HTMLCanvasElement | HTMLImageElement,
    value: string,
    options?: JsBarcodeOptions
  ): void;

  export default JsBarcode;
}
