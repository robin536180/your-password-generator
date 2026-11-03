/**
 * sm-crypto（v0.5.8）最小类型声明
 *
 * 说明：该库为 CommonJS 发布且未自带 TypeScript 类型，这里仅声明本项目实际用到的
 * SM3 / SM4 接口，避免引入额外的 @types 依赖。
 */
declare module 'sm-crypto' {
  export interface Sm3Options {
    mode: 'hmac';
    /** HMAC 密钥，十六进制字符串或字节数组 */
    key: string | number[];
  }

  /** SM3 摘要，返回十六进制小写字符串 */
  export function sm3(input: string | number[] | Uint8Array, options?: Sm3Options): string;

  export interface Sm4Options {
    padding?: 'pkcs#5' | 'pkcs#7' | 'none';
    mode?: 'cbc';
    iv?: string | number[];
    output?: 'string' | 'array';
  }

  export const sm4: {
    encrypt(input: string | number[], key: string | number[], options: Sm4Options & { output: 'array' }): number[];
    encrypt(input: string | number[], key: string | number[], options?: Sm4Options): string;
    decrypt(input: string | number[], key: string | number[], options: Sm4Options & { output: 'array' }): number[];
    decrypt(input: string | number[], key: string | number[], options?: Sm4Options): string;
  };
}
