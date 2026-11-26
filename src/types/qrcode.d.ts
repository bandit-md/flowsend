declare module "qrcode" {
  export function toDataURL(
    text: string,
    options?: {
      margin?: number;
      width?: number;
      color?: { dark?: string; light?: string };
    },
  ): Promise<string>;
}

declare module "bs58" {
  const bs58: {
    encode(buffer: Uint8Array): string;
  };
  export default bs58;
}
